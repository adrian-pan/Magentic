/**
 * agent/tools.js — REAPER tool definitions for OpenAI function calling.
 *
 * Each tool builds a reapy code snippet and sends it to the Python bridge
 * via HTTP. No Python subprocess needed — just fetch().
 *
 * Bridge must be running at BRIDGE_URL (default http://localhost:5001).
 */

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';

// ---------------------------------------------------------------------------
// Low-level bridge helpers
// ---------------------------------------------------------------------------

async function runCode(code, timeout = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(`${BRIDGE_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code.trim() }),
            signal: controller.signal,
        });
        return await res.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            return { success: false, error: `Bridge timed out after ${timeout / 1000}s` };
        }
        if (err.cause?.code === 'ECONNREFUSED') {
            return { success: false, error: `Cannot reach bridge at ${BRIDGE_URL}. Is it running?` };
        }
        return { success: false, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// Tool implementations — each returns { success, output?, error? }
// ---------------------------------------------------------------------------

async function analyzeProject() {
    try {
        const res = await fetch(`${BRIDGE_URL}/analyze`, { timeout: 60000 });
        return await res.json();
    } catch (err) {
        return { success: false, error: `Cannot reach bridge: ${err.message}` };
    }
}

async function createTrack({ name, index = -1 }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
n = int(RPR.CountTracks(0))
idx = int(${index}) if ${index} >= 0 else n
RPR.InsertTrackAtIndex(idx, True)
track = RPR.GetTrack(0, idx)
RPR.GetSetMediaTrackInfo_String(track, "P_NAME", ${JSON.stringify(name)}, True)
print(f"Created track '${name}' at index {idx}")
    `);
}

async function setTrackVolume({ track_index, volume }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
RPR.SetMediaTrackInfo_Value(track, "D_VOL", ${volume})
print(f"Track ${track_index} volume set to ${volume}")
    `);
}

async function setTrackPan({ track_index, pan }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
RPR.SetMediaTrackInfo_Value(track, "D_PAN", ${pan})
print(f"Track ${track_index} pan set to ${pan}")
    `);
}

async function muteTrack({ track_index, muted = true }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
RPR.SetMediaTrackInfo_Value(track, "B_MUTE", ${muted ? 1 : 0})
print(f"Track ${track_index} muted=${muted}")
    `);
}

async function setTrackColor({ track_index, r, g, b }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
color = RPR.ColorToNative(${r}, ${g}, ${b}) | 0x1000000
RPR.SetMediaTrackInfo_Value(track, "I_CUSTOMCOLOR", color)
print(f"Track ${track_index} color set to rgb(${r},${g},${b})")
    `);
}

async function setTempo({ bpm }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
RPR.SetCurrentBPM(0, ${bpm}, True)
print(f"BPM set to ${bpm}")
    `);
}

async function createMidiItem({ track_index, position, length }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
item = RPR.CreateNewMIDIItemInProj(track, ${position}, ${position + length}, False)
print(f"Created MIDI item on track ${track_index} at pos=${position} len=${length}")
    `);
}

async function addMidiNotes({ track_index, item_index, notes }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
item = RPR.GetTrackMediaItem(track, int(${item_index}))
take = RPR.GetActiveTake(item)
notes = ${JSON.stringify(notes)}
for n in notes:
    start_ppq = int(RPR.MIDI_GetPPQPosFromProjQN(take, n['start']))
    end_ppq = int(RPR.MIDI_GetPPQPosFromProjQN(take, n['start'] + n['length']))
    RPR.MIDI_InsertNote(take, False, False, start_ppq, end_ppq, 0, int(n['pitch']), int(n.get('velocity', 100)), False)
RPR.MIDI_Sort(take)
print(f"Added {len(notes)} notes to track ${track_index} item ${item_index}")
    `);
}

async function addFx({ track_index, fx_name }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
fx_index = int(RPR.TrackFX_AddByName(track, ${JSON.stringify(fx_name)}, False, -1))
if fx_index < 0:
    print(f"ERROR: Plugin '${fx_name}' not found in REAPER. Check the exact name in the FX browser.")
else:
    print(f"Added FX '${fx_name}' to track ${track_index} at FX index {fx_index}")
    `, 90000);
}

async function setFxParam({ track_index, fx_index, param_name, value }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
n = int(RPR.TrackFX_GetNumParams(track, int(${fx_index})))
needle = ${JSON.stringify(param_name.toLowerCase())}
found = False
for i in range(n):
    name = RPR.TrackFX_GetParamName(track, int(${fx_index}), i, "", 256)[4]
    if needle in name.lower():
        RPR.TrackFX_SetParamNormalized(track, int(${fx_index}), i, ${value})
        print(f"Set {name} = ${value}")
        found = True
        break
if not found:
    print(f"Param containing '${param_name}' not found")
    `);
}

async function listFxParams({ track_index, fx_index, search = '' }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, int(${track_index}))
n = int(RPR.TrackFX_GetNumParams(track, int(${fx_index})))
needle = ${JSON.stringify(search.toLowerCase())}
results = []
for i in range(n):
    name = RPR.TrackFX_GetParamName(track, int(${fx_index}), i, "", 256)[4]
    if needle in name.lower():
        results.append((i, name))
print(repr(results))
    `);
}

async function loadFxPreset({ track_index, fx_index, preset }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
success = RPR.TrackFX_SetPreset(track, ${fx_index}, ${JSON.stringify(preset)})
if success:
    print(f"Loaded preset ${preset} on FX ${fx_index}")
else:
    print(f"Failed to load preset ${preset} — check name or path")
    `);
}

async function toggleFx({ track_index, fx_index, enabled = true }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
track = RPR.GetTrack(0, ${track_index})
RPR.TrackFX_SetEnabled(track, ${fx_index}, ${enabled ? 'True' : 'False'})
print(f"FX ${fx_index} on track ${track_index} enabled=${enabled}")
    `);
}

async function play() {
    return runCode(`
import reapy
reapy.reascript_api.OnPlayButton()
print('Playback started')
    `);
}

async function stop() {
    return runCode(`
import reapy
reapy.reascript_api.OnStopButton()
print('Playback stopped')
    `);
}

async function setCursorPosition({ position }) {
    return runCode(`
import reapy
reapy.reascript_api.SetEditCurPos(${position}, True, False)
print(f"Cursor moved to ${position}s")
    `);
}

// ---------------------------------------------------------------------------
// Tool dispatch map
// ---------------------------------------------------------------------------

const TOOL_DISPATCH = {
    analyze_project: analyzeProject,
    create_track: createTrack,
    set_track_volume: setTrackVolume,
    set_track_pan: setTrackPan,
    mute_track: muteTrack,
    set_track_color: setTrackColor,
    set_tempo: setTempo,
    create_midi_item: createMidiItem,
    add_midi_notes: addMidiNotes,
    add_fx: addFx,
    set_fx_param: setFxParam,
    list_fx_params: listFxParams,
    load_fx_preset: loadFxPreset,
    toggle_fx: toggleFx,
    play,
    stop,
    set_cursor_position: setCursorPosition,
};

// ---------------------------------------------------------------------------
// OpenAI tool schemas (function calling format)
// ---------------------------------------------------------------------------

const TOOL_SCHEMAS = [
    {
        type: 'function',
        function: {
            name: 'analyze_project',
            description: 'Read the current REAPER project state (tracks, FX, items, BPM, etc.). Call this first to understand what exists.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_track',
            description: 'Add a new named track to the REAPER project.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Track name' },
                    index: { type: 'integer', description: 'Position to insert (-1 = end)', default: -1 },
                },
                required: ['name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_track_volume',
            description: 'Set a track volume. 1.0 = 0 dB, 0.0 = silence, 2.0 ≈ +6 dB.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    volume: { type: 'number', minimum: 0.0, maximum: 4.0 },
                },
                required: ['track_index', 'volume'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_track_pan',
            description: 'Set a track pan. -1.0 = full left, 0.0 = center, 1.0 = full right.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    pan: { type: 'number', minimum: -1.0, maximum: 1.0 },
                },
                required: ['track_index', 'pan'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'mute_track',
            description: 'Mute or unmute a track.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    muted: { type: 'boolean', default: true },
                },
                required: ['track_index'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_track_color',
            description: 'Set a track color in the REAPER mixer/arranger using RGB.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    r: { type: 'integer', minimum: 0, maximum: 255 },
                    g: { type: 'integer', minimum: 0, maximum: 255 },
                    b: { type: 'integer', minimum: 0, maximum: 255 },
                },
                required: ['track_index', 'r', 'g', 'b'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_tempo',
            description: 'Set the project BPM.',
            parameters: {
                type: 'object',
                properties: {
                    bpm: { type: 'number', minimum: 20, maximum: 300 },
                },
                required: ['bpm'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_midi_item',
            description: 'Create a blank MIDI item on a track at a position (in beats) with a given length (in beats).',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    position: { type: 'number', description: 'Start position in beats' },
                    length: { type: 'number', description: 'Length in beats' },
                },
                required: ['track_index', 'position', 'length'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_midi_notes',
            description: 'Add MIDI notes to an existing MIDI item on a track.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    item_index: { type: 'integer', description: 'Index of the MIDI item on the track' },
                    notes: {
                        type: 'array',
                        description: 'List of notes to add',
                        items: {
                            type: 'object',
                            properties: {
                                pitch: { type: 'integer', description: 'MIDI pitch (C4=60)' },
                                start: { type: 'number', description: 'Start beat relative to item' },
                                length: { type: 'number', description: 'Note length in beats' },
                                velocity: { type: 'integer', default: 100 },
                            },
                            required: ['pitch', 'start', 'length'],
                        },
                    },
                },
                required: ['track_index', 'item_index', 'notes'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_fx',
            description: 'Add a VST/AU plugin to a track by name (e.g. "ReaEQ", "VST3i: Serum 2 (Xfer Records)").',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    fx_name: { type: 'string', description: 'Plugin name as it appears in REAPER FX browser' },
                },
                required: ['track_index', 'fx_name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_fx_param',
            description: 'Set a parameter on a track FX plugin using substring name matching (normalized 0.0–1.0). Use list_fx_params first to find the right name.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    fx_index: { type: 'integer' },
                    param_name: { type: 'string', description: 'Substring of the parameter name to match' },
                    value: { type: 'number', minimum: 0.0, maximum: 1.0 },
                },
                required: ['track_index', 'fx_index', 'param_name', 'value'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_fx_params',
            description: 'List parameter names for an FX plugin, optionally filtered by search string. Use before set_fx_param.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    fx_index: { type: 'integer' },
                    search: { type: 'string', description: 'Optional filter string', default: '' },
                },
                required: ['track_index', 'fx_index'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'load_fx_preset',
            description: 'Load a preset onto an FX plugin by name or full file path.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    fx_index: { type: 'integer' },
                    preset: { type: 'string', description: 'Preset name or absolute file path' },
                },
                required: ['track_index', 'fx_index', 'preset'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'toggle_fx',
            description: 'Enable or bypass an FX plugin on a track.',
            parameters: {
                type: 'object',
                properties: {
                    track_index: { type: 'integer' },
                    fx_index: { type: 'integer' },
                    enabled: { type: 'boolean', default: true },
                },
                required: ['track_index', 'fx_index'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'play',
            description: 'Start REAPER playback.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'stop',
            description: 'Stop REAPER playback.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_cursor_position',
            description: 'Move the edit cursor to a position in seconds.',
            parameters: {
                type: 'object',
                properties: {
                    position: { type: 'number', description: 'Position in seconds' },
                },
                required: ['position'],
            },
        },
    },
];

module.exports = { TOOL_SCHEMAS, TOOL_DISPATCH };
