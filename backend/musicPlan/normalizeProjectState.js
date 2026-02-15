/**
 * musicPlan/normalizeProjectState.js — Normalize bridge /analyze output to ProjectContext.
 * Ensures consistent shape for planner and needs gate.
 */

/**
 * Normalize raw bridge analyze response to ProjectContext.
 * @param {object} raw - Response from bridge /analyze
 * @returns {object|null} Normalized context or null if invalid
 */
function normalizeProjectState(raw) {
    if (!raw || !raw.success) return null;

    const project = raw.project || {};
    const tracks = (raw.tracks || []).map((t, i) => ({
        index: t.index ?? i,
        name: t.name || `Track ${i + 1}`,
        fx: (t.fx || []).map((f) => f.name).filter(Boolean),
        items: t.n_items ?? 0,
        volume: t.volume,
        pan: t.pan,
        is_muted: t.is_muted,
        is_solo: t.is_solo,
    }));

    return {
        bpm: project.bpm ?? 120,
        cursor_position: project.cursor_position ?? 0,
        is_playing: project.is_playing ?? false,
        n_tracks: project.n_tracks ?? tracks.length,
        tracks,
    };
}

module.exports = { normalizeProjectState };
