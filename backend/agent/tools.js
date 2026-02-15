/**
 * agent/tools.js — REAPER tool definitions for OpenAI function calling.
 *
 * Each tool builds a reapy code snippet and sends it to the Python bridge
 * via HTTP. No Python subprocess needed — just fetch().
 *
 * Bridge must be running at BRIDGE_URL (default http://localhost:5001).
 */

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:5001';
const API_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
const { listBucketFiles, getPublicUrl, getSupabase } = require('../lib/supabase');

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
        const res = await fetch(`${BRIDGE_URL}/analyze`, { signal: controller.signal });
        return await res.json();
    } catch (err) {
        if (err.name === 'AbortError') return { success: false, error: 'Bridge /analyze timed out after 60s' };
        if (err.cause?.code === 'ECONNREFUSED') return { success: false, error: `Cannot reach bridge at ${BRIDGE_URL}. Is it running?` };
        return { success: false, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

async function createTrack({ name, index = -1 }) {
    return runCode(`
import reapy
RPR = reapy.reascript_api
n = RPR.CountTracks(0)
idx = ${index} if ${index} >= 0 else n
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

async function insertMediaToTrack({ file_url, track_index = -1, track_name = 'Audio', position = 0 }) {
    const dlRes = await fetch(`${BRIDGE_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: file_url,
            filename: file_url.split('/').pop().split('?')[0],
        }),
    });
    const dl = await dlRes.json();
    if (!dl.success || !dl.path) {
        return { success: false, error: dl.error || 'Download failed' };
    }

    const trackIdx = track_index;
    const name = track_name;
    const pos = position;
    return runCode(`
import reapy
RPR = reapy.reascript_api
path = ${JSON.stringify(dl.path)}
track_name = ${JSON.stringify(name)}
pos = ${pos}

n = RPR.CountTracks(0)
idx = ${trackIdx} if ${trackIdx} >= 0 else n
if idx >= n:
    RPR.InsertTrackAtIndex(n, True)
    idx = n
track = RPR.GetTrack(0, idx)
RPR.GetSetMediaTrackInfo_String(track, "P_NAME", track_name, True)

# Use AddMediaItemToTrack + PCM_Source for explicit track placement (InsertMedia can be unreliable)
src = RPR.PCM_Source_CreateFromFile(path)
if src:
    item = RPR.AddMediaItemToTrack(track)
    lengthResult = RPR.GetMediaSourceLength(src, False)
    length = lengthResult[0] if isinstance(lengthResult, (list, tuple)) else lengthResult
    RPR.SetMediaItemPosition(item, pos, False)
    RPR.SetMediaItemLength(item, length, False)
    take = RPR.AddTakeToMediaItem(item)
    RPR.SetMediaItemTake_Source(take, src)
    RPR.SetActiveTake(take)
    print("Inserted audio as media item on track", idx, "(" + track_name + ") at", pos, "s")
else:
    # Fallback: select track and use InsertMedia
    for i in range(RPR.CountTracks(0)):
        RPR.SetTrackSelected(RPR.GetTrack(0, i), False)
    RPR.SetTrackSelected(track, True)
    RPR.SetEditCurPos(pos, True, False)
    RPR.InsertMedia(path, 0)
    print("Inserted audio on track", idx, "(fallback)")
`, 90000);
}

// ---------------------------------------------------------------------------
// RunPod / ML function tools (call backend API → RunPod when configured)
// ---------------------------------------------------------------------------

async function separateStems({ file_url }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const res = await fetch(`${API_BASE}/api/functions/separate-stems`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: file_url }),
            signal: controller.signal,
        });
        const data = await res.json();
        clearTimeout(timer);
        if (!res.ok) {
            return { success: false, error: data.error || `HTTP ${res.status}` };
        }
        if (data.error) {
            return { success: false, error: data.error };
        }
        const stems = data.stems || {};
        const names = Object.keys(stems);
        return {
            success: true,
            output: `Separated into ${names.length} stems: ${names.join(', ')}. URLs: ${JSON.stringify(stems)}`,
            stems,
        };
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            return { success: false, error: 'Stem separation timed out (5 min). Try a shorter file.' };
        }
        return { success: false, error: err.message };
    }
}

/** List stems for a song from Supabase. Storage path: {songName}/{stemName}.mp3 */
async function listStemsForSong({ song_name }) {
    try {
        const sb = getSupabase();
        if (!sb) {
            return { success: false, error: 'Supabase not configured.' };
        }
        const safeName = (song_name || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
        if (!safeName) {
            return { success: false, error: 'song_name is required (e.g. Face_Down_Ass_Up)' };
        }
        const files = await listBucketFiles(safeName);
        const stems = {};
        for (const f of files) {
            const stemName = f.name.replace(/\.[^/.]+$/, '');
            stems[stemName] = getPublicUrl(f.path);
        }
        const names = Object.keys(stems);
        return {
            success: true,
            stems,
            output: names.length
                ? `Found ${names.length} stems in ${safeName}/: ${names.join(', ')}. URLs: ${JSON.stringify(stems)}`
                : `No stems found for "${safeName}". Stems are stored at {songName}/{stemName}.mp3 (e.g. ${safeName}/drums.mp3). Run separate_stems first.`,
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function transcribeToMidi({ file_url }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const res = await fetch(`${API_BASE}/api/functions/transcribe-to-midi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: file_url }),
            signal: controller.signal,
        });
        const data = await res.json();
        clearTimeout(timer);
        if (!res.ok) {
            return { success: false, error: data.error || `HTTP ${res.status}` };
        }
        if (data.error) {
            return { success: false, error: data.error };
        }
        return {
            success: true,
            output: `Transcribed to MIDI. URL: ${data.midiUrl}`,
            midiUrl: data.midiUrl,
        };
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            return { success: false, error: 'Transcription timed out (2 min).' };
        }
        return { success: false, error: err.message };
    }
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
    insert_media_to_track: insertMediaToTrack,
    separate_stems: separateStems,
    generate_stems: separateStems,
    list_stems_for_song: listStemsForSong,
    transcribe_to_midi: transcribeToMidi,
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
    {
        type: 'function',
        function: {
            name: 'insert_media_to_track',
            description: 'Insert an audio file as a media item on the timeline (visible waveform). Use for stems, imported files, etc. Creates a track if track_index is -1.',
            parameters: {
                type: 'object',
                properties: {
                    file_url: { type: 'string', description: 'URL of the audio file' },
                    track_index: { type: 'integer', description: 'Track index (0-based). -1 = append new track', default: -1 },
                    track_name: { type: 'string', description: 'Name for the track if creating new', default: 'Audio' },
                    position: { type: 'number', description: 'Start position in seconds on timeline', default: 0 },
                },
                required: ['file_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'separate_stems',
            description: 'Separate an audio file into stems (drums, bass, vocals, other) using AI. Loads stems to Supabase at {songName}/{stemName}.mp3. Returns URLs. Use when user asks to "create stems" or "split stems".',
            parameters: {
                type: 'object',
                properties: {
                    file_url: { type: 'string', description: 'URL of the audio file (from context files)' },
                },
                required: ['file_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_stems',
            description: 'Alias for separate_stems. Create stems and load to Supabase at {songName}/{stemName}.mp3.',
            parameters: {
                type: 'object',
                properties: {
                    file_url: { type: 'string', description: 'URL of the audio file (from context files)' },
                },
                required: ['file_url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_stems_for_song',
            description: 'Retrieve stem URLs from Supabase for a song. Stems stored at {songName}/{stemName}.mp3. Use when user asks to "import stems from X" and stems were already generated.',
            parameters: {
                type: 'object',
                properties: {
                    song_name: { type: 'string', description: 'Song/folder name (e.g. Face_Down_Ass_Up)' },
                },
                required: ['song_name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'transcribe_to_midi',
            description: 'Transcribe an audio file to MIDI using AI (Basic Pitch). Uses RunPod GPU when configured. Requires file_url from context files. Returns URL to MIDI file in Supabase.',
            parameters: {
                type: 'object',
                properties: {
                    file_url: { type: 'string', description: 'URL of the audio file (from context files)' },
                },
                required: ['file_url'],
            },
        },
    },
];

module.exports = { TOOL_SCHEMAS, TOOL_DISPATCH };
