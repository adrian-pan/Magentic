require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const executeRoutes = require('./routes/execute');
const functionRoutes = require('./routes/functions');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/reaper', executeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

// Start server
app.listen(PORT, async () => {
    console.log(`\n🧲 Magentic Backend running on http://localhost:${PORT}`);
    console.log(`   API endpoints:`);
    console.log(`   POST /api/chat          — Chat with the AI agent`);
    console.log(`   POST /api/files/upload        — Upload file (Supabase)`);
    console.log(`   GET  /api/files               — List uploaded files`);
    console.log(`   POST /api/functions/separate-stems    — Stem separation`);
    console.log(`   POST /api/functions/transcribe-to-midi — Audio to MIDI`);
    console.log(`   POST /api/execute        — Execute code in REAPER`);
    console.log(`   GET  /api/reaper/status  — REAPER connection status`);
    console.log(`   GET  /api/reaper/analyze — Analyze REAPER project`);
    console.log(`   GET  /api/reaper/analyze/instruments — List installed instruments`);
    console.log(`   GET  /api/health         — Health check\n`);

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
        console.log(`   ⚠️  No valid OPENAI_API_KEY found. Create backend/.env with your key.\n`);
    }

    try {
        const bridgeRes = await fetch(`${BRIDGE_URL}/status`);
        const bridgeData = await bridgeRes.json();
        if (bridgeData.reaper_connected) {
            console.log(`   ✓ Bridge at ${BRIDGE_URL} — REAPER connected`);
        } else {
            console.log(`   ⚠ Bridge at ${BRIDGE_URL} — REAPER not connected. Start bridge: cd bridge && python main.py`);
        }
    } catch {
        console.log(`   ⚠ Bridge at ${BRIDGE_URL} unreachable. Start it with: cd bridge && python main.py`);
    }

    try {
        const { checkPlannerHealth } = require('./musicPlan/plannerClient');
        const reasoningHealth = await checkPlannerHealth();
        if (reasoningHealth.ok) {
            console.log(`   ✓ Reasoning provider (${reasoningHealth.provider}) — ready`);
        } else {
            console.log(`   ⚠ Reasoning provider (${reasoningHealth.provider}) — ${reasoningHealth.error || 'unreachable'}`);
        }
    } catch (e) {
        console.log(`   ⚠ Reasoning provider health check failed: ${e.message}`);
    }
    console.log('');
});
