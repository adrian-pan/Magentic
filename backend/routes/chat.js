const express = require('express');
const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');
const { TOOL_SCHEMAS, TOOL_DISPATCH } = require('../agent/tools');
const fileStore = require('../lib/fileStore');

const router = express.Router();

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

// Helper: fetch project state from bridge
async function getProjectState() {
    try {
        const response = await fetch(`${BRIDGE_URL}/analyze`);
        const data = await response.json();
        if (data.success) return data;
        return null;
    } catch {
        return null;
    }
}

// Max tool-call rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 10;

// POST /api/chat
// POST /api/chat
router.post('/', async (req, res) => {
    try {
        const { messages, contextFiles, includeProjectState, modelSystem } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        // --- Build system prompt ---
        let contextBlock = '';

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

        if (contextFiles && contextFiles.length > 0) {
            contextBlock += '\n\n## Currently Loaded Context Files\n';
            contextFiles.forEach((file) => {
                const storeRecord = file.id ? fileStore.getById(file.id) : null;
                const localPath = storeRecord ? storeRecord.storagePath : null;

                if (file.content != null && file.content !== '') {
                    contextBlock += `\n### ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
                } else {
                    contextBlock += `\n### ${file.name}\n`;
                    if (localPath) contextBlock += `- Local Path: ${localPath}\n`;
                    if (file.url) contextBlock += `- URL: ${file.url}\n`;
                    contextBlock += `- Type: ${file.type || 'binary'}\n`;
                }
            });
        }

        const fullSystemPrompt = SYSTEM_PROMPT + contextBlock;

        // --- Handle Anthropic (Claude) ---
        if (modelSystem === 'anthropic') {
            const { runClaudeConversation } = require('../agent/anthropicClient');
            try {
                // Anthropic SDK handles the loop internally in our helper
                // We pass system prompt separately as required by Anthropic API
                // Filter out system messages from 'messages' array for Anthropic
                const userMessages = messages.filter(m => m.role !== 'system');

                const result = await runClaudeConversation(userMessages, fullSystemPrompt, TOOL_SCHEMAS);

                return res.json({
                    message: {
                        role: 'assistant',
                        content: result.content
                    },
                    toolResults: result.toolResults
                });
            } catch (claudeErr) {
                console.error('Claude API Error:', claudeErr);
                return res.status(500).json({ error: `Claude API Error: ${claudeErr.message}` });
            }
        }

        // --- Handle OpenAI (Default) ---
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const systemMessage = {
            role: 'system',
            content: fullSystemPrompt,
        };

        const conversationMessages = [systemMessage, ...messages];
        const toolResults = [];
        let rounds = 0;

        while (rounds < MAX_TOOL_ROUNDS) {
            rounds++;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: conversationMessages,
                tools: TOOL_SCHEMAS,
                temperature: 0.7,
                max_tokens: 4096,
            });

            const choice = completion.choices[0];
            const assistantMsg = choice.message;

            conversationMessages.push(assistantMsg);

            if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
                return res.json({
                    message: {
                        role: 'assistant',
                        content: assistantMsg.content || '',
                    },
                    usage: completion.usage,
                    toolResults: toolResults.length > 0 ? toolResults : undefined,
                });
            }

            for (const call of assistantMsg.tool_calls) {
                const fn = TOOL_DISPATCH[call.function.name];
                let result;

                if (!fn) {
                    result = { error: `Unknown tool: ${call.function.name}` };
                } else {
                    try {
                        const args = JSON.parse(call.function.arguments);
                        result = await fn(args);
                    } catch (err) {
                        result = { error: err.message };
                    }
                }

                toolResults.push({
                    tool: call.function.name,
                    input: JSON.parse(call.function.arguments),
                    result,
                });

                conversationMessages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result),
                });
            }
        }

        const lastMsg = conversationMessages[conversationMessages.length - 1];
        res.json({
            message: {
                role: 'assistant',
                content: lastMsg.content || 'I completed the requested actions.',
            },
            toolResults,
        });

    } catch (error) {
        console.error('Chat error:', error.message);
        if (error.status === 401) {
            return res.status(401).json({ error: 'Invalid API key. Check your .env file.' });
        }
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

module.exports = router;
