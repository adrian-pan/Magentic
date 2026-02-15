/**
 * musicPlan/validateSchema.js — AJV-based schema validation for MusicPlan v1.
 * Vendor-agnostic; validates planner output before execution.
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const schema = require('./schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateMusicPlan = ajv.compile(schema);

/**
 * Validate a MusicPlan object against the schema.
 * @param {object} plan - Raw planner output
 * @returns {{ ok: boolean; errors?: string[]; warnings?: string[] }}
 */
function validateSchema(plan) {
    const ok = validateMusicPlan(plan);
    if (ok) {
        return { ok: true };
    }
    const errors = (validateMusicPlan.errors || []).map(
        (e) => `${e.instancePath || '/'} ${e.message}`
    );
    return { ok: false, errors };
}

module.exports = { validateSchema, schema };
