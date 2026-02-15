/**
 * routes/chat.js — Main /api/chat endpoint.
 *
 * Uses the deterministic routeIntent router to decide:
 *   - "direct" → gpt-4o chatbot with tool-calling (fast, ~2-8s)
 *   - "plan"   → reasoning model pipeline (slower, ~10-30s, for creative/compositional)
 *
 * The planner is ONLY called for broad/creative/underspecified requests.
 * Simple direct tasks bypass planning entirely.
 */

const express = require('express');
const { routeIntent } = require('../orchestrator/routeIntent');
const { directExecute } = require('../orchestrator/directExecute');
const { planExecute } = require('../orchestrator/planExecute');

const router = express.Router();

// POST /api/chat
router.post('/', async (req, res) => {
    try {
        const { messages, contextFiles, includeProjectState, modelSystem } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
        const userText = lastUserMsg?.content?.trim() || '';

        // ── Route intent ────────────────────────────────────────────────────
        const route = routeIntent(userText);

        console.log(JSON.stringify({
            event: 'route_decision',
            mode: route.mode,
            reason: route.reason,
            directSignals: route.signals.direct,
            planSignals: route.signals.plan,
            userText: userText.slice(0, 100),
        }));

        // ── Plan path: reasoning model for creative/compositional requests ──
        if (route.mode === 'plan') {
            const result = await planExecute({ userText, contextFiles });

            console.log(JSON.stringify({
                event: 'plan_result',
                blocked: !!result.blocked,
                needsCount: result.needs?.length || 0,
                toolResultsCount: result.toolResults?.length || 0,
            }));

            return res.json(result);
        }

        // ── Direct path: gpt-4o chatbot with tool-calling ──────────────────
        const result = await directExecute({
            userText,
            messages,
            contextFiles,
            includeProjectState,
        });

        console.log(JSON.stringify({
            event: 'direct_result',
            toolResultsCount: result.toolResults?.length || 0,
        }));

        return res.json(result);

    } catch (error) {
        console.error('Chat error:', error.message);
        if (error.status === 401) {
            return res.status(401).json({ error: 'Invalid API key. Check your .env file.' });
        }
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

module.exports = router;
