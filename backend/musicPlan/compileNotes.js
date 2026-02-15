/**
 * musicPlan/compileNotes.js — Map MusicPlan MIDI events to add_midi_notes format.
 * Chord symbols → pitch arrays; notes → single pitches. All in beats.
 */

/** Chord symbol → MIDI pitches (root position, octave 4 = 60). C4=60. */
const CHORD_INTERVALS = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    '7': [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dim7: [0, 3, 6, 9],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
};

const ROOT_PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Parse chord symbol (e.g. "Am7", "F#m", "Bb") to root semitone and chord type.
 * @param {string} symbol
 * @returns {{ root: number; type: string }|null}
 */
function parseChordSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return null;
    const s = symbol.trim();
    if (!s.length) return null;

    let i = 0;
    const c = s[i].toUpperCase();
    if (!(c in ROOT_PITCH)) return null;
    let root = ROOT_PITCH[c];
    i++;

    if (s[i] === '#' || s[i] === 'b') {
        root += s[i] === '#' ? 1 : -1;
        i++;
    }
    root = ((root % 12) + 12) % 12;

    const rest = s.slice(i).toLowerCase();
    const type = rest || 'maj';
    return { root, type };
}

/**
 * Chord root + type + octave → array of MIDI pitches.
 * @param {{ root: number; type: string }} parsed
 * @param {number} octave
 * @param {string} voicing - "close"|"open"|"drop2"
 * @returns {number[]}
 */
function chordToPitches(parsed, octave = 4, voicing = 'close') {
    const intervals = CHORD_INTERVALS[parsed.type] || CHORD_INTERVALS.maj;
    const base = 60 + (octave - 4) * 12 + parsed.root;
    let pitches = intervals.map((int) => ((base + int) % 12) + Math.floor((base + int) / 12) * 12);
    pitches = pitches.map((p) => Math.max(0, Math.min(127, p)));

    if (voicing === 'open' && pitches.length >= 3) {
        const [r, t, f, s] = pitches;
        pitches = s != null ? [r, f, t + 12, s + 12] : [r, f, t + 12];
    } else if (voicing === 'drop2' && pitches.length >= 4) {
        pitches = [pitches[1] - 12, pitches[0], pitches[2], pitches[3]];
    }
    return pitches.sort((a, b) => a - b);
}

/**
 * Compile a single event to add_midi_notes note format.
 * @param {object} event - { type, symbol?, start_beat, length_beats, pitch?, velocity?, octave?, voicing? }
 * @param {number} clipStartBeat - clip start in project beats
 * @returns {Array<{ pitch: number; start: number; length: number; velocity: number }>} Notes relative to item start
 */
function compileEvent(event, clipStartBeat = 0) {
    const start = event.start_beat - clipStartBeat;
    const length = Math.max(0.1, event.length_beats ?? 1);
    const velocity = Math.max(1, Math.min(127, event.velocity ?? 100));

    if (event.type === 'note' && typeof event.pitch === 'number') {
        return [{ pitch: event.pitch, start, length, velocity }];
    }

    if (event.type === 'chord' && event.symbol) {
        const parsed = parseChordSymbol(event.symbol);
        if (!parsed) return [];
        const octave = event.octave ?? 4;
        const voicing = event.voicing || 'close';
        const pitches = chordToPitches(parsed, octave, voicing);
        return pitches.map((pitch) => ({ pitch, start, length, velocity }));
    }

    return [];
}

/**
 * Compile all events in a clip to add_midi_notes format.
 * @param {object} clip - { start_beat, length_beats, events }
 * @returns {Array<{ pitch: number; start: number; length: number; velocity: number }>}
 */
function compileClip(clip) {
    if (!clip || !Array.isArray(clip.events)) return [];
    const clipStart = clip.start_beat ?? 0;
    const notes = [];
    for (const ev of clip.events) {
        notes.push(...compileEvent(ev, clipStart));
    }
    return notes;
}

module.exports = {
    parseChordSymbol,
    chordToPitches,
    compileEvent,
    compileClip,
    CHORD_INTERVALS,
    ROOT_PITCH,
};
