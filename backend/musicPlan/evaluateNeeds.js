/**
 * musicPlan/evaluateNeeds.js — Needs Gate: deterministic check for missing assets.
 * Blocks execution when required needs are missing; suggests auto-resolve or user questions.
 * Gracefully handles Supabase unavailable.
 */

const { getSupabase } = require('../lib/supabase');

/**
 * @typedef {Object} Need
 * @property {string} id
 * @property {string} type
 * @property {boolean} required
 * @property {string} status
 * @property {string} [reason]
 * @property {object} [proposed_resolution]
 */

/**
 * @typedef {Object} NeedsGateResult
 * @property {boolean} blocked
 * @property {Need[]} missing
 * @property {Array<{ tool: string; args: object }>} auto_resolutions
 * @property {string[]} suggested_user_questions
 */

/**
 * Check if a need can be satisfied from assets or context.
 * @param {Need} need
 * @param {object} context - Normalized project state
 * @param {object} assets - { uploaded_files, stems, midi }
 * @returns {'available'|'resolvable'|'missing'}
 */
function checkNeedStatus(need, context, assets) {
    const { type, status } = need;
    if (status === 'available') return 'available';

    switch (type) {
        case 'project_state':
            if (context && context.tracks) return 'available';
            return 'resolvable'; // analyze_project

        case 'kick_sample_url':
        case 'audio_file_url': {
            const files = assets?.uploaded_files || [];
            const hasAudio = files.some(
                (f) => f.type === 'audio' || (f.url && /\.(wav|mp3|flac|aac|ogg|m4a)$/i.test(f.name || ''))
            );
            if (hasAudio && files.length > 0) return 'available';
            return 'missing';
        }

        case 'stems_for_song': {
            const songName = need.proposed_resolution?.tool_call?.arguments?.song_name;
            if (!songName) return 'missing';
            const sb = getSupabase();
            if (!sb) return 'missing'; // Supabase unavailable
            // We don't sync-check bucket here; auto_resolve will call list_stems_for_song
            return 'resolvable';
        }

        case 'midi_url': {
            const midi = assets?.midi || [];
            if (midi.length > 0) return 'available';
            return 'missing';
        }

        case 'fx_name':
            if (context && context.tracks?.length > 0) return 'resolvable';
            return 'missing';

        default:
            return status === 'unknown' ? 'missing' : 'available';
    }
}

/**
 * Build suggested user question for a missing need.
 */
function questionForNeed(need) {
    switch (need.type) {
        case 'kick_sample_url':
            return 'Provide a kick sample URL for four-on-the-floor, or say "skip drums"';
        case 'audio_file_url':
            return 'Provide an audio file URL to import';
        case 'stems_for_song':
            return `Provide the song name to fetch stems (e.g. "Face_Down_Ass_Up")`;
        case 'midi_url':
            return 'Provide an audio file to transcribe to MIDI, or a MIDI file URL';
        case 'project_state':
            return 'Project state could not be read. Ensure REAPER is open and the bridge is running.';
        case 'fx_name':
            return `Confirm the exact FX/instrument name for "${need.reason || 'the track'}"`;
        default:
            return need.reason || `Missing: ${need.type}`;
    }
}

/**
 * Evaluate needs gate.
 * @param {object} plan - Validated MusicPlan
 * @param {object} context - Normalized project state (from normalizeProjectState)
 * @param {object} assets - { uploaded_files: [{name,url,type}], stems: {song_name, available, urls}, midi: [{name,url}] }
 * @returns {NeedsGateResult}
 */
function evaluateNeeds(plan, context, assets) {
    const missing = [];
    const auto_resolutions = [];
    const suggested_user_questions = [];

    const needs = plan.needs || [];
    const policy = plan.execution_policy || {};
    const allowAuto = policy.allow_auto_resolve !== false;

    for (const need of needs) {
        if (!need.required) continue;

        const status = checkNeedStatus(need, context, assets);

        if (status === 'available') continue;

        if (status === 'resolvable' && allowAuto) {
            const resolution = need.proposed_resolution;
            if (resolution?.strategy === 'call_tool' && resolution.tool_call) {
                auto_resolutions.push({
                    tool: resolution.tool_call.name,
                    args: resolution.tool_call.arguments || {},
                });
                continue;
            }
            if (need.type === 'project_state') {
                auto_resolutions.push({ tool: 'analyze_project', args: {} });
                continue;
            }
        }

        missing.push(need);
        suggested_user_questions.push(questionForNeed(need));
    }

    // Dedupe auto_resolutions (e.g. multiple project_state needs)
    const seen = new Set();
    const uniqueResolutions = auto_resolutions.filter((r) => {
        const key = `${r.tool}:${JSON.stringify(r.args)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const blocked = missing.length > 0 || (uniqueResolutions.length > 0 && !policy.allow_auto_resolve);

    return {
        blocked: missing.length > 0,
        missing,
        auto_resolutions: uniqueResolutions,
        suggested_user_questions: [...new Set(suggested_user_questions)],
    };
}

module.exports = { evaluateNeeds, checkNeedStatus, questionForNeed };
