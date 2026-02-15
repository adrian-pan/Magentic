/**
 * orchestrator/routeIntent.js — Deterministic rule-based intent router.
 *
 * Scores user text against DIRECT and PLAN signal patterns.
 *   - DIRECT: explicit tool verbs, track/fx indices, plugin names, URLs
 *   - PLAN:   creative/vague adjectives, compositional structures, multi-part generation
 *
 * If planScore > directScore → mode="plan" (reasoning model).
 * Otherwise → mode="direct" (chatbot handles via gpt-4o tool-calling).
 *
 * Template hook: when template matching is added on another branch, insert a
 * TEMPLATE_PATTERNS array and a third score axis. If templateScore > max(plan,direct)
 * return mode="template".
 */

// ── Direct signals: things the chatbot can handle with tool-calling ──────────
const DIRECT_PATTERNS = [
    // Explicit tool verbs
    /\b(set|change)\s+(tempo|bpm)\b/i,
    /\b\d{2,3}\s*bpm\b/i,
    /\b(mute|unmute|solo|unsolo)\b/i,
    /\b(pan|volume|vol|gain)\b/i,
    /\bcreate\s+track\b/i,
    /\bnew\s+track\b/i,
    /\b(add|insert|remove|delete|toggle)\s+(fx|effect|plugin|instrument)\b/i,
    /\b(play|stop|pause|record)\b/i,
    /\b(insert|import)\s+(media|audio|file|sample)\b/i,
    /\bload\s+preset\b/i,
    /\bseparate\s+stems?\b/i,
    /\b(split|extract)\s+stems?\b/i,
    /\btranscribe\s+(to\s+)?midi\b/i,
    /\bset\s+cursor\b/i,
    /\b(arm|disarm)\s+(track|recording)\b/i,
    /\bcolor\s+(track|set)\b/i,
    /\btrack\s+color\b/i,
    // Explicit track/fx/item indices
    /\btrack\s+\d+\b/i,
    /\bfx\s+\d+\b/i,
    /\bitem\s+\d+\b/i,
    // Explicit plugin names
    /\b(ReaEQ|ReaComp|ReaSynth|ReaDelay|ReaVerb|ReaVerbate|ReaSamplOmatic)\b/i,
    /\b(Serum|FabFilter|Kontakt|Pigments|Analog\s*Lab|Splice|FL\s*Studio)\b/i,
    // URL present → user wants to import/use a specific file
    /https?:\/\/\S+/i,
    // Numeric dB values → mixing intent
    /-?\d+(\.\d+)?\s*dB\b/i,
];

// ── Plan signals: broad/creative/compositional requests ─────────────────────
const PLAN_PATTERNS = [
    // Creative/vague adjectives
    /\b(make\s+it|vibe|darker|brighter|uplifting|jazzy|funky|chill|lo-?fi)\b/i,
    /\b(aggressive|dreamy|ethereal|moody|energetic|groovy|cinematic|ambient)\b/i,
    /\bmore\s+(energy|swing|groove|punch|warmth|depth|space|feel)\b/i,
    // Compositional structures
    /\b(chord\s*progression|progression|melody|bassline|bass\s*line)\b/i,
    /\b(arrange|arrangement|orchestrate)\b/i,
    /\b(drop|build|verse|chorus|bridge|intro|outro|hook|breakdown)\b/i,
    /\b(four.on.the.floor|house\s+loop|beat\s+pattern|drum\s+pattern)\b/i,
    // Multi-part generation (multiple elements at once)
    /\b(drums?\s+and\s+bass|chords?\s+and\s+bass|melody\s+and\s+chords?)\b/i,
    /\bmake\s+(a|me)\s+\d+[\s-]bar\b/i,
    /\b\d+[\s-]bar\s+(loop|beat|groove|track)\b/i,
    // Tension/release
    /\b(tension.*release|build.*tension|resolve)\b/i,
];

/**
 * Route user intent to "direct" (chatbot) or "plan" (reasoning model).
 * @param {string} userText
 * @returns {{ mode: 'direct'|'plan', reason: string, signals: { direct: string[], plan: string[] } }}
 */
function routeIntent(userText) {
    const text = (userText || '').trim();
    if (!text) {
        return { mode: 'direct', reason: 'empty input', signals: { direct: [], plan: [] } };
    }

    const directSignals = [];
    const planSignals = [];
    let directScore = 0;
    let planScore = 0;

    for (const pat of DIRECT_PATTERNS) {
        const match = text.match(pat);
        if (match) {
            directSignals.push(match[0]);
            directScore += 2;
        }
    }

    for (const pat of PLAN_PATTERNS) {
        const match = text.match(pat);
        if (match) {
            planSignals.push(match[0]);
            planScore += 2;
        }
    }

    // ── Template hook (future) ──────────────────────────────────────────────
    // const templateScore = matchTemplates(text);
    // if (templateScore > Math.max(directScore, planScore)) return { mode: 'template', ... };

    const mode = planScore > directScore ? 'plan' : 'direct';
    const reason = `direct=${directScore}(${directSignals.length} hits) plan=${planScore}(${planSignals.length} hits) → ${mode}`;

    return { mode, reason, signals: { direct: directSignals, plan: planSignals } };
}

module.exports = { routeIntent, DIRECT_PATTERNS, PLAN_PATTERNS };
