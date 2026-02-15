import { useState, useEffect, useCallback } from 'react';
import ChatPanel from './components/ChatPanel';
import ImportPanel from './components/ImportPanel';

const API_URL = 'http://localhost:3001';

export default function App() {
  const [files, setFiles] = useState([]);
  const [contextFiles, setContextFiles] = useState([]);
  const [projectState, setProjectState] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reaperStatus, setReaperStatus] = useState(null);

  // Poll REAPER connection status every 10 seconds
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

  const analyzeProject = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/reaper/analyze`);
      const data = await res.json();
      if (data.success) {
        setProjectState(data);
      }
    } catch {
      // Bridge not running
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Auto-analyze on load
  useEffect(() => {
    analyzeProject();
  }, [analyzeProject]);

  const handleFilesChange = (updatedFiles) => {
    setContextFiles(
      updatedFiles.map(({ id, name, content, url, type }) => ({ id, name, content, url, type }))
    );
  };

  const isOnline = reaperStatus?.reaper_connected === true;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🧲</div>
          <span className="app-logo-text">Magentic</span>
        </div>
        <div className="app-status">
          <div className={`status-dot ${isOnline ? '' : 'offline'}`} />
          {isOnline ? 'Agent Online' : 'Agent Offline'}
        </div>
      </header>

      {/* Main Content — Three-Panel Layout */}
      <main className="app-main">
        {/* Left: Import Module + Project State */}
        <div className="left-sidebar">
          <ImportPanel
            files={files}
            setFiles={setFiles}
            onFilesChange={handleFilesChange}
          />

          {/* Project State Panel */}
          <div className="project-panel">
            <div className="panel-header">
              <span className="panel-title">🎛️ REAPER Project</span>
              <button
                className="analyze-btn"
                onClick={analyzeProject}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? '⏳' : '🔄'} {isAnalyzing ? 'Scanning...' : 'Refresh'}
              </button>
            </div>
            <div className="project-content">
              {projectState ? (
                <>
                  <div className="project-info">
                    <div className="project-info-item">
                      <span className="project-info-label">Project</span>
                      <span className="project-info-value">{projectState.project.name || 'Untitled'}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">BPM</span>
                      <span className="project-info-value">{projectState.project.bpm}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">Tracks</span>
                      <span className="project-info-value">{projectState.project.n_tracks}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">Length</span>
                      <span className="project-info-value">{Math.floor(projectState.project.length / 60)}:{String(Math.floor(projectState.project.length % 60)).padStart(2, '0')}</span>
                    </div>
                  </div>
                  {projectState.tracks && projectState.tracks.length > 0 && (
                    <div className="track-list">
                      {projectState.tracks.map((track, i) => (
                        <div key={i} className={`track-item ${track.is_muted ? 'muted' : ''}`}>
                          <div className="track-name">{track.name}</div>
                          <div className="track-meta">
                            {track.fx.length > 0 && (
                              <span className="track-fx-count">{track.fx.length} FX</span>
                            )}
                            {track.n_items > 0 && (
                              <span className="track-items-count">{track.n_items} items</span>
                            )}
                            {track.is_muted && <span className="track-muted-badge">M</span>}
                            {track.is_solo && <span className="track-solo-badge">S</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: '20px 16px' }}>
                  <div className="empty-state-icon">🎛️</div>
                  <div className="empty-state-text">
                    Connect to REAPER to see your project state. Start the bridge: <code>cd bridge && python main.py</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chatbot */}
        <ChatPanel
          contextFiles={contextFiles}
          projectState={projectState}
          onAnalyze={analyzeProject}
        />
      </main>
    </div>
  );
}
