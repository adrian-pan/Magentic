import { useState, useEffect, useCallback } from 'react';
import ChatPanel from './components/ChatPanel';
import ImportPanel from './components/ImportPanel';
import Logo from './components/Logo';

const API_URL = 'http://localhost:3001';

export default function App() {
  const [files, setFiles] = useState([]);
  const [contextFiles, setContextFiles] = useState([]);
  const [projectState, setProjectState] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <Logo size={28} />
          <span className="app-logo-text">MAGENTIC</span>
        </div>
        <div className="app-status">
          <span className="status-text">[SYSTEM: ONLINE]</span>
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
              <span className="panel-title">PROJECT</span>
              <button
                className="analyze-btn"
                onClick={analyzeProject}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? '[SCANNING...]' : '[REFRESH]'}
              </button>
            </div>
            <div className="project-content">
              {projectState ? (
                <>
                  <div className="project-info">
                    <div className="project-info-item">
                      <span className="project-info-label">PROJECT_NAME</span>
                      <span className="project-info-value">{projectState.project.name || 'UNTITLED'}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">BPM</span>
                      <span className="project-info-value">{projectState.project.bpm}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">TRACK_COUNT</span>
                      <span className="project-info-value">{projectState.project.n_tracks}</span>
                    </div>
                    <div className="project-info-item">
                      <span className="project-info-label">DURATION</span>
                      <span className="project-info-value">{Math.floor(projectState.project.length / 60)}:{String(Math.floor(projectState.project.length % 60)).padStart(2, '0')}</span>
                    </div>
                  </div>
                  {projectState.tracks && projectState.tracks.length > 0 && (
                    <div className="track-list">
                      {projectState.tracks.map((track, i) => (
                        <div key={i} className={`track-item ${track.is_muted ? 'muted' : ''}`}>
                          <div className="track-name">{track.name.toUpperCase()}</div>
                          <div className="track-meta">
                            {track.fx.length > 0 && (
                              <span className="track-fx-count">FX:{track.fx.length}</span>
                            )}
                            {track.n_items > 0 && (
                              <span className="track-items-count">ITM:{track.n_items}</span>
                            )}
                            {track.is_muted && <span className="track-muted-badge">[M]</span>}
                            {track.is_solo && <span className="track-solo-badge">[S]</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">!</div>
                  <div className="empty-state-text">
                    [NO_CONNECTION]<br />
                    INITIATE BRIDGE SEQUENCER<br />
                    <code>cd bridge && python main.py</code>
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
