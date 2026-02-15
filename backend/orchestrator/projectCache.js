/**
 * orchestrator/projectCache.js — Cached REAPER project state via bridge /analyze.
 *
 * Avoids hammering the bridge on every request. TTL = 30 seconds.
 * Use ensureProjectState() in direct/plan executors when track info is needed.
 */

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';
const CACHE_TTL = 30_000; // 30 seconds

let _cache = null;
let _cacheTime = 0;

/**
 * Fetch project state from bridge, using cache if fresh.
 * @param {{ force?: boolean }} opts
 * @returns {Promise<object|null>}
 */
async function getProjectState({ force = false } = {}) {
    const now = Date.now();
    if (!force && _cache && now - _cacheTime < CACHE_TTL) {
        return _cache;
    }
    try {
        const res = await fetch(`${BRIDGE_URL}/analyze`);
        const data = await res.json();
        if (data.success) {
            _cache = data;
            _cacheTime = now;
            return data;
        }
    } catch {
        // Bridge unreachable — return stale cache or null
    }
    return _cache || null;
}

/**
 * Ensure project state is loaded if needed.
 * @param {{ force?: boolean, needed?: boolean }} opts
 *   - force: bypass cache
 *   - needed: if false, skip entirely (returns null)
 * @returns {Promise<object|null>}
 */
async function ensureProjectState({ force = false, needed = true } = {}) {
    if (!needed) return _cache || null;
    return getProjectState({ force });
}

/**
 * Invalidate cache (e.g. after mutations).
 */
function invalidateCache() {
    _cache = null;
    _cacheTime = 0;
}

module.exports = { getProjectState, ensureProjectState, invalidateCache };
