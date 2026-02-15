/**
 * musicPlan — Planner → Validator → Needs Gate → Executor pipeline.
 * Modular, vendor-agnostic, no Python orchestrator dependency.
 */

const { validateSchema } = require('./validateSchema');
const { validatePlan } = require('./validatePlan');
const { normalizeProjectState } = require('./normalizeProjectState');
const { evaluateNeeds } = require('./evaluateNeeds');
const { planMusic } = require('./plannerClient');
const { planWithRepair } = require('./planWithRepair');
const { executePlan } = require('./executor');
const { compileClip, compileEvent, parseChordSymbol } = require('./compileNotes');

module.exports = {
    validateSchema,
    validatePlan,
    normalizeProjectState,
    evaluateNeeds,
    planMusic,
    planWithRepair,
    executePlan,
    compileClip,
    compileEvent,
    parseChordSymbol,
};
