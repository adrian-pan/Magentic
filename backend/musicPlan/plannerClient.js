/**
 * musicPlan/plannerClient.js — Vendor-agnostic planner client.
 * Supports OpenAI, RunPod vLLM, Modal, and local Flash.
 */

const OpenAI = require('openai');

// Prefer REASONING_* names; keep PLANNER_* for backward compatibility.
const REASONING_PROVIDER = process.env.REASONING_PROVIDER || process.env.PLANNER_PROVIDER || 'openai';
const REASONING_RUNPOD_ENDPOINT_ID =
  process.env.REASONING_RUNPOD_ENDPOINT_ID || process.env.PLANNER_RUNPOD_ENDPOINT_ID;
const REASONING_RUNPOD_API_KEY =
  process.env.REASONING_RUNPOD_API_KEY || process.env.PLANNER_RUNPOD_API_KEY || process.env.RUNPOD_API_KEY;
const REASONING_BASE_URL = process.env.REASONING_BASE_URL || process.env.PLANNER_BASE_URL;
const REASONING_FLASH_URL = process.env.REASONING_FLASH_URL || process.env.PLANNER_FLASH_URL || 'http://localhost:8888';
const REASONING_MODAL_URL = process.env.REASONING_MODAL_URL || process.env.PLANNER_MODAL_URL;

const PLANNER_SYSTEM = `You are a music production planner. Output ONLY valid JSON matching the MusicPlan schema. No markdown, no prose.

MusicPlan schema (version 1):
{
  "version": 1,
  "meta": { "genre": "string", "mood": "string", "reference": "string" },
  "transport": {
    "tempo_bpm": 20-300,
    "time_signature": "4/4",
    "key": "string (e.g. C major, A minor)",
    "bar_count": 1-128
  },
  "tracks": [
    {
      "name": "string",
      "role": "harmony|bass|melody|drums|audio|fx",
      "instrument_hint": "ReaSynth|VST3i: Serum 2 (Xfer Records)|string",
      "midi": {
        "clips": [
          {
            "start_beat": 0,
            "length_beats": 16,
            "events": [
              {
                "type": "chord|note",
                "symbol": "Am7",
                "start_beat": 0,
                "length_beats": 4,
                "octave": 4,
                "voicing": "close|open|drop2"
              }
            ]
          }
        ]
      },
      "audio_pattern": {
        "type": "four_on_floor|import_audio",
        "sample_url": "https://...",
        "bars": 16,
        "start_beat": 0,
        "position_seconds": 0
      }
    }
  ],
  "needs": [
    {
      "id": "need_001",
      "type": "kick_sample_url|audio_file_url|stems_for_song|midi_url|project_state|fx_name",
      "required": true,
      "status": "missing|available|unknown",
      "reason": "string",
      "proposed_resolution": {
        "strategy": "ask_user|call_tool|use_default|skip_feature",
        "tool_call": { "name": "list_stems_for_song", "arguments": { "song_name": "..." } }
      }
    }
  ],
  "execution_policy": {
    "allow_auto_resolve": true,
    "max_tool_calls": 30,
    "on_missing_required": "block|degrade"
  }
}

Rules:
- REVISION AWARE: When the user asks to change/revise/replace/redo something, reuse the SAME track names from the existing project context. The executor will automatically clean up old MIDI items and FX on matching tracks before applying your plan. Do NOT create duplicate tracks with new names — reuse existing names so the old content gets replaced.
- Do NOT invent URLs. If an asset is missing, emit a need. Never guess or fabricate sample_url, midiUrl, or file URLs.
- Every need must have an "id" field.
- If no kick sample in assets for four-on-floor, emit need_kick and do not fabricate sample_url.
- If user requests stems but no song/audio available, emit need_stems. Never guess song_name in tool_call arguments.
- If user requests Serum and FX browser name is unconfirmed, emit need_fx or fallback instrument_hint=ReaSynth. Do not output Serum/VST instrument_hint unless confirmed.
- If user requests transcribe-to-MIDI and no audio is present, emit need_audio.
- For tension→release in A minor: end on Am and place E/E7 right before it.
- Use triads/7ths only for chord symbols.
- For every need, proposed_resolution.tool_call MUST be an object: {"name":"...", "arguments":{}} (arguments must be object).
- Keep all events within clip bounds: event.start_beat >= clip.start_beat and event.start_beat + event.length_beats <= clip.start_beat + clip.length_beats.
`;

function stripThinkingTokens(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function parseJsonFromContent(content) {
  const cleaned = stripThinkingTokens(content);
  const trimmed = cleaned.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(jsonStr);
}

function normalizeChordSymbol(symbol) {
  const s = String(symbol || '').trim().replace(/\s+/g, '');
  const rootMatch = s.match(/^([A-G](?:#|b)?)/i);
  const root = rootMatch ? `${rootMatch[1][0].toUpperCase()}${rootMatch[1].slice(1)}` : 'C';
  const lower = s.toLowerCase();
  if (/maj7/.test(lower)) return `${root}maj7`;
  if (/m7|min7/.test(lower)) return `${root}m7`;
  if (/(^|[^a-z])7(?!\d)/.test(lower)) return `${root}7`;
  if (/^([a-g](#|b)?)(m|min|-)/i.test(s)) return `${root}m`;
  return root;
}

function normalizePlanShape(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const normalized = JSON.parse(JSON.stringify(plan));

  for (const need of normalized.needs || []) {
    need.proposed_resolution = need.proposed_resolution || { strategy: 'ask_user' };
    if (!need.proposed_resolution.tool_call || typeof need.proposed_resolution.tool_call !== 'object' || Array.isArray(need.proposed_resolution.tool_call)) {
      need.proposed_resolution.tool_call = { name: 'ask_user', arguments: {} };
    }
    need.proposed_resolution.tool_call.arguments =
      need.proposed_resolution.tool_call.arguments && typeof need.proposed_resolution.tool_call.arguments === 'object'
        ? need.proposed_resolution.tool_call.arguments
        : {};
    const songName = need.proposed_resolution.tool_call.arguments.song_name;
    if (typeof songName === 'string' && /^(undefined|null|n\/a|na|\.{1,3}|<.*>|\?\??||\s*)$/i.test(songName.trim())) {
      delete need.proposed_resolution.tool_call.arguments.song_name;
    }
  }

  for (const track of normalized.tracks || []) {
    if (track.audio_pattern == null) {
      delete track.audio_pattern;
    } else if (typeof track.audio_pattern !== 'object' || Array.isArray(track.audio_pattern)) {
      delete track.audio_pattern;
    } else if (track.audio_pattern && !['four_on_floor', 'import_audio'].includes(track.audio_pattern.type)) {
      delete track.audio_pattern;
    }

    const clips = track?.midi?.clips || [];
    for (const clip of clips) {
      const clipStart = Number(clip.start_beat ?? 0);
      const clipLen = Math.max(0.25, Number(clip.length_beats ?? 0));
      const clipEnd = clipStart + clipLen;
      clip.start_beat = clipStart;
      clip.length_beats = clipLen;

      for (const ev of clip.events || []) {
        if (ev.type === 'chord' && ev.symbol) {
          ev.symbol = normalizeChordSymbol(ev.symbol);
        }
        if (ev.voicing && !['close', 'open', 'drop2'].includes(ev.voicing)) {
          ev.voicing = 'close';
        }
        const safeLen = Math.max(0.25, Number(ev.length_beats ?? 0.25));
        let safeStart = Number(ev.start_beat ?? clipStart);
        safeStart = Math.max(clipStart, Math.min(safeStart, clipEnd - safeLen));
        let adjustedLen = safeLen;
        if (safeStart + adjustedLen > clipEnd) {
          adjustedLen = Math.max(0.25, clipEnd - safeStart);
        }
        ev.start_beat = safeStart;
        ev.length_beats = adjustedLen;
      }
    }
  }

  return normalized;
}

function extractRunpodContent(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      if (typeof first.text === 'string') return first.text;
      if (typeof first.content === 'string') return first.content;
      const msg = first.choices?.[0]?.message?.content;
      if (typeof msg === 'string') return msg;
      const tok = first.choices?.[0]?.tokens?.[0];
      if (typeof tok === 'string') return tok;
    }
    return JSON.stringify(first);
  }
  if (typeof output === 'object') {
    if (typeof output.text === 'string') return output.text;
    if (typeof output.content === 'string') return output.content;
    const msg = output.choices?.[0]?.message?.content;
    if (typeof msg === 'string') return msg;
  }
  return JSON.stringify(output);
}

async function runPodPlan(systemPrompt, userMsg) {
  const apiKey = REASONING_RUNPOD_API_KEY || process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error('REASONING_RUNPOD_API_KEY (or legacy PLANNER_RUNPOD_API_KEY) required for runpod_vllm');
  if (!REASONING_RUNPOD_ENDPOINT_ID && !REASONING_BASE_URL) {
    throw new Error('REASONING_RUNPOD_ENDPOINT_ID (or legacy PLANNER_RUNPOD_ENDPOINT_ID) required for runpod_vllm');
  }

  const baseUrl = REASONING_BASE_URL || `https://api.runpod.ai/v2/${REASONING_RUNPOD_ENDPOINT_ID}`;
  const submitUrl = `${baseUrl.replace(/\/$/, '')}/run`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const submitRes = await fetch(submitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        sampling_params: { temperature: 0.2, max_tokens: 1200 },
      },
    }),
  });
  if (!submitRes.ok) throw new Error(`RunPod /run planner error ${submitRes.status}: ${await submitRes.text()}`);
  const submitData = await submitRes.json();
  if (submitData.error) throw new Error(submitData.error);
  if (!submitData.id) throw new Error(`RunPod /run returned no job id: ${JSON.stringify(submitData)}`);

  const statusUrl = `${baseUrl.replace(/\/$/, '')}/status/${submitData.id}`;
  for (let i = 0; i < 180; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) throw new Error(`RunPod /status planner error ${statusRes.status}: ${await statusRes.text()}`);
    const statusData = await statusRes.json();
    if (statusData.error) throw new Error(statusData.error);
    const status = statusData.status;
    if (status === 'COMPLETED') return normalizePlanShape(parseJsonFromContent(extractRunpodContent(statusData.output)));
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT') {
      throw new Error(`RunPod job ${status}: ${JSON.stringify(statusData)}`);
    }
  }
  throw new Error(`RunPod planner timed out waiting for job completion: ${submitData.id}`);
}

async function openaiPlan(userMsg) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.REASONING_MODEL || process.env.PLANNER_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });
  return normalizePlanShape(parseJsonFromContent(completion.choices[0]?.message?.content?.trim() || ''));
}

async function flashPlan(systemPrompt, userMsg) {
  const url = `${REASONING_FLASH_URL.replace(/\/$/, '')}/planner/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: systemPrompt, user: userMsg, max_tokens: 800, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`Flash planner error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return normalizePlanShape(parseJsonFromContent(data.text || ''));
}

const REASONING_TIMEOUT = parseInt(process.env.REASONING_TIMEOUT_MS || '12000', 10);

async function modalPlan(systemPrompt, userMsg) {
  if (!REASONING_MODAL_URL) throw new Error('REASONING_MODAL_URL (or legacy PLANNER_MODAL_URL) is required for REASONING_PROVIDER=modal');
  const url = `${REASONING_MODAL_URL.replace(/\/$/, '')}/generate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REASONING_TIMEOUT);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: systemPrompt, user: userMsg, max_tokens: 800, temperature: 0.2 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Modal planner error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return normalizePlanShape(parseJsonFromContent(data.text || ''));
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`MODAL_TIMEOUT: Modal reasoning exceeded ${REASONING_TIMEOUT}ms`);
    }
    throw err;
  }
}

async function planMusic(opts) {
  const { userText, context, assets, previousPlan, validatorErrors, validatorWarnings } = opts;

  const contextStr = context
    ? `Project: BPM=${context.bpm}, tracks=${context.n_tracks || 0}. Names: ${(context.tracks || []).map((t) => t.name).join(', ')}`
    : 'No project state.';
  const assetsStr = assets
    ? `Assets: uploaded_files=${(assets.uploaded_files || []).length}, stems=${JSON.stringify(assets.stems?.available || [])}, midi=${(assets.midi || []).length}`
    : 'No assets.';

  let userMsg = `User: ${userText}\n\nContext: ${contextStr}\n${assetsStr}`;
  if (previousPlan && (validatorErrors?.length || validatorWarnings?.length)) {
    userMsg += `\n\nPrevious plan had errors. Fix and output valid JSON only:\nErrors: ${(validatorErrors || []).join('; ')}\nWarnings: ${(validatorWarnings || []).join('; ')}`;
  }

  if (REASONING_PROVIDER === 'flash') return flashPlan(PLANNER_SYSTEM, userMsg);
  if (REASONING_PROVIDER === 'modal') {
    try {
      return await modalPlan(PLANNER_SYSTEM, userMsg);
    } catch (err) {
      if (/MODAL_TIMEOUT|fetch failed|ECONNREFUSED/i.test(err.message)) {
        console.warn(`[planMusic] Modal timed out/unreachable, falling back to OpenAI: ${err.message}`);
        return openaiPlan(userMsg);
      }
      throw err;
    }
  }
  if (REASONING_PROVIDER === 'runpod_vllm') return runPodPlan(PLANNER_SYSTEM, userMsg);
  return openaiPlan(userMsg);
}

async function checkPlannerHealth() {
  const provider = process.env.REASONING_PROVIDER || process.env.PLANNER_PROVIDER || 'openai';
  if (provider === 'openai') {
    return { ok: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-your')), provider: 'openai' };
  }
  if (provider === 'flash') {
    try {
      const res = await fetch(`${REASONING_FLASH_URL.replace(/\/$/, '')}/health`);
      return res.ok ? { ok: true, provider: 'flash' } : { ok: false, provider: 'flash', error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, provider: 'flash', error: e.message || 'unreachable' };
    }
  }
  if (provider === 'modal') {
    if (!REASONING_MODAL_URL) return { ok: false, provider: 'modal', error: 'REASONING_MODAL_URL (or PLANNER_MODAL_URL) is missing' };
    try {
      const res = await fetch(`${REASONING_MODAL_URL.replace(/\/$/, '')}/health`);
      return res.ok ? { ok: true, provider: 'modal' } : { ok: false, provider: 'modal', error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, provider: 'modal', error: e.message || 'unreachable' };
    }
  }
  if (provider === 'runpod_vllm') {
    try {
      const healthUrl = `${(REASONING_BASE_URL || `https://api.runpod.ai/v2/${REASONING_RUNPOD_ENDPOINT_ID}`).replace(/\/$/, '')}/health`;
      const res = await fetch(healthUrl, { headers: { Authorization: `Bearer ${REASONING_RUNPOD_API_KEY || process.env.RUNPOD_API_KEY}` } });
      if (!res.ok) return { ok: false, provider: 'runpod_vllm', error: `HTTP ${res.status}` };
      const data = await res.json();
      if (data.error) return { ok: false, provider: 'runpod_vllm', error: data.error };
      return { ok: true, provider: 'runpod_vllm' };
    } catch (e) {
      return { ok: false, provider: 'runpod_vllm', error: e.message || 'unreachable' };
    }
  }
  return { ok: false, provider, error: 'unknown provider' };
}

module.exports = { planMusic, PLANNER_SYSTEM, parseJsonFromContent, checkPlannerHealth };

