import { useState, useRef, useEffect } from 'react';
import Logo from '../components/Logo';

const API_URL = 'http://localhost:3001';

const SUGGESTIONS = [
    'ANALYZE_PROJECT_STRUCTURE',
    'CREATE_TRACK [NAME: BASS]',
    'MIX_TRACK [TARGET: CURRENT]',
    'SET_BPM [VALUE: 140]',
];

export default function ChatPanel({ contextFiles, projectState, onAnalyze }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reaperStatus, setReaperStatus] = useState(null);
    const [executingBlocks, setExecutingBlocks] = useState({});
    const [executeResults, setExecuteResults] = useState({});
    const [modelSystem, setModelSystem] = useState('openai'); // 'openai' or 'anthropic'

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Check REAPER status periodically
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/api/reaper/status`);
                const data = await res.json();
                setReaperStatus(data);
            } catch {
                setReaperStatus({ reaper_connected: false, error: 'Backend unreachable' });
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const autoResize = () => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        }
    };

    const executeCode = async (code, blockId) => {
        setExecutingBlocks((prev) => ({ ...prev, [blockId]: true }));
        setExecuteResults((prev) => ({ ...prev, [blockId]: null }));

        try {
            const res = await fetch(`${API_URL}/api/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            setExecuteResults((prev) => ({ ...prev, [blockId]: data }));

            // After execution, refresh project state
            if (data.success && onAnalyze) {
                setTimeout(() => onAnalyze(), 500);
            }
        } catch (err) {
            setExecuteResults((prev) => ({
                ...prev,
                [blockId]: { success: false, error: err.message },
            }));
        } finally {
            setExecutingBlocks((prev) => ({ ...prev, [blockId]: false }));
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
                    includeProjectState: reaperStatus?.reaper_connected || false,
                    modelSystem,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Request failed');
            }

            setMessages([...updatedMessages, data.message]);

            // Refresh project state after REAPER execution
            if (data.executionResults && onAnalyze) {
                setTimeout(() => onAnalyze(), 500);
            }
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

    const renderContent = (text, messageIdx) => {
        const parts = text.split(/(```(?:python:execute|[a-z]*)\n[\s\S]*?```)/g);
        let blockCounter = 0;

        return parts.map((part, i) => {
            if (part.startsWith('```python:execute')) {
                const code = part.replace(/^```python:execute\n?/, '').replace(/\n?```$/, '');
                const blockId = `${messageIdx}-${blockCounter++}`;
                const isExecuting = executingBlocks[blockId];
                const result = executeResults[blockId];

                return (
                    <div key={i} className="executable-block">
                        <div className="executable-header">
                            <span className="executable-label">[EXEC_BLOCK]</span>
                            <button
                                className={`execute-btn ${isExecuting ? 'executing' : ''} ${result?.success ? 'success' : ''} ${result && !result.success ? 'error' : ''}`}
                                onClick={() => executeCode(code, blockId)}
                                disabled={isExecuting}
                            >
                                {isExecuting ? '[RUNNING...]' : result?.success ? '[RE-RUN]' : result ? '[RETRY]' : '[EXECUTE]'}
                            </button>
                        </div>
                        <pre><code>{code}</code></pre>
                        {result && (
                            <div className={`execute-result ${result.success ? 'success' : 'error'}`}>
                                <div className="execute-result-header">
                                    {result.success ? '>> STDOUT' : '>> STDERR'}
                                </div>
                                <pre>{result.output || result.error}</pre>
                            </div>
                        )}
                    </div>
                );
            }

            if (part.startsWith('```')) {
                const code = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
                return <pre key={i}><code>{code}</code></pre>;
            }

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
                <span className="panel-title">MAGENTIC</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <select
                        className="model-select"
                        value={modelSystem}
                        onChange={(e) => setModelSystem(e.target.value)}
                        style={{
                            background: '#1a1a1a',
                            color: '#00ff9d',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="openai">GPT-4o</option>
                        <option value="anthropic">CLAUDE 3.7</option>
                    </select>
                    {reaperStatus && (
                        <div className={`reaper-status ${reaperStatus.reaper_connected ? 'connected' : 'disconnected'}`}>
                            {reaperStatus.reaper_connected
                                ? `[LINK: ACTIVE] v${reaperStatus.reaper_version}`
                                : '[LINK: OFFLINE]'}
                        </div>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && !isLoading ? (
                    <div className="welcome-container">
                        <div className="welcome-icon">
                            <Logo size={64} />
                        </div>
                        <h2 className="welcome-title">SYSTEM_READY</h2>
                        <p className="welcome-subtitle">
                            MAGENTIC INITIALIZED.<br />
                            AWAITING INPUT FOR AUDIO SEQUENCING OPERATIONS.
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
                                {msg.role !== 'user' && (
                                    <div className="message-avatar">
                                        <Logo size={40} />
                                    </div>
                                )}
                                <div className="message-bubble">
                                    {renderContent(msg.content, i)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message assistant">
                                <div className="message-avatar">
                                    <Logo size={40} />
                                </div>
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
                    [ERROR] {error}
                </div>
            )}

            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder="ENTER_COMMAND..."
                        value={input}
                        onChange={(e) => { setInput(e.target.value); autoResize(); }}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                </div>
                <div className="chat-controls">
                    {contextFiles && contextFiles.length > 0 && (
                        <div className="chat-context-bar">
                            ATTACHMENTS:
                            {contextFiles.map((f) => (
                                <span key={f.id} className="context-file-tag">
                                    [{f.name}]
                                </span>
                            ))}
                        </div>
                    )}
                    <button
                        className="chat-send-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                    >
                        [TRANSMIT]
                    </button>
                </div>
            </div>
        </div>
    );
}
