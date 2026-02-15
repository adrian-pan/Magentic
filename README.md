# 🧲 Magentic

AI-powered music production assistant with REAPER integration.

## Architecture

```
Magentic/
├── bridge/           Python FastAPI (REAPER via reapy) — port 5001
│   ├── main.py
│   └── requirements.txt
├── backend/          Express + OpenAI — port 3001
│   ├── server.js
│   ├── agent/            ← AI system prompt
│   ├── functions/        ← stem separation + audio-to-MIDI
│   └── routes/
└── frontend/         React (Vite) — port 5173
    └── src/
```

## Setup

### 1. Bridge (REAPER control)

**Requires:** REAPER open, reapy configured.

```bash
cd bridge
pip install -r requirements.txt
python main.py
```

## Live Voice FX Control (v1)

Live mode can **only bypass/enable FX** on a single designated REAPER track named **`BOT_FX`**.

**Project setup:**
- Create track `VOICE_IN`
  - **Record armed**
  - **Input monitoring ON**
  - Input set to your mic
- Create track `BOT_FX`
  - Add a **send from `VOICE_IN` → `BOT_FX`**
  - Turn **`VOICE_IN` master send OFF**
  - **Preload FX on `BOT_FX`** (Valhalla, etc.) and **bypass them by default**
  - Keep **`BOT_FX` master send ON**

**What the bot can do in v1:**
- `get_botfx_state` — list FX + enabled state on `BOT_FX`
- `toggle_botfx_by_name` — enable/disable the first matching FX by name substring
- `panic_botfx` — bypass all FX on `BOT_FX`

### 2. Backend

```bash
cd backend
cp .env.example .env       # add OPENAI_API_KEY, optionally SUPABASE_URL + SUPABASE_SERVICE_KEY
npm install
npm run dev
```

**File storage:** Without Supabase, uploads use local disk. For persistent storage (bucket for stems, MIDI), create a Supabase project, add a Storage bucket `magentic-files`, and set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

**Start order:** Bridge → Backend → Frontend. (Bridge only needed for REAPER features.)

Open **http://localhost:5173** — chatbot on the right, import module on the left.

### Agent execution

When you ask for REAPER actions (e.g. "Create a track", "Add a drum beat"), the backend runs the Python orchestrator (`agents/`), which executes in REAPER via the bridge. The agent responds with a summary of what it did. Ensure REAPER is open and the bridge is running for execution to work.

### Audio functions (stem separation, MIDI transcription)

- **POST /api/functions/separate-stems** — body: `{ "url": "..." }` (audio file URL)
- **POST /api/functions/transcribe-to-midi** — body: `{ "url": "..." }` (audio file URL)

Upload a file via the Import Module, then call these endpoints with the file's `url`. Outputs are stored in Supabase (or returned as local paths if Supabase is not configured).
