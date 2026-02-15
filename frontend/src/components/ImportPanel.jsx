import { useState, useRef } from 'react';

const API_URL = 'http://localhost:3001';

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    return `[${ext.toUpperCase()}]`;
}

export default function ImportPanel({ files, setFiles, onFilesChange }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_URL}/api/files/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();

        return {
            id: data.id,
            name: data.name,
            size: data.size,
            type: data.type,
            url: data.url,
            content: data.content ?? null,
            uploadedAt: data.uploadedAt,
        };
    };

    const handleFiles = async (fileList) => {
        setUploading(true);
        try {
            const newFiles = [];
            for (const file of fileList) {
                const uploaded = await uploadFile(file);
                newFiles.push(uploaded);
            }
            const updated = [...files, ...newFiles];
            setFiles(updated);
            onFilesChange(updated);
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await fetch(`${API_URL}/api/files/${id}`, { method: 'DELETE' });
            const updated = files.filter((f) => f.id !== id);
            setFiles(updated);
            onFilesChange(updated);
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    return (
        <div className="import-panel panel">
            <div className="panel-header">
                <span className="panel-title">FILES</span>
            </div>

            <div className="panel-content">
                <div
                    className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="drop-zone-icon">
                        {uploading ? '[...]' : '[+]'}
                    </div>
                    <div className="drop-zone-text">
                        {uploading ? 'UPLOADING_DATA...' : 'INSERT_FILES'}
                    </div>
                    <div className="drop-zone-subtext">
                        CLICK_OR_DRAG
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleFiles(Array.from(e.target.files))}
                    />
                </div>

                {files.length > 0 ? (
                    <div className="file-list">
                        {files.map((file) => (
                            <div key={file.id} className="file-item">
                                <div className="file-icon">{getFileIcon(file.name)}</div>
                                <div className="file-info">
                                    <div className="file-name">{file.name}</div>
                                    <div className="file-meta">{formatSize(file.size)}</div>
                                </div>
                                <button
                                    className="file-delete"
                                    onClick={() => handleDelete(file.id)}
                                    title="Remove file"
                                >
                                    X
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">!</div>
                        <div className="empty-state-text">
                            NO_DATA_LOADED<br />
                            IMPORT_AUDIO_PLUGINS_OR_INSTRUMENTS
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
