/**
 * orchestrator/directExecute.js — Fast direct execution path.
 *
 * For "direct" routed intents: the chatbot (gpt-4o with tool-calling) handles
 * the request directly. No planner/reasoning model call.
 *
 * This module is a thin wrapper that runs the OpenAI chat completion loop
 * with the existing TOOL_SCHEMAS and TOOL_DISPATCH, skipping the slow
 * planner pipeline entirely.
 *
 * Project state is fetched via cache only when the request references
 * tracks/items/fx by index or name.
 */

const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../agent/systemPrompt');
const { TOOL_SCHEMAS, TOOL_DISPATCH } = require('../agent/tools');
const { runClaudeConversation } = require('../agent/anthropicClient');
const fileStore = require('../lib/fileStore');
const { ensureProjectState, invalidateCache } = require('./projectCache');

const MAX_TOOL_ROUNDS = 10;
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY;

/**
 * Build context block (project state + context files) for system prompt.
 */
async function buildContextBlock(contextFiles) {
    let contextBlock = '';

    const projectState = await ensureProjectState({ needed: true });
    if (projectState) {
        // Compact JSON to reduce token usage (~40% fewer tokens than pretty-printed)
        contextBlock += '\n\n## Current REAPER Project State\n';
        contextBlock += '```json\n' + JSON.stringify(projectState) + '\n```\n';
        contextBlock += '\nUse this project state to give specific, context-aware advice. Reference track names, FX, and values directly.';
    } else {
        contextBlock += '\n\n> Note: Could not read REAPER project state. Bridge may not be running or REAPER is not open.';
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

    return contextBlock;
}

/**
 * Execute via Claude (Anthropic) — used as fallback when OpenAI rate-limits.
 */
async function executeViaClaude({ messages, contextFiles, contextBlock }) {
    console.log('[directExecute] Falling back to Claude (Anthropic)');
    const systemPrompt = SYSTEM_PROMPT + contextBlock;
    const result = await runClaudeConversation(messages, systemPrompt, TOOL_SCHEMAS);

    // Invalidate cache if tools were called
    if (result.toolResults && result.toolResults.length > 0) {
        invalidateCache();
    }

    return {
        message: { role: 'assistant', content: result.content || '' },
        toolResults: result.toolResults?.length > 0 ? result.toolResults : undefined,
    };
}

/**
 * Execute a "direct" intent via gpt-4o tool-calling (no planner).
 * Falls back to Claude on OpenAI 429 rate limits.
 *
 * @param {object} opts
 * @param {string} opts.userText
 * @param {Array} opts.messages - Full conversation messages
 * @param {Array} [opts.contextFiles]
 * @returns {Promise<{ message: object, toolResults?: object[], usage?: object }>}
 */
async function directExecute({ userText, messages, contextFiles }) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const contextBlock = await buildContextBlock(contextFiles);

    const systemMessage = {
        role: 'system',
        content: SYSTEM_PROMPT + contextBlock,
    };

    const conversationMessages = [systemMessage, ...messages];
    const toolResults = [];
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;

        let completion;
        try {
            completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: conversationMessages,
                tools: TOOL_SCHEMAS,
                temperature: 0.7,
                max_tokens: 4096,
            });
        } catch (err) {
            // On rate limit, fall back to Claude if available
            if (err.status === 429 && HAS_ANTHROPIC) {
                console.warn(`[directExecute] OpenAI 429 rate limit — switching to Claude`);
                return executeViaClaude({ messages, contextFiles, contextBlock });
            }
            throw err;
        }

        const choice = completion.choices[0];
        const assistantMsg = choice.message;
        conversationMessages.push(assistantMsg);

        // No tool calls → final text response
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            return {
                message: { role: 'assistant', content: assistantMsg.content || '' },
                usage: completion.usage,
                toolResults: toolResults.length > 0 ? toolResults : undefined,
            };
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

            conversationMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
            });
        }

        // Invalidate project cache after mutations
        invalidateCache();
    }

    // Hit tool-call limit
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return {
        message: {
            role: 'assistant',
            content: lastMsg.content || 'I completed the requested actions. Check REAPER to see the results.',
        },
        toolResults,
    };
}

module.exports = { directExecute };
