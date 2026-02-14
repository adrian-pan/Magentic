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

def _run(code: str, timeout: int = 60) -> dict:
    """Send reapy code to the bridge and return the response dict."""
    code = textwrap.dedent(code).strip()
    try:
        resp = requests.post(f"{BRIDGE_URL}/execute", json={"code": code}, timeout=timeout)
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        return {"success": False, "error": f"Bridge timed out after {timeout}s. The operation may still be running in REAPER (e.g. plugin loading)."}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot reach bridge at " + BRIDGE_URL + ". Is it running?"}
    if not resp.text.strip():
        return {"success": False, "error": "Bridge returned an empty response — REAPER may have crashed or disconnected during the operation."}
    try:
        return resp.json()
    except Exception as e:
        return {"success": False, "error": f"Bridge returned invalid JSON: {e}. Raw response: {resp.text[:200]!r}"}


def analyze_project() -> dict:
    """Return the full REAPER project state snapshot."""
    resp = requests.get(f"{BRIDGE_URL}/analyze", timeout=60)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Track tools
# ---------------------------------------------------------------------------

def create_track(name: str, index: int = -1) -> dict:
    """Add a new track to the project. index=-1 appends at end."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        n = RPR.CountTracks(0)
        idx = {index} if {index} >= 0 else n
        RPR.InsertTrackAtIndex(idx, True)
        track = RPR.GetTrack(0, idx)
        RPR.GetSetMediaTrackInfo_String(track, "P_NAME", {name!r}, True)
        print(f"Created track {name!r} at index {{idx}}")
    """
    return _run(code)


def set_track_volume(track_index: int, volume: float) -> dict:
    """Set track volume (0.0–4.0, where 1.0 = 0 dB)."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        RPR.SetMediaTrackInfo_Value(track, "D_VOL", {volume})
        print(f"Track {track_index} volume set to {volume}")
    """
    return _run(code)


def set_track_pan(track_index: int, pan: float) -> dict:
    """Set track pan (-1.0 = full left, 0.0 = center, 1.0 = full right)."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        RPR.SetMediaTrackInfo_Value(track, "D_PAN", {pan})
        print(f"Track {track_index} pan set to {pan}")
    """
    return _run(code)


def mute_track(track_index: int, muted: bool = True) -> dict:
    """Mute or unmute a track."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        RPR.SetMediaTrackInfo_Value(track, "B_MUTE", {1 if muted else 0})
        print(f"Track {track_index} muted={muted!r}")
    """
    return _run(code)


def set_track_color(track_index: int, r: int, g: int, b: int) -> dict:
    """Set the track color using RGB values (0–255 each)."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        color = RPR.ColorToNative({r}, {g}, {b}) | 0x1000000
        RPR.SetMediaTrackInfo_Value(track, "I_CUSTOMCOLOR", color)
        print(f"Track {track_index} color set to rgb({r},{g},{b})")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Tempo / project tools
# ---------------------------------------------------------------------------

def set_tempo(bpm: float) -> dict:
    """Set the project BPM."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        RPR.SetCurrentBPM(0, {bpm}, True)
        print(f"BPM set to {bpm}")
    """
    return _run(code)


def set_time_signature(numerator: int, denominator: int) -> dict:
    """Set the project time signature (e.g. 4/4, 3/4)."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        RPR.TimeMap_SetTimeSigAtTime(0, 0.0, {numerator}, {denominator}, 0.0)
        print(f"Time signature set to {numerator}/{denominator}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# MIDI tools
# ---------------------------------------------------------------------------

def create_midi_item(track_index: int, position: float, length: float) -> dict:
    """Create an empty MIDI item on a track at position (beats) with given length (beats)."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        item = RPR.CreateNewMIDIItemInProj(track, {position}, {position + length}, False)
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
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        item = RPR.GetTrackMediaItem(track, {item_index})
        take = RPR.GetActiveTake(item)
        notes = {notes!r}
        for n in notes:
            start_ppq = RPR.MIDI_GetPPQPosFromProjQN(take, n['start'])
            end_ppq = RPR.MIDI_GetPPQPosFromProjQN(take, n['start'] + n['length'])
            RPR.MIDI_InsertNote(take, False, False, start_ppq, end_ppq, 0, n['pitch'], n.get('velocity', 100), False)
        RPR.MIDI_Sort(take)
        print(f"Added {{len(notes)}} notes to track {track_index} item {item_index}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# FX tools
# ---------------------------------------------------------------------------

def add_fx(track_index: int, fx_name: str) -> dict:
    """Add a VST/AU plugin to a track's FX chain by name."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        # instantiate=True (-1 means add even if already present)
        fx_index = RPR.TrackFX_AddByName(track, {fx_name!r}, False, -1)
        if fx_index < 0:
            print(f"ERROR: Plugin '{fx_name}' not found in REAPER. "
                  "Check the exact name in the FX browser (e.g. 'VST3i: Serum 2 (Xfer Records)').")
        else:
            print(f"Added FX '{fx_name}' to track {track_index} at FX index {{fx_index}}")
    """
    # Use a longer timeout — VST3 plugins can take several seconds to instantiate
    return _run(code, timeout=90)


def set_fx_param(
    track_index: int, fx_index: int, param_name: str, value: float
) -> dict:
    """Set a named parameter on an FX plugin (value 0.0–1.0 normalized).
    Uses substring matching via the RPR API — avoids loading all params into memory."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        n = RPR.TrackFX_GetNumParams(track, {fx_index})
        needle = {param_name.lower()!r}
        found = False
        for i in range(n):
            name = RPR.TrackFX_GetParamName(track, {fx_index}, i, "", 256)[4]
            if needle in name.lower():
                RPR.TrackFX_SetParamNormalized(track, {fx_index}, i, {value})
                print(f"Set {{name}} = {value}")
                found = True
                break
        if not found:
            print(f"Param containing '{param_name}' not found")
    """
    return _run(code)


def list_fx_params(track_index: int, fx_index: int, search: str = "") -> dict:
    """List parameter names for an FX plugin via RPR API (handles large param counts).
    Optionally filtered by a search string."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        n = RPR.TrackFX_GetNumParams(track, {fx_index})
        needle = {search.lower()!r}
        results = []
        for i in range(n):
            name = RPR.TrackFX_GetParamName(track, {fx_index}, i, "", 256)[4]
            if needle in name.lower():
                results.append((i, name))
        print(repr(results))
    """
    return _run(code, timeout=60)


def load_fx_preset(track_index: int, fx_index: int, preset: str) -> dict:
    """Load a preset onto an FX plugin by name or full file path.
    preset can be:
      - A preset name (e.g. 'Init Patch')
      - A full path to a .fxp or .vstpreset file (e.g. '/Users/.../patch.fxp')
    """
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        success = RPR.TrackFX_SetPreset(track, {fx_index}, {preset!r})
        if success:
            print(f"Loaded preset {preset!r} on FX {fx_index}")
        else:
            print(f"Failed to load preset {preset!r} — check name or path")
    """
    return _run(code)


def toggle_fx(track_index: int, fx_index: int, enabled: bool = True) -> dict:
    """Enable or bypass an FX plugin."""
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        RPR.TrackFX_SetEnabled(track, {fx_index}, {str(enabled).lower()})
        print(f"FX {fx_index} on track {track_index} enabled={enabled!r}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Automation / envelope tools
# ---------------------------------------------------------------------------

def create_volume_envelope(track_index: int, points: list[dict]) -> dict:
    """Create volume automation on a track.

    points: list of dicts with keys:
      time  — position in seconds (absolute project time)
      value — volume level 0.0–1.0 (1.0 = 0 dB, 0.0 = silence)

    Example — gradual fade from full to 30% over 2 seconds:
      [{"time": 0.0, "value": 1.0}, {"time": 2.0, "value": 0.3}]
    """
    code = f"""
        import reapy
        RPR = reapy.reascript_api
        track = RPR.GetTrack(0, {track_index})
        env = RPR.GetTrackEnvelopeByName(track, "Volume")
        if not env:
            RPR.SetTrackSelected(track, True)
            RPR.Main_OnCommand(40406, 0)  # Track: Add volume envelope
            env = RPR.GetTrackEnvelopeByName(track, "Volume")
        points = {points!r}
        for pt in points:
            RPR.InsertEnvelopePoint(env, pt['time'], pt['value'], 0, 0, False, True)
        RPR.Envelope_SortPoints(env)
        RPR.UpdateArrange()
        print(f"Added {{len(points)}} volume envelope points to track {track_index}")
    """
    return _run(code)


# ---------------------------------------------------------------------------
# Transport tools
# ---------------------------------------------------------------------------

def play() -> dict:
    """Start REAPER playback."""
    code = """
        import reapy
        reapy.reascript_api.OnPlayButton()
        print('Playback started')
    """
    return _run(code)


def stop() -> dict:
    """Stop REAPER playback."""
    code = """
        import reapy
        reapy.reascript_api.OnStopButton()
        print('Playback stopped')
    """
    return _run(code)


def record() -> dict:
    """Start REAPER recording."""
    code = """
        import reapy
        reapy.reascript_api.OnRecordButton()
        print('Recording started')
    """
    return _run(code)


def set_cursor_position(position: float) -> dict:
    """Move the edit cursor to a position in seconds."""
    code = f"""
        import reapy
        reapy.reascript_api.SetEditCurPos({position}, True, False)
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
        "name": "load_fx_preset",
        "description": "Load a preset onto an FX plugin by name or full file path (.fxp / .vstpreset).",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "fx_index": {"type": "integer"},
                "preset": {"type": "string", "description": "Preset name or absolute file path, e.g. '/Users/you/presets/patch.fxp'"},
            },
            "required": ["track_index", "fx_index", "preset"],
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
        "name": "list_fx_params",
        "description": "List parameter names for an FX plugin, optionally filtered by a search string. Use this before set_fx_param to find the exact parameter name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "fx_index": {"type": "integer"},
                "search": {"type": "string", "description": "Optional filter string, e.g. 'osc b' or 'enable'", "default": ""},
            },
            "required": ["track_index", "fx_index"],
        },
    },
    {
        "name": "set_fx_param",
        "description": "Set a parameter on a track's FX plugin using substring name matching (normalized 0.0–1.0). Use list_fx_params first to find the right name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_index": {"type": "integer"},
                "fx_index": {"type": "integer"},
                "param_name": {"type": "string", "description": "Substring of the parameter name to match, e.g. 'osc b on'"},
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
    "load_fx_preset": load_fx_preset,
    "create_volume_envelope": create_volume_envelope,
    "list_fx_params": list_fx_params,
    "set_fx_param": set_fx_param,
    "set_track_color": set_track_color,
    "play": play,
    "stop": stop,
    "analyze_project": analyze_project,
}
