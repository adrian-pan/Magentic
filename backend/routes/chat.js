const express = require('express');
const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');

const router = express.Router();

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5000';

// Helper: fetch project state from bridge
async function getProjectState() {
    try {
        const response = await fetch(`${BRIDGE_URL}/analyze`);
        const data = await response.json();
        if (data.success) {
            return data;
        }
        return null;
    } catch {
        return null;
    }
}

// POST /api/chat
router.post('/', async (req, res) => {
    try {
        const { messages, contextFiles, includeProjectState } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context blocks
        let contextBlock = '';

        // Inject project state if requested
        if (includeProjectState) {
            const projectState = await getProjectState();
            if (projectState) {
                contextBlock += '\n\n## Current REAPER Project State\n';
                contextBlock += '```json\n' + JSON.stringify(projectState, null, 2) + '\n```\n';
                contextBlock += '\nUse this project state to give specific, context-aware advice. Reference track names, FX, and values directly.';
            } else {
                contextBlock += '\n\n> Note: Could not read REAPER project state. Bridge may not be running or REAPER is not open.';
            }
        }

        // Add imported file context
        if (contextFiles && contextFiles.length > 0) {
            contextBlock += '\n\n## Currently Loaded Context Files\n';
            contextFiles.forEach((file) => {
                contextBlock += `\n### ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
            });
        }

        const systemMessage = {
            role: 'system',
            content: SYSTEM_PROMPT + contextBlock,
        };

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [systemMessage, ...messages],
            temperature: 0.7,
            max_tokens: 4096,
        });

        const reply = completion.choices[0].message;

        res.json({
            message: reply,
            usage: completion.usage,
        });
    } catch (error) {
        console.error('Chat error:', error.message);

        if (error.status === 401) {
            return res.status(401).json({ error: 'Invalid OpenAI API key. Check your .env file.' });
        }

        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

module.exports = router;
