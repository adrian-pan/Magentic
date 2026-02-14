const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
    uploadToBucket,
    downloadFromBucket,
    getSupabase,
} = require('../lib/supabase');

const router = express.Router();

const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions');

function getTempDir() {
    const dir = path.join(require('os').tmpdir(), 'magentic', Date.now().toString());
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function downloadToTemp(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = url.split('/').pop().replace(/\?.*$/, '') || 'audio.mp3';
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'audio.mp3';
    const filePath = path.join(getTempDir(), safeName);
    fs.writeFileSync(filePath, buf);
    return filePath;
}

function runPythonCli(action, inputPath, outputDir) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ action, input_path: inputPath, output_dir: outputDir });
        const proc = spawn('python3', [path.join(FUNCTIONS_DIR, 'run_cli.py')], {
            cwd: FUNCTIONS_DIR,
            env: { ...process.env, PYTHONPATH: FUNCTIONS_DIR },
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            try {
                const out = JSON.parse(stdout);
                if (out.error) reject(new Error(out.error));
                else resolve(out);
            } catch (e) {
                reject(new Error(stderr || stdout || `Python exited ${code}`));
            }
        });
        proc.stdin.write(payload);
        proc.stdin.end();
    });
}

function cleanupTemp(dir) {
    try {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true });
        }
    } catch {}
}

// POST /api/functions/separate-stems
router.post('/separate-stems', express.json(), async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    let inputPath;

    try {
        inputPath = await downloadToTemp(url);
        const tempDir = path.dirname(inputPath);
        const outputDir = path.join(tempDir, 'stems');
        fs.mkdirSync(outputDir, { recursive: true });

        const result = await runPythonCli('separate_stems', inputPath, outputDir);
        const stems = result.stems || {};

        if (!getSupabase()) {
            return res.status(503).json({
                error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to store stems in the bucket.',
            });
        }

        const songName = path.basename(inputPath, path.extname(inputPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uploaded = {};

        for (const [name, localPath] of Object.entries(stems)) {
            const buf = fs.readFileSync(localPath);
            const ext = path.extname(localPath);
            const storagePath = `${songName}/${name}${ext}`;
            const { url: stemUrl } = await uploadToBucket(storagePath, buf, 'audio/mpeg');
            uploaded[name] = stemUrl;
        }

        res.json({ success: true, stems: uploaded });
    } catch (err) {
        console.error('separate-stems error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (inputPath) cleanupTemp(path.dirname(inputPath));
    }
});

// POST /api/functions/transcribe-to-midi
router.post('/transcribe-to-midi', express.json(), async (req, res) => {
    const { url, songName: songNameParam } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    let inputPath;

    try {
        inputPath = await downloadToTemp(url);
        const tempDir = path.dirname(inputPath);
        const outputDir = path.join(tempDir, 'midi');
        fs.mkdirSync(outputDir, { recursive: true });

        const result = await runPythonCli('transcribe_to_midi', inputPath, outputDir);
        const midiPath = result.midi_path;

        if (!midiPath || !fs.existsSync(midiPath)) {
            throw new Error('MIDI output not found');
        }

        if (!getSupabase()) {
            return res.status(503).json({
                error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to store MIDI in the bucket.',
            });
        }

        const buf = fs.readFileSync(midiPath);
        let songName = songNameParam;
        if (!songName) {
            try {
                const urlPath = new URL(url).pathname;
                const segments = urlPath.split('/').filter(Boolean);
                songName = segments.length > 1 ? segments[segments.length - 2] : path.basename(inputPath, path.extname(inputPath));
            } catch {
                songName = path.basename(inputPath, path.extname(inputPath));
            }
        }
        songName = songName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `${songName}/${path.basename(midiPath)}`;
        const { url: midiUrl } = await uploadToBucket(storagePath, buf, 'audio/midi');

        res.json({ success: true, midiUrl });
    } catch (err) {
        console.error('transcribe-to-midi error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (inputPath) cleanupTemp(path.dirname(inputPath));
    }
});

module.exports = router;
