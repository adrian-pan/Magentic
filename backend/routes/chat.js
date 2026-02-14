const express = require('express');
const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');

const router = express.Router();

// POST /api/chat
router.post('/', async (req, res) => {
    try {
        const { messages, contextFiles } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context from imported files
        let contextBlock = '';
        if (contextFiles && contextFiles.length > 0) {
            contextBlock = '\n\n## Currently Loaded Context Files\n';
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
