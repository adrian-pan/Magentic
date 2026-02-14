const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// In-memory file store (rough draft — no persistence)
let files = [];
let nextId = 1;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/files/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const filePath = req.file.path;
        let content = '';

        try {
            content = fs.readFileSync(filePath, 'utf-8');
        } catch {
            content = '[Binary file — content not readable as text]';
        }

        const fileEntry = {
            id: nextId++,
            name: req.file.originalname,
            size: req.file.size,
            path: filePath,
            content,
            uploadedAt: new Date().toISOString(),
        };

        files.push(fileEntry);

        res.json({
            id: fileEntry.id,
            name: fileEntry.name,
            size: fileEntry.size,
            uploadedAt: fileEntry.uploadedAt,
        });
    } catch (error) {
        console.error('Upload error:', error.message);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// GET /api/files
router.get('/', (req, res) => {
    const fileSummaries = files.map(({ id, name, size, uploadedAt }) => ({
        id,
        name,
        size,
        uploadedAt,
    }));
    res.json(fileSummaries);
});

// GET /api/files/:id/content
router.get('/:id/content', (req, res) => {
    const file = files.find((f) => f.id === parseInt(req.params.id));
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.json({ id: file.id, name: file.name, content: file.content });
});

// DELETE /api/files/:id
router.delete('/:id', (req, res) => {
    const idx = files.findIndex((f) => f.id === parseInt(req.params.id));
    if (idx === -1) {
        return res.status(404).json({ error: 'File not found' });
    }

    const [removed] = files.splice(idx, 1);

    // Clean up the file on disk
    try {
        fs.unlinkSync(removed.path);
    } catch {
        // File might already be gone
    }

    res.json({ message: 'File deleted', id: removed.id });
});

module.exports = router;
