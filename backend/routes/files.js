const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    getSupabase,
    uploadToBucket,
    downloadFromBucket,
    deleteFromBucket,
} = require('../lib/supabase');
const fileStore = require('../lib/fileStore');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const API_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;

// Multer: memory for Supabase, disk for fallback
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    },
});
const diskUpload = multer({
    storage: diskStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
});

function getFileType(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const audio = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'];
    const text = ['txt', 'md', 'json', 'xml', 'csv', 'lua', 'js', 'py', 'rpp'];
    if (audio.includes(ext)) return 'audio';
    if (text.includes(ext)) return 'text';
    return 'binary';
}

function isTextType(type) {
    return type === 'text';
}

// Single upload handler: use memory if Supabase, else disk
router.post('/upload', (req, res, next) => {
    const useSupabase = !!getSupabase();
    const upload = useSupabase ? memoryUpload.single('file') : diskUpload.single('file');
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { uploadSessionId = 'default' } = req.body || {};
        const type = getFileType(req.file.originalname);
        let url, storagePath, content = null;

        if (getSupabase()) {
            storagePath = `uploads/${uploadSessionId}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            try {
                const result = await uploadToBucket(storagePath, req.file.buffer, req.file.mimetype);
                url = result.url;
            } catch (supabaseErr) {
                console.warn('Supabase upload failed:', supabaseErr.message);
                console.warn('→ Use the service_role key (not anon) in SUPABASE_SERVICE_KEY. Supabase Dashboard → Project Settings → API.');
                // When using Modal for ML functions, we MUST have a public URL —
                // localhost fallback won't work. Retry once before falling back.
                const useModal = process.env.FUNCTIONS_PROVIDER === 'modal' && !!process.env.FUNCTIONS_MODAL_URL;
                if (useModal) {
                    console.warn('[upload] Modal provider requires Supabase — retrying upload once...');
                    try {
                        const result = await uploadToBucket(storagePath, req.file.buffer, req.file.mimetype);
                        url = result.url;
                    } catch (retryErr) {
                        console.error('[upload] Supabase retry also failed:', retryErr.message);
                        // Still fall back to disk but warn loudly
                        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
                        const diskFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                        storagePath = path.join(UPLOAD_DIR, diskFilename);
                        fs.writeFileSync(storagePath, req.file.buffer);
                        url = `${API_BASE}/api/files/download/${diskFilename}`;
                    }
                } else {
                    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
                    const diskFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    storagePath = path.join(UPLOAD_DIR, diskFilename);
                    fs.writeFileSync(storagePath, req.file.buffer);
                    url = `${API_BASE}/api/files/download/${diskFilename}`;
                }
            }
            if (isTextType(type)) {
                try {
                    content = req.file.buffer.toString('utf-8');
                } catch {
                    content = '[Content not readable as text]';
                }
            }
        } else {
            storagePath = req.file.path;
            url = `${API_BASE}/api/files/download/${req.file.filename}`;
            if (isTextType(type)) {
                try {
                    content = fs.readFileSync(storagePath, 'utf-8');
                } catch {
                    content = '[Content not readable as text]';
                }
            }
        }

        const fileEntry = fileStore.add({
            name: req.file.originalname,
            size: req.file.size,
            type,
            storagePath,
            url,
            content: isTextType(type) ? content : null,
            uploadedAt: new Date().toISOString(),
        });

        res.json({
            id: fileEntry.id,
            name: fileEntry.name,
            size: fileEntry.size,
            type: fileEntry.type,
            url: fileEntry.url,
            content: fileEntry.content,
            uploadedAt: fileEntry.uploadedAt,
        });
    } catch (error) {
        console.error('Upload error:', error.message);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// GET /api/files
router.get('/', (req, res) => {
    const fileSummaries = fileStore.list().map(({ id, name, size, type, url, uploadedAt }) => ({
        id,
        name,
        size,
        type,
        url,
        uploadedAt,
    }));
    res.json(fileSummaries);
});

// GET /api/files/download/:filename (for disk fallback - streams raw file)
router.get('/download/:filename', (req, res) => {
    const file = fileStore.list().find((f) => f.storagePath && path.basename(f.storagePath) === req.params.filename);
    if (!file || !fs.existsSync(file.storagePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(path.resolve(file.storagePath));
});

// GET /api/files/:id/content
router.get('/:id/content', async (req, res) => {
    const file = fileStore.getById(req.params.id);
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.json({
        id: file.id,
        name: file.name,
        content: file.content,
        url: file.url,
        type: file.type,
    });
});

// DELETE /api/files/:id
router.delete('/:id', async (req, res) => {
    const removed = fileStore.remove(req.params.id);
    if (!removed) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (getSupabase() && removed.storagePath && !removed.storagePath.startsWith(UPLOAD_DIR)) {
        try {
            await deleteFromBucket(removed.storagePath);
        } catch (err) {
            console.warn('Could not delete from bucket:', err.message);
        }
    } else if (removed.storagePath && fs.existsSync(removed.storagePath)) {
        try {
            fs.unlinkSync(removed.storagePath);
        } catch {}
    }

    res.json({ message: 'File deleted', id: removed.id });
});

module.exports = router;
module.exports.fileStore = fileStore;
