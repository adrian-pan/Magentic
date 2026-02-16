const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
    uploadToBucket,
    getSupabase,
} = require('../lib/supabase');

const router = express.Router();

const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions');
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const FUNCTIONS_MODAL_URL = process.env.FUNCTIONS_MODAL_URL;
const FUNCTIONS_PROVIDER = process.env.FUNCTIONS_PROVIDER || (FUNCTIONS_MODAL_URL ? 'modal' : (RUNPOD_ENDPOINT_ID && RUNPOD_API_KEY ? 'runpod' : 'local'));
const USE_RUNPOD = FUNCTIONS_PROVIDER === 'runpod' && !!(RUNPOD_ENDPOINT_ID && RUNPOD_API_KEY);
const USE_MODAL = FUNCTIONS_PROVIDER === 'modal' && !!FUNCTIONS_MODAL_URL;

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

function getSongNameFromUrl(url) {
    try {
        const urlPath = decodeURIComponent(new URL(url).pathname);
        const segments = urlPath.split('/').filter(Boolean);
        const last = segments[segments.length - 1] || '';
        // Remove file extension
        let stem = last.replace(/\.[^/.]+$/, '');
        // Strip timestamp prefix added during upload (e.g. "1707123456789-")
        stem = stem.replace(/^\d{10,15}-/, '');
        // Sanitize
        return (stem || 'output').replace(/[^a-zA-Z0-9_-]/g, '_');
    } catch {
        return 'output';
    }
}

async function callRunPod(action, inputUrl, extraInput = {}) {
    const runUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`;
    const res = await fetch(runUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({ input: { action, input_url: inputUrl, ...extraInput } }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`RunPod error ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.output) {
        throw new Error(`RunPod returned no output (status=${data.status || 'unknown'}, id=${data.id || 'n/a'})`);
    }
    if (data.output?.error) throw new Error(data.output.error);
    return data.output;
}

async function callModal(endpoint, body) {
    const url = `${FUNCTIONS_MODAL_URL.replace(/\/$/, '')}/${endpoint}`;
    console.log(`[callModal] POST ${url}`, JSON.stringify(body).slice(0, 200));
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errBody = await res.text();
        console.error(`[callModal] ${endpoint} failed ${res.status}:`, errBody.slice(0, 500));
        throw new Error(`Modal ${endpoint} error ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

// POST /api/functions/separate-stems
router.post('/separate-stems', express.json(), async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    let inputPath;

    try {
        if (!getSupabase()) {
            return res.status(503).json({
                error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to store stems in the bucket.',
            });
        }

        let stems;
        if (USE_MODAL) {
            // Modal can't reach localhost — re-upload to Supabase first
            let modalUrl = url;
            if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)) {
                console.log('[separate-stems] localhost URL detected — re-uploading to Supabase for Modal access');
                let localBuf;
                try {
                    const localRes = await fetch(url);
                    if (!localRes.ok) throw new Error(`${localRes.status}`);
                    localBuf = await localRes.arrayBuffer();
                } catch (fetchErr) {
                    throw new Error(
                        `The audio file is stored locally and is no longer available (${fetchErr.message}). ` +
                        `Please re-upload the file through the Import panel and try again.`
                    );
                }
                const filename = url.split('/').pop().replace(/\?.*$/, '') || 'audio.mp3';
                const storagePath = `uploads/reupload/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { url: supaUrl } = await uploadToBucket(storagePath, Buffer.from(localBuf), 'audio/mpeg');
                modalUrl = supaUrl;
                console.log(`[separate-stems] Re-uploaded to Supabase: ${modalUrl}`);
            }
            // Pre-check: verify the URL is reachable before wasting Modal GPU time
            try {
                const headRes = await fetch(modalUrl, { method: 'HEAD' });
                if (!headRes.ok) {
                    throw new Error(
                        `The audio file URL is not reachable (HTTP ${headRes.status}). ` +
                        `Please re-upload the file and try again. URL: ${modalUrl.slice(0, 120)}`
                    );
                }
            } catch (headErr) {
                if (headErr.message.includes('not reachable')) throw headErr;
                console.warn(`[separate-stems] HEAD check failed (${headErr.message}), proceeding anyway...`);
            }
            const output = await callModal('separate-stems', {
                input_url: modalUrl,
                song_name: getSongNameFromUrl(url),
                supabase_url: process.env.SUPABASE_URL,
                supabase_service_key: process.env.SUPABASE_SERVICE_KEY,
                bucket: 'magentic-files',
            });
            if (output.stem_urls && typeof output.stem_urls === 'object') {
                return res.json({ success: true, stems: output.stem_urls });
            }
            stems = output.stems || {};
        } else if (USE_RUNPOD) {
            const output = await callRunPod('separate_stems', url, {
                supabase_url: process.env.SUPABASE_URL,
                supabase_service_key: process.env.SUPABASE_SERVICE_KEY,
                bucket: 'magentic-files',
                song_name: getSongNameFromUrl(url),
            });
            if (output.stem_urls && typeof output.stem_urls === 'object') {
                return res.json({ success: true, stems: output.stem_urls });
            }
            stems = output.stems || {};
        } else {
            inputPath = await downloadToTemp(url);
            const tempDir = path.dirname(inputPath);
            const outputDir = path.join(tempDir, 'stems');
            fs.mkdirSync(outputDir, { recursive: true });
            const result = await runPythonCli('separate_stems', inputPath, outputDir);
            stems = result.stems || {};
        }

        const songName = (USE_MODAL || USE_RUNPOD) ? getSongNameFromUrl(url) : path.basename(inputPath, path.extname(inputPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uploaded = {};

        for (const [name, data] of Object.entries(stems)) {
            const buf = (USE_MODAL || USE_RUNPOD) ? Buffer.from(data, 'base64') : fs.readFileSync(data);
            const ext = (USE_MODAL || USE_RUNPOD) ? '.mp3' : path.extname(data);
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
    const { url, songName: songNameParam, onset_threshold, frame_threshold, minimum_note_length } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    let inputPath;

    try {
        if (!getSupabase()) {
            return res.status(503).json({
                error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to store MIDI in the bucket.',
            });
        }

        let buf, midiFilename;
        if (USE_MODAL) {
            // Modal can't reach localhost — re-upload to Supabase first
            let modalUrl = url;
            if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)) {
                console.log('[transcribe-to-midi] localhost URL detected — re-uploading to Supabase for Modal access');
                let localBuf;
                try {
                    const localRes = await fetch(url);
                    if (!localRes.ok) throw new Error(`${localRes.status}`);
                    localBuf = await localRes.arrayBuffer();
                } catch (fetchErr) {
                    throw new Error(
                        `The audio file is stored locally and is no longer available (${fetchErr.message}). ` +
                        `Please re-upload the file through the Import panel and try again.`
                    );
                }
                const filename = url.split('/').pop().replace(/\?.*$/, '') || 'audio.mp3';
                const storagePath = `uploads/reupload/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { url: supaUrl } = await uploadToBucket(storagePath, Buffer.from(localBuf), 'audio/mpeg');
                modalUrl = supaUrl;
                console.log(`[transcribe-to-midi] Re-uploaded to Supabase: ${modalUrl}`);
            }
            const modalBody = { input_url: modalUrl };
            if (onset_threshold != null) modalBody.onset_threshold = onset_threshold;
            if (frame_threshold != null) modalBody.frame_threshold = frame_threshold;
            if (minimum_note_length != null) modalBody.minimum_note_length = minimum_note_length;
            const output = await callModal('transcribe-to-midi', modalBody);
            if (!output.midi_base64) throw new Error('MIDI output not found');
            buf = Buffer.from(output.midi_base64, 'base64');
            midiFilename = output.filename || 'output_basic_pitch.mid';
        } else if (USE_RUNPOD) {
            const output = await callRunPod('transcribe_to_midi', url);
            if (!output.midi_base64) throw new Error('MIDI output not found');
            buf = Buffer.from(output.midi_base64, 'base64');
            midiFilename = output.filename || 'output_basic_pitch.mid';
        } else {
            inputPath = await downloadToTemp(url);
            const tempDir = path.dirname(inputPath);
            const outputDir = path.join(tempDir, 'midi');
            fs.mkdirSync(outputDir, { recursive: true });
            const result = await runPythonCli('transcribe_to_midi', inputPath, outputDir);
            const midiPath = result.midi_path;
            if (!midiPath || !fs.existsSync(midiPath)) throw new Error('MIDI output not found');
            buf = fs.readFileSync(midiPath);
            midiFilename = path.basename(midiPath);
        }

        let songName = songNameParam || getSongNameFromUrl(url);
        songName = songName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `${songName}/${midiFilename}`;
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
