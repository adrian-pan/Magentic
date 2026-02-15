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
 * Find existing tracks in the project that match plan tracks by name or role.
 * Returns a map: plan track name → existing track index (0-based).
 */
function findExistingTracks(planTracks, contextTracks) {
    const matches = {};
    if (!contextTracks || !planTracks) return matches;

    for (const pt of planTracks) {
        const planName = (pt.name || '').toLowerCase();
        const planRole = (pt.role || '').toLowerCase();

        for (const ct of contextTracks) {
            const ctName = (ct.name || '').toLowerCase();
            // Match by exact name, or name contains role keyword
            if (ctName === planName || ctName.includes(planName) || planName.includes(ctName)) {
                matches[pt.name] = ct.index;
                break;
            }
            // Fallback: match by role keyword in track name
            if (planRole && ctName.includes(planRole)) {
                matches[pt.name] = ct.index;
                break;
            }
        }
    }
    return matches;
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

    // 1.5 Revision cleanup: find existing tracks that match plan tracks
    // and delete their MIDI items + FX before recreating
    const existingMatches = findExistingTracks(plan.tracks, context?.tracks);
    for (const pt of plan.tracks || []) {
        const existIdx = existingMatches[pt.name];
        if (existIdx == null) continue;

        const existTrack = (context?.tracks || []).find((t) => t.index === existIdx);
        if (!existTrack) continue;

        // Delete MIDI items in reverse order (so indices stay valid)
        for (let itemIdx = (existTrack.n_items || 0) - 1; itemIdx >= 0; itemIdx--) {
            await run('delete_midi_item', { track_index: existIdx, item_index: itemIdx });
        }

        // Remove FX in reverse order
        for (let fxIdx = (existTrack.fx?.length || 0) - 1; fxIdx >= 0; fxIdx--) {
            await run('remove_fx', { track_index: existIdx, fx_index: fxIdx });
        }

        // Reuse the existing track instead of creating a new one
        trackIndexMap[pt.name] = existIdx;
    }

    // 2. Create tracks only for those that don't already exist
    const existingCount = context?.n_tracks ?? 0;
    let newTrackOffset = 0;
    for (let i = 0; i < (plan.tracks || []).length; i++) {
        const track = plan.tracks[i];
        if (trackIndexMap[track.name] != null) continue; // already matched & cleaned
        const idx = existingCount + newTrackOffset;
        const r = await run('create_track', { name: track.name, index: -1 });
        if (r?.success !== false) {
            trackIndexMap[track.name] = idx;
            newTrackOffset++;
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
