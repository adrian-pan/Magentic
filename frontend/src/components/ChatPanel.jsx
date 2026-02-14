import { useState, useRef, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

const SUGGESTIONS = [
    'Create a drum pattern in REAPER',
    'How do I automate volume in REAPER?',
    'Generate a synth pad Lua script',
    'Explain REAPER FX chains',
];

export default function ChatPanel({ contextFiles }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const autoResize = () => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        }
    };

    const sendMessage = async (text) => {
        const content = text || input.trim();
        if (!content || isLoading) return;

        setError(null);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        const userMessage = { role: 'user', content };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: updatedMessages,
                    contextFiles,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Request failed');
            }

            setMessages([...updatedMessages, data.message]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const renderContent = (text) => {
        // Simple markdown-ish rendering for code blocks
        const parts = text.split(/(```[\s\S]*?```)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```')) {
                const code = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
                return <pre key={i}><code>{code}</code></pre>;
            }
            // Split by inline code
            const inlineParts = part.split(/(`[^`]+`)/g);
            return (
                <span key={i}>
                    {inlineParts.map((ip, j) => {
                        if (ip.startsWith('`') && ip.endsWith('`')) {
                            return <code key={j}>{ip.slice(1, -1)}</code>;
                        }
                        return ip.split('\n').map((line, k, arr) => (
                            <span key={`${j}-${k}`}>
                                {line}
                                {k < arr.length - 1 && <br />}
                            </span>
                        ));
                    })}
                </span>
            );
        });
    };

    return (
        <div className="chat-panel panel">
            <div className="panel-header">
                <span className="panel-title">🤖 AI Agent</span>
                {messages.length > 0 && (
                    <span className="panel-badge">{messages.length} messages</span>
                )}
            </div>

            <div className="chat-messages">
                {messages.length === 0 && !isLoading ? (
                    <div className="welcome-container">
                        <div className="welcome-icon">🧲</div>
                        <h2 className="welcome-title">Welcome to Magentic</h2>
                        <p className="welcome-subtitle">
                            Your AI music production assistant. Ask me anything about REAPER,
                            sound design, or scripting — I'm here to help you create.
                        </p>
                        <div className="welcome-chips">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    className="welcome-chip"
                                    onClick={() => sendMessage(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, i) => (
                            <div key={i} className={`message ${msg.role}`}>
                                <div className="message-avatar">
                                    {msg.role === 'user' ? '👤' : '🧲'}
                                </div>
                                <div className="message-bubble">
                                    {renderContent(msg.content)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message assistant">
                                <div className="message-avatar">🧲</div>
                                <div className="message-bubble">
                                    <div className="typing-indicator">
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div className="error-banner">
                    ⚠️ {error}
                </div>
            )}

            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder="Ask Magentic anything..."
                        value={input}
                        onChange={(e) => { setInput(e.target.value); autoResize(); }}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className="chat-send-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                    >
                        ↑
                    </button>
                </div>
                {contextFiles && contextFiles.length > 0 && (
                    <div className="chat-context-bar">
                        📎 Context:
                        {contextFiles.map((f) => (
                            <span key={f.id} className="context-file-tag">
                                {f.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
