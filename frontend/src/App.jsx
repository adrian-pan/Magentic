import { useState } from 'react';
import ChatPanel from './components/ChatPanel';
import ImportPanel from './components/ImportPanel';

export default function App() {
  const [files, setFiles] = useState([]);
  const [contextFiles, setContextFiles] = useState([]);

  const handleFilesChange = (updatedFiles) => {
    // Pass file content summaries to the chat panel for context
    setContextFiles(
      updatedFiles.map(({ id, name, content }) => ({ id, name, content }))
    );
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🧲</div>
          <span className="app-logo-text">Magentic</span>
        </div>
        <div className="app-status">
          <div className="status-dot" />
          Agent Online
        </div>
      </header>

      {/* Main Content — Split Panel */}
      <main className="app-main">
        <ImportPanel
          files={files}
          setFiles={setFiles}
          onFilesChange={handleFilesChange}
        />
        <ChatPanel contextFiles={contextFiles} />
      </main>
    </div>
  );
}
