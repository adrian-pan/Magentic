const express = require('express');

const router = express.Router();

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

// POST /api/execute — proxy to Python bridge
router.post('/', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'code string is required' });
        }

        const response = await fetch(`${BRIDGE_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Execute error:', error.message);

        if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'Cannot reach the Magentic Bridge. Make sure the Python bridge is running (cd bridge && python main.py).',
            });
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/reaper/status — check bridge + REAPER status
router.get('/status', async (req, res) => {
    try {
        const response = await fetch(`${BRIDGE_URL}/status`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.json({
            reaper_connected: false,
            error: 'Bridge not running',
        });
    }
});

// GET /api/reaper/analyze — analyze current REAPER project
router.get('/analyze', async (req, res) => {
    try {
        const response = await fetch(`${BRIDGE_URL}/analyze`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'Bridge not running. Start it with: cd bridge && python main.py',
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/reaper/delete-midi-item — delete a MIDI item from a track
router.post('/delete-midi-item', async (req, res) => {
    try {
        const { track_index, item_index } = req.body;
        if (track_index == null || item_index == null) {
            return res.status(400).json({ success: false, error: 'track_index and item_index required' });
        }
        const code = `
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
item = RPR.GetTrackMediaItem(track, int(${item_index}))
if item:
    RPR.DeleteTrackMediaItem(track, item)
    print(f"Deleted MIDI item ${item_index} from track ${track_index}")
else:
    raise ValueError(f"No item at index ${item_index} on track ${track_index}")
`;
        const response = await fetch(`${BRIDGE_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/reaper/remove-fx — remove an FX from a track
router.post('/remove-fx', async (req, res) => {
    try {
        const { track_index, fx_index } = req.body;
        if (track_index == null || fx_index == null) {
            return res.status(400).json({ success: false, error: 'track_index and fx_index required' });
        }
        const code = `
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
RPR.TrackFX_Remove(track, int(${fx_index}))
print(f"Removed FX ${fx_index} from track ${track_index}")
`;
        const response = await fetch(`${BRIDGE_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/reaper/analyze/instruments — list installed instruments
router.get('/analyze/instruments', async (req, res) => {
    try {
        const response = await fetch(`${BRIDGE_URL}/analyze/instruments`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'Bridge not running. Start it with: cd bridge && python main.py',
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
