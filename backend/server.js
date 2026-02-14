require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const executeRoutes = require('./routes/execute');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/reaper', executeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🧲 Magentic Backend running on http://localhost:${PORT}`);
    console.log(`   API endpoints:`);
    console.log(`   POST /api/chat          — Chat with the AI agent`);
    console.log(`   POST /api/files/upload   — Upload a context file`);
    console.log(`   GET  /api/files          — List uploaded files`);
    console.log(`   POST /api/execute        — Execute code in REAPER`);
    console.log(`   GET  /api/reaper/status  — REAPER connection status`);
    console.log(`   GET  /api/reaper/analyze — Analyze REAPER project`);
    console.log(`   GET  /api/health         — Health check\n`);

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
        console.log(`   ⚠️  No valid OPENAI_API_KEY found. Create backend/.env with your key.\n`);
    }
});
