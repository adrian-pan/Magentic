/**
 * orchestrator/planExecute.js — Plan-based execution path (reasoning model).
 *
 * Called only for broad/creative/underspecified music requests (routeIntent → "plan").
 * Flow: planner → validate → repair loop → needs gate → execute (or block).
 *
 * Needs auto-resolution: DISABLED (user choice 4B — ask user first).
 * Template hook: when templates are added, inject them into the planner prompt here.
 */

const { planMusic } = require('../musicPlan/plannerClient');
const { validatePlan } = require('../musicPlan/validatePlan');
const { evaluateNeeds } = require('../musicPlan/evaluateNeeds');
const { executePlan } = require('../musicPlan/executor');
const { normalizeProjectState } = require('../musicPlan/normalizeProjectState');
const { ensureProjectState, invalidateCache } = require('./projectCache');

const MAX_REPAIR_ROUNDS = 3;
const JSON_PARSE_RETRY = 1;
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

// ── Installed instruments cache (for validator capabilities) ────────────────
let _instrumentsCache = null;
let _instrumentsCacheTime = 0;
const INSTRUMENTS_TTL = 60_000;

async function getInstalledInstruments() {
    const now = Date.now();
    if (_instrumentsCache && now - _instrumentsCacheTime < INSTRUMENTS_TTL) {
        return _instrumentsCache;
    }
    try {
        const res = await fetch(`${BRIDGE_URL}/analyze/instruments`);
        if (!res.ok) return _instrumentsCache || [];
        const data = await res.json();
        if (data.success && Array.isArray(data.instruments)) {
            _instrumentsCache = data.instruments.map((i) => i.name).filter(Boolean);
            _instrumentsCacheTime = now;
            return _instrumentsCache;
        }
    } catch { /* bridge unreachable */ }
    return _instrumentsCache || [];
}

// ── User-friendly fallback questions ────────────────────────────────────────
function buildFallbackQuestions(userText = '') {
    const text = String(userText || '').toLowerCase();
    const questions = [
        'Could you be more specific about the style/genre you want?',
        'What tempo, key, and bar length should I use?',
        'Which track(s) should I modify, or should I create new ones?',
    ];
    if (/stems?/.test(text)) questions.unshift('Which song should I fetch stems for?');
    if (/transcribe|midi/.test(text)) questions.unshift('Upload or provide a URL to the audio file to transcribe.');
    return questions.slice(0, 3);
}

/**
 * Build assets object from contextFiles.
 */
function buildAssets(contextFiles) {
    const uploaded_files = (contextFiles || [])
        .map((f) => ({ name: f.name, url: f.url, type: f.type || 'binary' }))
        .filter((f) => f.url);
    return { uploaded_files, stems: null, midi: [] };
}

/**
 * Execute via reasoning model pipeline.
 *
 * @param {object} opts
 * @param {string} opts.userText
 * @param {Array}  [opts.contextFiles]
 * @returns {Promise<{ message: object, toolResults?: object[], blocked?: boolean, needs?: object[] }>}
 */
async function planExecute({ userText, contextFiles }) {
    // 1. Fetch project state via cache
    const rawContext = await ensureProjectState({ needed: true });
    const context = normalizeProjectState(rawContext);
    const assets = buildAssets(contextFiles);

    // ── Template hook (future) ──────────────────────────────────────────────
    // const template = matchTemplate(userText);
    // if (template) { return executeTemplate(template, context, assets); }

    let plan = null;
    let validation = { ok: false, errors: [], warnings: [] };
    let lastErrors = [];
    let lastWarnings = [];
    let jsonParseRetries = 0;

    // 2. Plan + repair loop
    for (let round = 0; round < MAX_REPAIR_ROUNDS; round++) {
        try {
            plan = await planMusic({
                userText,
                context,
                assets,
                previousPlan: plan,
                validatorErrors: lastErrors,
                validatorWarnings: lastWarnings,
            });
        } catch (err) {
            const isJsonError = /invalid JSON|JSON\.parse|Unexpected token/i.test(err.message);
            if (isJsonError && jsonParseRetries < JSON_PARSE_RETRY) {
                jsonParseRetries++;
                lastErrors = ['Planner returned invalid JSON. Output valid JSON only.'];
                lastWarnings = [];
                round--; // retry same round
                continue;
            }
            console.warn('[planExecute] Planner call failed:', err.message);
            return {
                message: {
                    role: 'assistant',
                    content: buildFallbackQuestions(userText).map((q) => `• ${q}`).join('\n'),
                },
                toolResults: [],
                blocked: true,
                needs: [],
            };
        }

        // 3. Validate with capabilities (includes installed instruments)
        const trackFx = (context?.tracks || []).flatMap((t) =>
            (t.fx || []).map((f) => (typeof f === 'string' ? f : f?.name)).filter(Boolean)
        );
        const installedInstruments = await getInstalledInstruments();
        const capabilities = {
            known_fx: [...new Set([...trackFx, ...installedInstruments])],
        };

        validation = validatePlan(plan, { userText, assets, capabilities });
        lastErrors = validation.errors || [];
        lastWarnings = validation.warnings || [];

        if (validation.ok) {
            plan = validation.normalizedPlan || plan;
            break;
        }
    }

    // 4. Plan failed after repair rounds
    if (!plan || !validation.ok) {
        if (lastErrors.length) {
            console.warn('[planExecute] Validation failed:', lastErrors.slice(0, 3).join(' | '));
        }
        return {
            message: {
                role: 'assistant',
                content: buildFallbackQuestions(userText).map((q) => `• ${q}`).join('\n'),
            },
            toolResults: [],
            blocked: true,
            needs: [],
        };
    }

    // 5. Evaluate needs — DO NOT auto-resolve (user choice 4B: ask user first)
    const gate = evaluateNeeds(plan, context, assets);

    if (gate.blocked) {
        const lines = gate.missing.length > 0
            ? ['I can work on this, but I need a few things first:']
            : ['I need a bit more context to do this reliably:'];
        gate.suggested_user_questions.forEach((q) => lines.push(`• ${q}`));
        return {
            message: { role: 'assistant', content: lines.join('\n') },
            toolResults: [],
            blocked: true,
            needs: gate.missing,
        };
    }

    // 6. Execute the plan
    try {
        const execResults = await executePlan(plan, context, assets);
        invalidateCache(); // project state changed

        const successCount = execResults.filter((r) => r.result?.success !== false).length;
        return {
            message: {
                role: 'assistant',
                content: `Done! Executed ${successCount} action${successCount !== 1 ? 's' : ''}. Check REAPER for results.`,
            },
            toolResults: execResults.map((r) => ({ tool: r.tool, input: r.args, result: r.result })),
        };
    } catch (err) {
        console.error('[planExecute] Execution error:', err.message);
        return {
            message: {
                role: 'assistant',
                content: `I created a plan but hit an error during execution: ${err.message}`,
            },
            toolResults: [],
        };
    }
}

module.exports = { planExecute, buildAssets };
