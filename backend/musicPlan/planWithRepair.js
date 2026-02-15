/**
 * musicPlan/planWithRepair.js — Orchestrator: planner → validate → repair → needs gate.
 * Optionally auto-resolves needs (e.g. analyze_project, list_stems_for_song) and replans.
 */

const { planMusic } = require('./plannerClient');
const { validatePlan } = require('./validatePlan');
const { evaluateNeeds } = require('./evaluateNeeds');
const { normalizeProjectState } = require('./normalizeProjectState');
const { TOOL_DISPATCH } = require('../agent/tools');

const MAX_REPAIR_ROUNDS = 3;
const MAX_AUTO_RESOLVE = 2;
const JSON_PARSE_RETRY = 1;

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
            return {
                plan: null,
                blocked: true,
                missing: [],
                suggestedQuestions: [`Planner error: ${err.message}`],
            };
        }

        const capabilities = {
            known_fx: (context?.tracks || []).flatMap((t) =>
                (t.fx || [])
                    .map((f) => (typeof f === 'string' ? f : f?.name))
                    .filter(Boolean)
            ),
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
        return {
            plan: null,
            blocked: true,
            missing: [],
            suggestedQuestions: lastErrors.length ? lastErrors : ['Plan validation failed.'],
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
