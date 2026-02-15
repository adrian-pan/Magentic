/**
 * musicPlan/executor.js — Deterministic plan → REAPER tool calls.
 * Maps MusicPlan to TOOL_DISPATCH invocations. No LLM improvisation.
 */

const { compileClip } = require('./compileNotes');
const { TOOL_DISPATCH } = require('../agent/tools');

/**
 * Convert beats to seconds at given BPM. Assumes 4/4 (1 beat = 1 quarter note).
 */
function beatsToSeconds(beats, bpm) {
    return (beats * 60) / (bpm || 120);
}

/**
 * Execute a validated, unblocked MusicPlan.
 * @param {object} plan - Validated MusicPlan
 * @param {object} context - Normalized project state (for track index resolution)
 * @param {object} assets - Resolved assets (stems.urls, uploaded_files with url)
 * @returns {Promise<Array<{ tool: string; args: object; result: object }>>}
 */
async function executePlan(plan, context, assets) {
    const results = [];
    const bpm = plan.transport?.tempo_bpm ?? 120;
    const policy = plan.execution_policy || {};
    const maxCalls = policy.max_tool_calls ?? 30;

    let callCount = 0;
    const trackIndexMap = {}; // plan track name -> REAPER track index

    const run = async (name, args) => {
        if (callCount >= maxCalls) return { success: false, error: 'Max tool calls exceeded' };
        const fn = TOOL_DISPATCH[name];
        if (!fn) return { success: false, error: `Unknown tool: ${name}` };
        callCount++;
        const result = await fn(args);
        results.push({ tool: name, args, result });
        return result;
    };

    // 1. Set tempo
    await run('set_tempo', { bpm });

    // 2. Create tracks and record indices
    const existingCount = context?.n_tracks ?? 0;
    for (let i = 0; i < (plan.tracks || []).length; i++) {
        const track = plan.tracks[i];
        const idx = existingCount + i;
        const r = await run('create_track', { name: track.name, index: -1 });
        if (r?.success !== false) {
            trackIndexMap[track.name] = idx;
        }
    }

    // 3. MIDI tracks: create_midi_item + add_midi_notes
    for (const track of plan.tracks || []) {
        const trackIdx = trackIndexMap[track.name];
        if (trackIdx == null) continue;

        const midi = track.midi;
        if (!midi?.clips?.length) continue;

        for (let c = 0; c < midi.clips.length; c++) {
            const clip = midi.clips[c];
            const pos = clip.start_beat ?? 0;
            const len = clip.length_beats ?? 4;

            const createRes = await run('create_midi_item', {
                track_index: trackIdx,
                position: pos,
                length: len,
            });
            if (createRes?.success === false) continue;

            const notes = compileClip(clip);
            if (notes.length > 0) {
                await run('add_midi_notes', {
                    track_index: trackIdx,
                    item_index: c,
                    notes: notes.map((n) => ({
                        pitch: n.pitch,
                        start: n.start,
                        length: n.length,
                        velocity: n.velocity ?? 100,
                    })),
                });
            }
        }

        if (track.instrument_hint) {
            await run('add_fx', {
                track_index: trackIdx,
                fx_name: track.instrument_hint,
            });
        }
    }

    // 4. Audio tracks: insert_media_to_track
    for (const track of plan.tracks || []) {
        const trackIdx = trackIndexMap[track.name];
        if (trackIdx == null) continue;

        const ap = track.audio_pattern;
        if (!ap) continue;

        let url = ap.sample_url;
        if (!url && ap.type === 'import_audio') {
            const stems = assets?.stems?.urls;
            const files = assets?.uploaded_files || [];
            url = stems?.[track.role] || files.find((f) => f.url)?.url;
        }
        if (!url) continue;

        const posSec = ap.position_seconds ?? beatsToSeconds(ap.start_beat ?? 0, bpm);

        if (ap.type === 'four_on_floor') {
            const bars = ap.bars ?? 4;
            for (let bar = 0; bar < bars; bar++) {
                const barStartSec = posSec + beatsToSeconds(bar * 4, bpm);
                await run('insert_media_to_track', {
                    file_url: url,
                    track_index: trackIdx,
                    track_name: track.name,
                    position: barStartSec,
                });
            }
        } else {
            await run('insert_media_to_track', {
                file_url: url,
                track_index: trackIdx,
                track_name: track.name,
                position: posSec,
            });
        }
    }

    return results;
}

module.exports = { executePlan, beatsToSeconds };
