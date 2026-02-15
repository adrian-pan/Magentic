/**
 * musicPlan/planWithRepair.js — Orchestrator: planner → validate → repair → needs gate.
 * Optionally auto-resolves needs (e.g. analyze_project, list_stems_for_song) and replans.
 */

const { planMusic } = require('./plannerClient');
const { validatePlan } = require('./validatePlan');
const { evaluateNeeds } = require('./evaluateNeeds');
const { normalizeProjectState } = require('./normalizeProjectState');
const { TOOL_DISPATCH } = require('../agent/tools');

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

const MAX_REPAIR_ROUNDS = 3;
const MAX_AUTO_RESOLVE = 2;
const JSON_PARSE_RETRY = 1;

/**
 * Fetch installed VST/AU instruments from REAPER via bridge.
 * Returns array of instrument name strings (e.g. "Serum 2 (Xfer Records)").
 */
let _cachedInstruments = null;
let _instrumentsCacheTime = 0;
const INSTRUMENTS_CACHE_TTL = 60_000; // 1 minute

async function getInstalledInstruments() {
    const now = Date.now();
    if (_cachedInstruments && now - _instrumentsCacheTime < INSTRUMENTS_CACHE_TTL) {
        return _cachedInstruments;
    }
    try {
        const res = await fetch(`${BRIDGE_URL}/analyze/instruments`);
        if (!res.ok) return _cachedInstruments || [];
        const data = await res.json();
        if (data.success && Array.isArray(data.instruments)) {
            _cachedInstruments = data.instruments.map((i) => i.name).filter(Boolean);
            _instrumentsCacheTime = now;
            return _cachedInstruments;
        }
    } catch {
        // Bridge unreachable — use cache or empty
    }
    return _cachedInstruments || [];
}

function buildContextRequestQuestions(userText = '') {
    const text = String(userText || '').toLowerCase();
    const questions = [
        'What style/genre and target energy are you going for?',
        'What tempo/key/bar length should I use?',
        'If editing existing parts, which track(s) should I change?',
    ];

    if (/stems?/.test(text)) {
        questions.unshift('Which song name should I use to fetch stems?');
    }
    if (/transcribe|midi/.test(text)) {
        questions.unshift('Can you share the audio file URL (or upload) to transcribe?');
    }
    return questions.slice(0, 3);
}

/**
 * Run auto-resolve tool calls and merge results into assets/context.
 * @param {Array<{ tool: string; args: object }>} resolutions
 * @param {object} context
 * @param {object} assets
 * @returns {Promise<{ context: object; assets: object }>}
 */
async function runAutoResolutions(resolutions, context, assets) {
    let newContext = context;
    let newAssets = { ...assets };

    for (let i = 0; i < Math.min(resolutions.length, MAX_AUTO_RESOLVE); i++) {
        const { tool, args } = resolutions[i];
        const fn = TOOL_DISPATCH[tool];
        if (!fn) continue;

        try {
            const result = await fn(args);

            if (tool === 'analyze_project' && result?.success) {
                newContext = normalizeProjectState(result);
            }
            if (tool === 'list_stems_for_song' && result?.success && result?.stems) {
                const songName = args.song_name || 'unknown';
                newAssets.stems = {
                    song_name: songName,
                    available: Object.keys(result.stems),
                    urls: result.stems,
                };
            }
        } catch (err) {
            console.warn(`[planWithRepair] Auto-resolve ${tool} failed:`, err.message);
        }
    }

    return { context: newContext, assets: newAssets };
}

/**
 * Full plan-with-repair flow.
 * @param {object} opts
 * @param {string} opts.userText
 * @param {object} [opts.rawContext] - Raw bridge /analyze response
 * @param {object} [opts.assets] - { uploaded_files, stems, midi }
 * @returns {Promise<{ plan: object; blocked: boolean; missing: object[]; suggestedQuestions: string[]; autoResolved?: boolean }>}
 */
async function planWithRepair(opts) {
    const { userText, rawContext, assets: initialAssets } = opts;

    let context = normalizeProjectState(rawContext);
    let assets = initialAssets || {
        uploaded_files: [],
        stems: null,
        midi: [],
    };

    let plan = null;
    let validation = { ok: false, errors: [], warnings: [] };
    let repairRound = 0;
    let lastErrors = [];
    let lastWarnings = [];

    let jsonParseRetries = 0;

    while (repairRound < MAX_REPAIR_ROUNDS) {
        repairRound++;
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
                repairRound--;
                continue;
            }
            console.warn('[planWithRepair] Planner call failed:', err.message);
            return {
                plan: null,
                blocked: true,
                missing: [],
                suggestedQuestions: buildContextRequestQuestions(userText),
            };
        }

        // Merge FX already on tracks + installed instruments from REAPER plugin DB
        const trackFx = (context?.tracks || []).flatMap((t) =>
            (t.fx || [])
                .map((f) => (typeof f === 'string' ? f : f?.name))
                .filter(Boolean)
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

    if (!plan || !validation.ok) {
        if (lastErrors.length) {
            console.warn('[planWithRepair] Plan validation failed:', lastErrors.slice(0, 3).join(' | '));
        }
        return {
            plan: null,
            blocked: true,
            missing: [],
            suggestedQuestions: buildContextRequestQuestions(userText),
        };
    }

    const gate = evaluateNeeds(plan, context, assets);

    if (gate.auto_resolutions.length > 0 && plan.execution_policy?.allow_auto_resolve) {
        const { context: newContext, assets: newAssets } = await runAutoResolutions(
            gate.auto_resolutions,
            context,
            assets
        );
        context = newContext;
        assets = newAssets;

        const gateAfter = evaluateNeeds(plan, context, assets);
        if (!gateAfter.blocked && gate.blocked) {
            return {
                plan,
                blocked: false,
                missing: [],
                suggestedQuestions: [],
                autoResolved: true,
                context,
                assets,
            };
        }
    }

    return {
        plan,
        blocked: gate.blocked,
        missing: gate.missing,
        suggestedQuestions: gate.suggested_user_questions,
        context,
        assets,
    };
}

module.exports = { planWithRepair, runAutoResolutions };
