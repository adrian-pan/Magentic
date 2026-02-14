const express = require('express');
const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');
const { wantsExecution, runOrchestrator } = require('../services/orchestrator');

const router = express.Router();

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

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
        const lastMessage = messages[messages.length - 1];
        const userText = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

        // Execute flow: user wants REAPER actions
        if (wantsExecution(userText)) {
            try {
                const execResult = await runOrchestrator(userText);

                // Generate conversational response from execution results
                const responsePrompt = `The user asked: "${userText}"

We executed the following in REAPER:
- Plan: ${JSON.stringify(execResult.plan, null, 2)}
- Results: ${JSON.stringify(execResult.results, null, 2)}
${execResult.errors?.length ? `- Errors: ${JSON.stringify(execResult.errors)}` : ''}

Generate a 2-4 sentence response. Rules:
- Be specific: mention track names, plugin names, BPM, etc. from the results.
- If the results show only analyze_project was called but the requested action (e.g. add_fx, create_track) was never called, say the action was NOT completed and explain why based on the output.
- If any result output contains "ERROR:" or "not found", surface that error verbatim — do not soften it.
- Do not claim success if the tool results do not confirm it.
- End with a helpful follow-up question only if the action succeeded.`;

                const responseCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are Magentic. Summarize REAPER execution results in a friendly, conversational way. Be concise.',
                        },
                        { role: 'user', content: responsePrompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 512,
                });

                const reply = responseCompletion.choices[0].message;

                return res.json({
                    message: reply,
                    usage: responseCompletion.usage,
                    executionResults: execResult,
                });
            } catch (execError) {
                console.error('Orchestrator error:', execError.message);

                return res.json({
                    message: {
                        role: 'assistant',
                        content: `I ran into an error executing that request:\n\n\`\`\`\n${execError.message}\n\`\`\`\n\nMake sure REAPER is open, the bridge is running, and check the plugin name matches exactly what appears in the REAPER FX browser (e.g. \`VST3i: Serum 2 (Xfer Records)\`).`,
                    },
                    executionResults: { errors: [execError.message] },
                });
            }
        }

        // Chat flow: conversational response only
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
                    contextBlock += `\n### ${file.name}\n- Type: ${file.type || 'binary'}\n- URL: ${file.url}\n- Use this URL when the user asks to process, separate stems, or transcribe this file.\n`;
                }
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
