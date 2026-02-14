const express = require('express');
const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');
const { TOOL_SCHEMAS, TOOL_DISPATCH } = require('../agent/tools');

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
router.post('/', async (req, res) => {
    try {
        const { messages, contextFiles, includeProjectState } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build system message with optional context
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
                if (file.content != null && file.content !== '') {
                    contextBlock += `\n### ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
                } else if (file.url) {
                    contextBlock += `\n### ${file.name}\n- Type: ${file.type || 'binary'}\n- URL: ${file.url}\n`;
                }
            });
        }

        const systemMessage = {
            role: 'system',
            content: SYSTEM_PROMPT + contextBlock,
        };

        // Build conversation with function-calling tools
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

            // Append assistant message to conversation
            conversationMessages.push(assistantMsg);

            // If no tool calls, we're done — this is the final text response
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

            // Execute each tool call
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

                // Feed result back to the conversation
                conversationMessages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result),
                });
            }
        }

        // If we hit the limit, return whatever we have
        const lastMsg = conversationMessages[conversationMessages.length - 1];
        res.json({
            message: {
                role: 'assistant',
                content: lastMsg.content || 'I completed the requested actions. Check REAPER to see the results.',
            },
            toolResults,
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
