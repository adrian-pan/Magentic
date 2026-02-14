# 🧲 Magentic

AI-powered music production assistant with REAPER integration.

## Architecture

```
Magentic/
├── backend/          Express + OpenAI
│   ├── server.js         ← entry point
│   ├── agent/            ← AI system prompt (REAPER API knowledge)
│   └── routes/           ← /api/chat, /api/files
└── frontend/         React (Vite)
    └── src/
        ├── App.jsx       ← split-panel layout
        └── components/
            ├── ChatPanel.jsx   ← chatbot UI
            └── ImportPanel.jsx ← file import module
```

## Setup

```bash
# 1. Backend
cd backend
cp .env.example .env       # add your OPENAI_API_KEY
npm install
npm run dev

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — chatbot on the right, import module on the left.
