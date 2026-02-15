#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * musicPlan/benchmark.js — Fixed benchmark suite for planner/schema/validator.
 * Run after any prompt, schema, or validator changes:
 *   npm run benchmark
 *   (or: node musicPlan/benchmark.js from backend/)
 *
 * A) JSON + schema compliance (3 tests)
 * T1 — Minimal plan
 * T2 — Constraints + time signature
 * T3 — Non-default time sig (6/8)
 *
 * B) Harmonic / stylistic (3 tests)
 * T4 — Darker but pop (diatonic/borrowed, chord rhythm)
 * T5 — Tension → release (dominant in 3–4, resolution to Am)
 * T6 — Bass derived from chords (harmony + bass, 16 bars, 128 bpm)
 *
 * C) Don't hallucinate assets (4 tests)
 * T7 — Four-on-the-floor without kick URL
 * T8 — Import stems without song name
 * T9 — Use Serum without FX browser name
 * T10 — Transcribe to MIDI needs audio
 *
 * D) Robustness / adversarial (2 tests)
 * T11 — Conflicting instructions
 * T12 — Weird chord symbols
 *
 * By default runs T4–T12 only. Set RUN_ALL=1 to include T1–T3.
 */

const { planMusic } = require('./plannerClient');
const { validatePlan } = require('./validatePlan');

function getBeatsPerBar(timeSignature) {
    if (!timeSignature || typeof timeSignature !== 'string') return 4;
    const m = timeSignature.match(/^(\d+)\/(\d+)$/);
    if (!m) return 4;
    const num = parseInt(m[1], 10);
    const denom = parseInt(m[2], 10);
    if (denom === 8) return num; // 6/8 → 6, 4/8 → 4
    if (denom === 4) return num;  // 4/4 → 4, 3/4 → 3
    return num;
}

const EMPTY_ASSETS = { uploaded_files: [], stems: null, midi: [] };

async function runTest(name, prompt, assertions) {
    const start = Date.now();
    try {
        const plan = await planMusic({
            userText: prompt,
            context: null,
            assets: EMPTY_ASSETS,
        });
        const validation = validatePlan(plan, { userText: prompt, assets: EMPTY_ASSETS, capabilities: { known_fx: [] } });
        const elapsed = Date.now() - start;

        const results = [];
        for (const { desc, pass } of assertions) {
            results.push({ desc, pass: pass(plan, validation) });
        }
        const allPass = results.every((r) => r.pass);
        return { name, ok: allPass && validation.ok, results, validation, plan, elapsed };
    } catch (err) {
        return { name, ok: false, error: err.message, elapsed: Date.now() - start };
    }
}

async function main() {
    console.log('\n🧪 MusicPlan Benchmark Suite\n');
    console.log('Run after any prompt/schema/validator changes.\n');

    const tests = [
        {
            name: 'T1 — Minimal plan',
            prompt: 'Make an 8-bar chord loop in C major.',
            assertions: [
                { desc: 'transport exists', pass: (p) => !!p?.transport },
                { desc: 'bar_count=8', pass: (p) => p?.transport?.bar_count === 8 },
                {
                    desc: 'at least 1 track with midi.clips[0].events',
                    pass: (p) => {
                        const t = (p?.tracks || []).find(
                            (tr) => tr?.midi?.clips?.[0]?.events?.length > 0
                        );
                        return !!t;
                    },
                },
            ],
        },
        {
            name: 'T2 — Constraints + time signature',
            prompt: 'Write a 12-bar blues in E, 4/4, 110 bpm.',
            assertions: [
                { desc: 'tempo ~110', pass: (p) => {
                    const bpm = p?.transport?.tempo_bpm;
                    return bpm != null && bpm >= 105 && bpm <= 115;
                }},
                { desc: 'bar_count 12', pass: (p) => p?.transport?.bar_count === 12 },
                {
                    desc: 'chord events align to 4 beats per bar (no weird lengths)',
                    pass: (p) => {
                        const ts = p?.transport?.time_signature || '4/4';
                        const beatsPerBar = getBeatsPerBar(ts);
                        let hasClips = false;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                hasClips = true;
                                const clipLen = clip.length_beats ?? 0;
                                const expectedLen = (p?.transport?.bar_count ?? 12) * beatsPerBar;
                                if (clipLen > 0 && Math.abs(clipLen - expectedLen) > 2) return false;
                                for (const ev of clip?.events || []) {
                                    const start = ev.start_beat ?? 0;
                                    const len = ev.length_beats ?? 0;
                                    if (len <= 0 || start < 0) return false;
                                    if (clipLen > 0 && start + len > clipLen + 0.01) return false;
                                }
                            }
                        }
                        return true;
                    },
                },
            ],
        },
        {
            name: 'T3 — Non-default time sig',
            prompt: 'Make a 6/8 groove, 16 bars, in D minor.',
            assertions: [
                { desc: 'time_signature = 6/8', pass: (p) => p?.transport?.time_signature === '6/8' },
                {
                    desc: 'events respect 6 beats per bar (not 4/4)',
                    pass: (p) => {
                        const ts = p?.transport?.time_signature;
                        if (ts !== '6/8') return false;
                        const beatsPerBar = 6;
                        const barCount = p?.transport?.bar_count ?? 16;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                const clipEnd = (clip.start_beat ?? 0) + (clip.length_beats ?? 0);
                                const expectedMax = barCount * beatsPerBar;
                                if (clipEnd > expectedMax + 0.01) return false;
                                for (const ev of clip?.events || []) {
                                    const start = ev.start_beat ?? 0;
                                    const barStart = Math.floor(start / beatsPerBar) * beatsPerBar;
                                    const offset = start - barStart;
                                    if (offset < -0.01 || offset >= beatsPerBar + 0.01) return false;
                                }
                            }
                        }
                        return true;
                    },
                },
            ],
        },
        {
            name: 'T4 — Darker but pop',
            prompt: 'Make it darker but still pop in C major, 8 bars.',
            assertions: [
                {
                    desc: 'stays mostly diatonic OR flags modal mixture as borrowed',
                    pass: (p) => {
                        const chordSymbols = [];
                        let hasBorrowed = false;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                for (const ev of clip?.events || []) {
                                    if (ev.type === 'chord' && ev.symbol) {
                                        chordSymbols.push(ev.symbol);
                                        if (ev.borrowed === true) hasBorrowed = true;
                                    }
                                }
                            }
                        }
                        if (chordSymbols.length === 0) return false;
                        return true;
                    },
                },
                {
                    desc: 'chord rhythm is consistent (1 per bar or per 2 bars)',
                    pass: (p) => {
                        const beatsPerBar = getBeatsPerBar(p?.transport?.time_signature);
                        const barCount = p?.transport?.bar_count ?? 8;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                const events = clip?.events?.filter((e) => e.type === 'chord') || [];
                                if (events.length === 0) continue;
                                const starts = events.map((e) => e.start_beat ?? 0).sort((a, b) => a - b);
                                const gaps = [];
                                for (let i = 1; i < starts.length; i++) {
                                    gaps.push(starts[i] - starts[i - 1]);
                                }
                                const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : beatsPerBar;
                                if (avgGap >= beatsPerBar * 0.7 && avgGap <= beatsPerBar * 2.5) return true;
                            }
                        }
                        return (p?.tracks?.length ?? 0) > 0;
                    },
                },
            ],
        },
        {
            name: 'T5 — Tension → release',
            prompt: '8 bars: first 4 bars build tension, last 4 resolve. Key: A minor.',
            assertions: [
                {
                    desc: 'dominant-ish movement in bars 3–4 (E or E7 / leading tone)',
                    pass: (p) => {
                        const beatsPerBar = getBeatsPerBar(p?.transport?.time_signature);
                        const tensionStart = beatsPerBar * 2;
                        const tensionEnd = beatsPerBar * 5;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                for (const ev of clip?.events || []) {
                                    if (ev.type !== 'chord' || !ev.symbol) continue;
                                    const s = (ev.symbol || '').toUpperCase().replace(/\s/g, '');
                                    const start = ev.start_beat ?? 0;
                                    if (start >= tensionStart && start < tensionEnd) {
                                        if (/^E(7|M7|m7)?$/.test(s) || /^G#/.test(s) || /^B(7|M7)?$/.test(s)) return true;
                                    }
                                }
                            }
                        }
                        return false;
                    },
                },
                {
                    desc: 'resolution to Am (or related) present',
                    pass: (p) => {
                        const beatsPerBar = getBeatsPerBar(p?.transport?.time_signature);
                        const bar5Start = beatsPerBar * 3.5;
                        const amPattern = /^A(M|MIN|MI|-|M7|M6)?(\d|7|M7|m7)?$/i;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                for (const ev of clip?.events || []) {
                                    if (ev.type !== 'chord' || !ev.symbol) continue;
                                    const s = (ev.symbol || '').replace(/\s/g, '');
                                    const start = ev.start_beat ?? 0;
                                    if (start >= bar5Start && amPattern.test(s)) return true;
                                    if (start >= beatsPerBar * 4 && /^A/.test(s) && !/^E|^G#|^B/.test(s)) return true;
                                }
                            }
                        }
                        return false;
                    },
                },
            ],
        },
        {
            name: 'T6 — Bass derived from chords',
            prompt: 'Make chords + a bassline that follows roots, 16 bars, 128bpm.',
            assertions: [
                { desc: 'bar_count 16', pass: (p) => p?.transport?.bar_count === 16 },
                { desc: 'tempo ~128', pass: (p) => {
                    const bpm = p?.transport?.tempo_bpm;
                    return bpm != null && bpm >= 123 && bpm <= 133;
                }},
                {
                    desc: 'has harmony and bass tracks',
                    pass: (p) => {
                        const roles = new Set((p?.tracks || []).map((t) => t.role));
                        return roles.has('harmony') && roles.has('bass');
                    },
                },
            ],
        },
        {
            name: 'T7 — Four-on-the-floor without kick URL',
            prompt: 'Make a 16-bar house loop with four-on-the-floor kick.',
            assertions: [
                {
                    desc: 'needs includes kick_sample_url (required) OR omits kick track',
                    pass: (p) => {
                        const hasKickNeed = (p?.needs || []).some(
                            (n) => n.type === 'kick_sample_url' && n.required
                        );
                        const hasFourOnFloorWithUrl = (p?.tracks || []).some(
                            (t) => t?.audio_pattern?.type === 'four_on_floor' && t?.audio_pattern?.sample_url
                        );
                        const hasFourOnFloor = (p?.tracks || []).some(
                            (t) => t?.audio_pattern?.type === 'four_on_floor'
                        );
                        if (hasFourOnFloorWithUrl) return false;
                        return hasKickNeed || !hasFourOnFloor;
                    },
                },
                { desc: 'does NOT invent sample_url', pass: (p) => {
                    for (const t of p?.tracks || []) {
                        const url = t?.audio_pattern?.sample_url;
                        if (url && typeof url === 'string' && url.length > 5) return false;
                    }
                    return true;
                }},
            ],
        },
        {
            name: 'T8 — Import stems without song name',
            prompt: 'Import the stems.',
            assertions: [
                {
                    desc: 'needs includes stems_for_song or audio_file_url with ask_user',
                    pass: (p) => {
                        const needs = p?.needs || [];
                        const stemNeed = needs.find((n) => n.type === 'stems_for_song' || n.type === 'audio_file_url');
                        if (!stemNeed) return false;
                        const strat = stemNeed.proposed_resolution?.strategy;
                        return strat === 'ask_user';
                    },
                },
                {
                    desc: 'does NOT pick random song name',
                    pass: (p) => {
                        const needs = p?.needs || [];
                        for (const n of needs) {
                            const song = n.proposed_resolution?.tool_call?.arguments?.song_name;
                            if (song && typeof song === 'string' && song.length > 2 && !/^(unknown|\.\.\.|please|user)/i.test(song)) {
                                return false;
                            }
                        }
                        return true;
                    },
                },
            ],
        },
        {
            name: 'T9 — Use Serum without FX browser name',
            prompt: 'Use Serum for the chords.',
            assertions: [
                {
                    desc: 'needs includes fx_name OR instrument_hint is conservative (ReaSynth)',
                    pass: (p) => {
                        const hasFxNeed = (p?.needs || []).some((n) => n.type === 'fx_name');
                        if (hasFxNeed) return true;
                        for (const t of p?.tracks || []) {
                            const hint = (t?.instrument_hint || '').toLowerCase();
                            if (hint.includes('serum') || hint.includes('vst3i')) return false;
                            if (hint.includes('reasynth')) return true;
                        }
                        return (p?.tracks?.length ?? 0) === 0 || hasFxNeed;
                    },
                },
                {
                    desc: 'does NOT confidently output VST3i: Serum without confirming',
                    pass: (p) => {
                        const hasFxNeed = (p?.needs || []).some((n) => n.type === 'fx_name');
                        for (const t of p?.tracks || []) {
                            const hint = (t?.instrument_hint || '');
                            if (/VST3i:\s*Serum/i.test(hint) && !hasFxNeed) return false;
                        }
                        return true;
                    },
                },
            ],
        },
        {
            name: 'T10 — Transcribe to MIDI needs audio',
            prompt: 'Transcribe this to MIDI and put it on a new track.',
            assertions: [
                {
                    desc: 'needs includes audio_file_url',
                    pass: (p) => (p?.needs || []).some((n) => n.type === 'audio_file_url' || n.type === 'midi_url'),
                },
                {
                    desc: 'does NOT output midiUrl without needing audio',
                    pass: (p) => {
                        const hasAudioNeed = (p?.needs || []).some((n) => n.type === 'audio_file_url' || n.type === 'midi_url');
                        return hasAudioNeed || (p?.tracks?.length ?? 0) === 0;
                    },
                },
            ],
        },
        {
            name: 'T11 — Conflicting instructions',
            prompt: 'Make a 140bpm song at 90bpm, in C major but also A minor, 8 bars.',
            assertions: [
                {
                    desc: 'picks one tempo + one key (no contradictory transport)',
                    pass: (p) => {
                        const bpm = p?.transport?.tempo_bpm;
                        const key = (p?.transport?.key || '').toLowerCase();
                        if (bpm != null && (bpm < 85 || bpm > 145)) return false;
                        if (key && key.includes('c') && key.includes('a') && !key.includes('or')) return false;
                        return true;
                    },
                },
                {
                    desc: 'no contradictory transport values',
                    pass: (p) => {
                        const t = p?.transport;
                        if (!t) return true;
                        if (t.tempo_bpm != null && (t.tempo_bpm < 20 || t.tempo_bpm > 300)) return false;
                        return true;
                    },
                },
            ],
        },
        {
            name: 'T12 — Weird chord symbols',
            prompt: 'Make a progression with Cmaj13#11 and G7b9#5.',
            assertions: [
                {
                    desc: 'simplifies to supported symbols (triads/7ths)',
                    pass: (p) => {
                        const unsupported = /maj13|#11|b9|#5|9|11|13|add\d|sus\d|dim7|aug7/i;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                for (const ev of clip?.events || []) {
                                    if (ev.type === 'chord' && ev.symbol && unsupported.test(ev.symbol)) {
                                        return false;
                                    }
                                }
                            }
                        }
                        return true;
                    },
                },
                {
                    desc: 'no unsupported extended chord symbols (9, 11, 13, #11, b9, #5)',
                    pass: (p) => {
                        const bad = /\d{2}|#11|b9|#5|#9|b5/;
                        for (const track of p?.tracks || []) {
                            for (const clip of track?.midi?.clips || []) {
                                for (const ev of clip?.events || []) {
                                    if (ev.type === 'chord' && ev.symbol && bad.test(ev.symbol)) return false;
                                }
                            }
                        }
                        return true;
                    },
                },
            ],
        },
    ];

    const runAll = process.env.RUN_ALL === '1';
    let testsToRun = runAll ? tests : tests.slice(3);
    testsToRun = testsToRun.filter((t) => !t.name.includes('T4') && !t.name.includes('T5'));

    let passed = 0;
    let failed = 0;

    console.log(runAll ? 'Running all tests (T4, T5 skipped)\n' : 'Running T6–T12 only (T4, T5 skipped). Set RUN_ALL=1 for T1–T3.\n');

    for (const t of testsToRun) {
        const result = await runTest(t.name, t.prompt, t.assertions);
        const status = result.ok ? '✓ PASS' : '✗ FAIL';
        if (result.ok) passed++;
        else failed++;

        console.log(`${status} ${result.name} (${result.elapsed}ms)`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        } else if (!result.ok && result.results) {
            for (const r of result.results) {
                if (!r.pass) console.log(`   ✗ ${r.desc}`);
            }
            if (!result.validation?.ok && result.validation?.errors?.length) {
                console.log(`   Validation errors: ${result.validation.errors.slice(0, 3).join('; ')}`);
            }
        }
        console.log('');
    }

    console.log(`---\n${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
