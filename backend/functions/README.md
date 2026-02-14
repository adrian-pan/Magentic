# Magentic Functions

Unified API for stem separation (Demucs) and audio-to-MIDI transcription (Basic Pitch).

## Usage

```python
from functions import separate_stems, transcribe_to_midi

# Separate a song into stems (drums, bass, vocals, other)
stems = separate_stems("song.mp3", "output/stems")
# → {"drums": "...", "bass": "...", "vocals": "...", "other": "..."}

# Transcribe a stem to MIDI (saved next to the stem by default)
midi_path = transcribe_to_midi(stems["bass"])
# → "output/stems/SongName/bass_basic_pitch.mid"

# Or specify output directory
midi_path = transcribe_to_midi(stems["bass"], "output/midi")
```

## Setup

```bash
# Install dependencies
pip install -r backend/functions/requirements.txt

# Run from backend/ (so functions is importable)
cd backend
python -c "from functions import separate_stems, transcribe_to_midi; ..."
```

## Structure

- `api.py` - Unified API
- `demucs/` - Demucs (trimmed, stem separation only)
- `basic-pitch/` - Basic Pitch (trimmed, inference only)
- `requirements.txt` - Combined dependencies
