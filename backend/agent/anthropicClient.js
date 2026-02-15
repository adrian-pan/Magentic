const Anthropic = require('@anthropic-ai/sdk');
const { TOOL_DISPATCH } = require('./tools');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Convert OpenAI tool schema to Anthropic tool schema.
 * OpenAI: { type: 'function', function: { name, description, parameters } }
 * Anthropic: { name, description, input_schema }
 */
function convertOpenAiToolsToAnthropic(openAiTools) {
    if (!openAiTools) {
        console.warn('convertOpenAiToolsToAnthropic: openAiTools is undefined/null');
        return [];
    }
    return openAiTools.map((t) => {
        if (!t.function) {
            console.warn('convertOpenAiToolsToAnthropic: invalid tool format', t);
            return null;
        }
        return {
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
        };
    }).filter(Boolean);
}

/**
 * Run a conversation with Claude (including tool use loop).
 */
async function runClaudeConversation(messages, systemPrompt, tools) {
    console.log('--- runClaudeConversation START ---');
    console.log('Input tools count:', tools ? tools.length : 'undefined');

    const anthropicTools = convertOpenAiToolsToAnthropic(tools);

    let currentMessages = messages.map(m => {
        if (!m) return null;
        if (m.role === 'system') return null;

        // Handle User messages
        if (m.role === 'user') {
            return { role: 'user', content: m.content || '' };
        }

        // Handle Tool Results (OpenAI 'tool' role -> Anthropic 'user' role with tool_result block)
        if (m.role === 'tool') {
            return {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: m.tool_call_id,
                        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                    }
                ]
            };
        }

        // Handle Assistant messages
        if (m.role === 'assistant') {
            const content = [];

            if (m.content) {
                content.push({ type: 'text', text: m.content });
            }

            if (m.tool_calls && Array.isArray(m.tool_calls)) {
                m.tool_calls.forEach(tc => {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments)
                    });
                });
            }

            if (content.length === 0) return null; // Skip empty assistant messages
            return { role: 'assistant', content };
        }

        return null;
    }).filter(Boolean);

    console.log('Mapped messages count:', currentMessages.length);

    try {
        // Initial call
        const runner = await anthropic.messages.create({
            model: 'claude-3-7-sonnet-20250219',
            max_tokens: 4096,
            system: systemPrompt,
            messages: currentMessages,
            tools: anthropicTools,
        });

        console.log('Claude Initial Response Stop Reason:', runner.stop_reason);

        // Check for tool use
        if (runner.stop_reason === 'tool_use') {
            const assistantContent = runner.content; // This contains text + tool_use blocks

            // We need to return the assistant's message (text + tool calls) to the frontend eventually
            // But first, let's just executing them

            // Append assistant's response to history
            currentMessages.push({ role: 'assistant', content: assistantContent });

            const toolUseBlocks = assistantContent.filter(c => c.type === 'tool_use');
            const toolResultBlocks = [];
            const executedTools = [];

            console.log(`Executing ${toolUseBlocks.length} tools...`);

            for (const toolUse of toolUseBlocks) {
                const fn = TOOL_DISPATCH[toolUse.name];
                let result;
                if (fn) {
                    try {
                        console.log(`Running tool: ${toolUse.name}`);
                        result = await fn(toolUse.input);
                    } catch (e) {
                        result = { error: e.message };
                    }
                } else {
                    result = { error: `Unknown tool: ${toolUse.name}` };
                }

                // Store for API response
                executedTools.push({
                    tool: toolUse.name,
                    input: toolUse.input,
                    result
                });

                // Create tool result block for the next turn
                toolResultBlocks.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result)
                });
            }

            // Send tool results back to Claude
            currentMessages.push({
                role: 'user',
                content: toolResultBlocks
            });

            // Get final response
            const finalResponse = await anthropic.messages.create({
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 4096,
                system: systemPrompt,
                messages: currentMessages,
                tools: anthropicTools,
            });

            return {
                content: finalResponse.content[0].text,
                toolResults: executedTools
            };
        }

        return {
            content: runner.content[0].text,
            toolResults: []
        };
    } catch (err) {
        console.error('CRITICAL CLAUDE ERROR:', err);
        throw err;
    }
}

module.exports = { runClaudeConversation };
