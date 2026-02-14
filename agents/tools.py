"""
agents/tools.py — REAPER tool definitions.

Each tool is:
  1. A Python function that builds reapy code and sends it to the bridge.
  2. A JSON schema entry used in the Anthropic tool-use API so the LLM can
     choose which tools to call and with what arguments.

The bridge must be running at BRIDGE_URL (default http://localhost:5000).
"""

import os
import textwrap
import requests
from typing import Any

BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://localhost:5001")


# ---------------------------------------------------------------------------
# Low-level bridge call
# ---------------------------------------------------------------------------

def _run(code: str) -> dict:
    """Send reapy code to the bridge and return the response dict."""
    code = textwrap.dedent(code).strip()
    resp = requests.post(f"{BRIDGE_URL}/execute", json={"code": code}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def analyze_project() -> dict:
    """Return the full REAPER project state snapshot."""
    resp = requests.get(f"{BRIDGE_URL}/analyze", timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Track tools
# ---------------------------------------------------------------------------

def create_track(name: str, index: int = -1) -> dict:
    """Add a new track to the project. index=-1 appends at end."""
    code = f"""
        project.add_track(index={index})
        track = project.tracks[{index}]
        track.name = {name!r}
        print(f"Created track '{name}' at index {index if index >= 0 else 'end'}")
    """
    return _run(code)


def set_track_volume(track_index: int, volume: float) -> dict:
    """Set track volume (0.0–4.0, where 1.0 = 0 dB)."""
    code = f"""
        track = project.tracks[{track_index}]
        track.volume = {volume}
        print(f"Track {track_index} volume set to {volume}")
    """
    return _run(code)


def set_track_pan(track_index: int, pan: float) -> dict:
    """Set track pan (-1.0 = full left, 0.0 = center, 1.0 = full right)."""
    code = f"""
        track = project.tracks[{track_index}]
        track.pan = {pan}
        print(f"Track {track_index} pan set to {pan}")
    """
    return _run(code)


def mute_track(track_index: int, muted: bool = True) -> dict:
    """Mute or unmute a track."""
    code = f"""
        track = project.tracks[{track_index}]
        track.mute({str(muted).lower()})
        print(f"Track {track_index} muted={muted!r}")
    """
    return _run(code)


def set_track_color(track_index: int, r: int, g: int, b: int) -> dict:
    """Set the track color using RGB values (0–255 each)."""
    code = f"""
        import reapy
        track = project.tracks[{track_index}]
        track.color = reapy.rgb_to_native(({r}, {g}, {b}))
        print(f"Track {track_index} color set to rgb({r},{g},{b})")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Tempo / project tools
# ---------------------------------------------------------------------------

def set_tempo(bpm: float) -> dict:
    """Set the project BPM."""
    code = f"""
        project.bpm = {bpm}
        print(f"BPM set to {bpm}")
    """
    return _run(code)


def set_time_signature(numerator: int, denominator: int) -> dict:
    """Set the project time signature (e.g. 4/4, 3/4)."""
    code = f"""
        import reapy
        reapy.set_proj_ext_state(0, "time_sig", f"{numerator}/{denominator}")
        project.time_signature = ({numerator}, {denominator})
        print(f"Time signature set to {numerator}/{denominator}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# MIDI tools
# ---------------------------------------------------------------------------

def create_midi_item(track_index: int, position: float, length: float) -> dict:
    """Create an empty MIDI item on a track at position (beats) with given length (beats)."""
    code = f"""
        track = project.tracks[{track_index}]
        item = track.add_midi_item(start={position}, end={position + length})
        print(f"Created MIDI item on track {track_index} at pos={position} len={length}")
    """
    return _run(code)


def add_midi_notes(
    track_index: int,
    item_index: int,
    notes: list[dict],
) -> dict:
    """
    Add MIDI notes to an existing MIDI item.

    notes: list of dicts with keys:
      pitch     — MIDI note number (0–127, C4=60)
      start     — start time in beats (relative to item start)
      length    — note length in beats
      velocity  — velocity (0–127, default 100)
    """
    code = f"""
        track = project.tracks[{track_index}]
        item = track.items[{item_index}]
        take = item.active_take
        notes = {notes!r}
        for n in notes:
            take.add_note(
                start=n['start'],
                end=n['start'] + n['length'],
                pitch=n['pitch'],
                velocity=n.get('velocity', 100),
            )
        print(f"Added {{len(notes)}} notes to track {track_index} item {item_index}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# FX tools
# ---------------------------------------------------------------------------

def add_fx(track_index: int, fx_name: str) -> dict:
    """Add a VST/AU plugin to a track's FX chain by name."""
    code = f"""
        track = project.tracks[{track_index}]
        fx = track.add_fx({fx_name!r})
        print(f"Added FX '{fx_name}' to track {track_index}")
    """
    return _run(code)


def set_fx_param(
    track_index: int, fx_index: int, param_name: str, value: float
) -> dict:
    """Set a named parameter on an FX plugin (value 0.0–1.0 normalized)."""
    code = f"""
        track = project.tracks[{track_index}]
        fx = track.fxs[{fx_index}]
        for param in fx.params:
            if param.name.lower() == {param_name.lower()!r}:
                param.normalized = {value}
                print(f"Set {{param.name}} = {value}")
                break
        else:
            print(f"Param '{param_name}' not found on FX {fx_index}")
    """
    return _run(code)


def toggle_fx(track_index: int, fx_index: int, enabled: bool = True) -> dict:
    """Enable or bypass an FX plugin."""
    code = f"""
        track = project.tracks[{track_index}]
        fx = track.fxs[{fx_index}]
        fx.is_enabled = {str(enabled)}
        print(f"FX {fx_index} on track {track_index} enabled={enabled!r}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Transport tools
# ---------------------------------------------------------------------------

def play() -> dict:
    """Start REAPER playback."""
    code = "project.play(); print('Playback started')"
    return _run(code)


def stop() -> dict:
    """Stop REAPER playback."""
    code = "project.stop(); print('Playback stopped')"
    return _run(code)


def record() -> dict:
    """Start REAPER recording."""
    code = "project.record(); print('Recording started')"
    return _run(code)


def set_cursor_position(position: float) -> dict:
    """Move the edit cursor to a position in seconds."""
    code = f"""
        project.cursor_position = {position}
        print(f"Cursor moved to {position}s")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Anthropic tool schemas
# (passed as `tools=` in the anthropic.messages.create call)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS = [
    {
        "name": "create_track",
        "description": "Add a new named track to the REAPER project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Track name"},
                "index": {"type": "integer", "description": "Position to insert (-1 = end)", "default": -1},
            },
            "required": ["name"],
        },
    },
    {
        "name": "set_track_volume",
        "description": "Set a track's volume. 1.0 = 0 dB, 0.0 = silence, 2.0 ≈ +6 dB.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "volume": {"type": "number", "minimum": 0.0, "maximum": 4.0},
            },
            "required": ["track_index", "volume"],
        },
    },
    {
        "name": "set_track_pan",
        "description": "Set a track's stereo pan. -1.0 = full left, 0.0 = center, 1.0 = full right.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "pan": {"type": "number", "minimum": -1.0, "maximum": 1.0},
            },
            "required": ["track_index", "pan"],
        },
    },
    {
        "name": "set_tempo",
        "description": "Set the project BPM.",
        "input_schema": {
            "type": "object",
            "properties": {
                "bpm": {"type": "number", "minimum": 20, "maximum": 300},
            },
            "required": ["bpm"],
        },
    },
    {
        "name": "create_midi_item",
        "description": "Create a blank MIDI item on a track.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "position": {"type": "number", "description": "Start position in beats"},
                "length": {"type": "number", "description": "Length in beats"},
            },
            "required": ["track_index", "position", "length"],
        },
    },
    {
        "name": "add_midi_notes",
        "description": "Add MIDI notes to an existing MIDI item on a track.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "item_index": {"type": "integer", "description": "Index of the MIDI item on the track"},
                "notes": {
                    "type": "array",
                    "description": "List of notes to add",
                    "items": {
                        "type": "object",
                        "properties": {
                            "pitch": {"type": "integer", "description": "MIDI pitch (C4=60)"},
                            "start": {"type": "number", "description": "Start beat relative to item"},
                            "length": {"type": "number", "description": "Note length in beats"},
                            "velocity": {"type": "integer", "default": 100},
                        },
                        "required": ["pitch", "start", "length"],
                    },
                },
            },
            "required": ["track_index", "item_index", "notes"],
        },
    },
    {
        "name": "add_fx",
        "description": "Add a VST/AU plugin to a track by name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "fx_name": {"type": "string", "description": "Plugin name as it appears in REAPER (e.g. 'ReaEQ', 'ReaComp', 'Serum')"},
            },
            "required": ["track_index", "fx_name"],
        },
    },
    {
        "name": "set_fx_param",
        "description": "Set a named parameter on a track's FX plugin (normalized 0.0–1.0).",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "fx_index": {"type": "integer"},
                "param_name": {"type": "string"},
                "value": {"type": "number", "minimum": 0.0, "maximum": 1.0},
            },
            "required": ["track_index", "fx_index", "param_name", "value"],
        },
    },
    {
        "name": "set_track_color",
        "description": "Set a track's color in the REAPER mixer/arranger.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "r": {"type": "integer", "minimum": 0, "maximum": 255},
                "g": {"type": "integer", "minimum": 0, "maximum": 255},
                "b": {"type": "integer", "minimum": 0, "maximum": 255},
            },
            "required": ["track_index", "r", "g", "b"],
        },
    },
    {
        "name": "play",
        "description": "Start REAPER playback.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "stop",
        "description": "Stop REAPER playback.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "analyze_project",
        "description": "Read the current REAPER project state (tracks, FX, items, BPM, etc.).",
        "input_schema": {"type": "object", "properties": {}},
    },
]

# Map tool name → callable function (used by agent dispatch)
TOOL_DISPATCH: dict[str, Any] = {
    "create_track": create_track,
    "set_track_volume": set_track_volume,
    "set_track_pan": set_track_pan,
    "set_tempo": set_tempo,
    "create_midi_item": create_midi_item,
    "add_midi_notes": add_midi_notes,
    "add_fx": add_fx,
    "set_fx_param": set_fx_param,
    "set_track_color": set_track_color,
    "play": play,
    "stop": stop,
    "analyze_project": analyze_project,
}
