/**
 * musicPlan/validatePlan.js — Timing and chord constraints beyond schema.
 * Ensures events fit within clips, transport is sane, and needs are coherent.
 */

const { validateSchema } = require('./validateSchema');

/**
 * Validate timing: events must fit within their clip bounds.
 * @param {object} plan
 * @returns {{ ok: boolean; errors: string[]; warnings: string[] }}
 */
function validateTiming(plan) {
    const errors = [];
    const warnings = [];

    for (const track of plan.tracks || []) {
        const midi = track.midi;
        if (!midi || !midi.clips) continue;

        for (let c = 0; c < midi.clips.length; c++) {
            const clip = midi.clips[c];
            const clipStart = clip.start_beat ?? 0;
            const clipEnd = clipStart + (clip.length_beats ?? 0);

            if (clip.length_beats <= 0) {
                errors.push(`Track "${track.name}" clip ${c}: length_beats must be > 0`);
            }

            for (let e = 0; e < (clip.events || []).length; e++) {
                const ev = clip.events[e];
                const evStart = ev.start_beat ?? 0;
                const evLen = ev.length_beats ?? 0.25;
                const evEnd = evStart + evLen;

                if (evStart < clipStart) {
                    errors.push(
                        `Track "${track.name}" clip ${c} event ${e}: start_beat ${evStart} < clip start ${clipStart}`
                    );
                }
                if (evEnd > clipEnd) {
                    errors.push(
                        `Track "${track.name}" clip ${c} event ${e}: end ${evEnd} > clip end ${clipEnd}`
                    );
                }
            }
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Get beats per bar from time signature (e.g. 4/4 → 4, 6/8 → 6).
 */
function getBeatsPerBar(timeSignature) {
    if (!timeSignature || typeof timeSignature !== 'string') return 4;
    const m = timeSignature.match(/^(\d+)\/(\d+)$/);
    if (!m) return 4;
    return parseInt(m[1], 10);
}

/**
 * Validate transport constraints.
 */
function validateTransport(plan) {
    const errors = [];
    const transport = plan.transport || {};

    const bpm = transport.tempo_bpm;
    if (bpm != null && (bpm < 20 || bpm > 300)) {
        errors.push(`tempo_bpm must be 20–300, got ${bpm}`);
    }

    const bars = transport.bar_count;
    if (bars != null && (bars < 1 || bars > 128)) {
        errors.push(`bar_count must be 1–128, got ${bars}`);
    }

    const ts = transport.time_signature;
    if (ts && !/^\d+\/\d+$/.test(ts)) {
        errors.push(`time_signature must match N/N, got ${ts}`);
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings: [],
    };
}

/**
 * Validate track names are unique and non-empty.
 */
function validateTracks(plan) {
    const errors = [];
    const names = new Set();
    for (const t of plan.tracks || []) {
        const n = (t.name || '').trim();
        if (!n) errors.push('Track name cannot be empty');
        if (names.has(n)) errors.push(`Duplicate track name: "${n}"`);
        names.add(n);
    }
    return {
        ok: errors.length === 0,
        errors,
        warnings: [],
    };
}

/**
 * Validate clip lengths and event alignment for time signature.
 * For 6/8, beats_per_bar=6; for 4/4, beats_per_bar=4.
 */
function validateTimeSignatureAlignment(plan) {
    const errors = [];
    const transport = plan.transport || {};
    const ts = transport.time_signature || '4/4';
    const beatsPerBar = getBeatsPerBar(ts);
    const barCount = transport.bar_count ?? 8;

    for (const track of plan.tracks || []) {
        const midi = track.midi;
        if (!midi?.clips) continue;

        for (let c = 0; c < midi.clips.length; c++) {
            const clip = midi.clips[c];
            const clipLen = clip.length_beats ?? 0;
            const expectedMax = barCount * beatsPerBar;
            if (clipLen > expectedMax + 0.01) {
                errors.push(
                    `Track "${track.name}" clip ${c}: length_beats ${clipLen} exceeds ${barCount} bars × ${beatsPerBar} beats = ${expectedMax} for ${ts}`
                );
            }
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings: [],
    };
}

/**
 * Validate audio_pattern needs: if type requires sample_url, ensure need or URL present.
 * If sample_url present but not in assets → INVENTED_URL.
 */
function validateAudioNeeds(plan, opts = {}) {
    const errors = [];
    const assets = opts.assets || {};
    const uploadedUrls = new Set((assets.uploaded_files || []).map((f) => f.url).filter(Boolean));

    for (const track of plan.tracks || []) {
        const ap = track.audio_pattern;
        if (!ap || ap.type !== 'four_on_floor') continue;

        const hasUrl = ap.sample_url && ap.sample_url.length > 0;
        const needs = (plan.needs || []).filter(
            (n) => n.type === 'kick_sample_url' || n.type === 'audio_file_url'
        );
        const hasNeed = needs.some((n) => n.required && (n.status === 'missing' || n.status === 'unknown'));

        if (hasUrl) {
            if (!uploadedUrls.has(ap.sample_url)) {
                errors.push(`INVENTED_URL: Track "${track.name}" has sample_url not in assets. Never fabricate URLs.`);
            }
        } else if (!hasNeed) {
            errors.push(
                `Track "${track.name}" has audio_pattern.type=four_on_floor but no sample_url and no kick_sample_url need. Add needs.kick_sample_url.`
            );
        }
    }
    return {
        ok: errors.length === 0,
        errors,
        warnings: [],
    };
}

/**
 * T5: Tension → release. If meta.intent or userText indicates tension/release,
 * require cadence in last 2 bars: dominant (E/E7) resolving to tonic (Am).
 */
function validateTensionRelease(plan, opts = {}) {
    const errors = [];
    const userText = (opts.userText || '').toLowerCase();
    const intent = (plan.meta?.intent || '').toLowerCase();
    const hasIntent = /tension|build|release|resolve|first.*bar|last.*bar/.test(userText) || /tension|release/.test(intent);
    if (!hasIntent) return { ok: true, errors: [], warnings: [] };

    const key = (plan.transport?.key || '').toLowerCase();
    const isAMinor = /a\s*minor|aminor|a minor/.test(key);
    if (!isAMinor) return { ok: true, errors: [], warnings: [] };

    const beatsPerBar = getBeatsPerBar(plan.transport?.time_signature);
    const barCount = plan.transport?.bar_count ?? 8;
    const lastTwoBarsStart = beatsPerBar * (barCount - 2);

    let hasResolution = false;
    for (const track of plan.tracks || []) {
        for (const clip of track?.midi?.clips || []) {
            for (const ev of clip?.events || []) {
                if (ev.type !== 'chord' || !ev.symbol) continue;
                const s = (ev.symbol || '').toUpperCase().replace(/\s/g, '');
                const start = ev.start_beat ?? 0;
                if (start >= lastTwoBarsStart) {
                    if (/^A(M|MIN|7)?$/i.test(s) || /^AM/.test(s)) hasResolution = true;
                }
            }
        }
    }
    if (!hasResolution) {
        errors.push('MISSING_RESOLUTION: Tension/release in A minor requires resolution to Am in last 2 bars. End on tonic.');
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * T8: If user wants stems and no assets.stems.urls, require stems_for_song or audio_file_url need.
 */
function validateStemsIntent(plan, opts = {}) {
    const errors = [];
    const userText = (opts.userText || '').toLowerCase();
    const assets = opts.assets || {};
    const hasStems = assets.stems?.urls && Object.keys(assets.stems.urls).length > 0;
    if (hasStems) return { ok: true, errors: [], warnings: [] };
    if (!/\bstems?\b|import.*stems?/.test(userText)) return { ok: true, errors: [], warnings: [] };

    const needs = plan.needs || [];
    const hasStemsNeed = needs.some((n) => n.type === 'stems_for_song' || n.type === 'audio_file_url');
    if (!hasStemsNeed) {
        errors.push('MISSING_STEMS_INPUT: User wants stems but no song_name or audio URL. Add needs.stems_for_song or audio_file_url with ask_user.');
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate needs payload shape: proposed_resolution.tool_call must be object.
 */
function validateNeedsToolCalls(plan) {
    const errors = [];
    for (const need of plan.needs || []) {
        if (!need.proposed_resolution || typeof need.proposed_resolution !== 'object') continue;
        const tc = need.proposed_resolution.tool_call;
        if (!tc || typeof tc !== 'object' || Array.isArray(tc)) {
            errors.push(`NEEDS_TOOL_CALL_OBJECT: needs "${need.id || need.type}" must include proposed_resolution.tool_call object`);
            continue;
        }
        if (!tc.arguments || typeof tc.arguments !== 'object' || Array.isArray(tc.arguments)) {
            errors.push(`NEEDS_TOOL_CALL_ARGUMENTS_OBJECT: needs "${need.id || need.type}" must include tool_call.arguments object`);
        }
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate stems needs do not invent random song_name when asking user.
 */
function validateStemsSongNameGuess(plan) {
    const errors = [];
    for (const need of plan.needs || []) {
        if (need.type !== 'stems_for_song') continue;
        const strategy = need.proposed_resolution?.strategy;
        const song = need.proposed_resolution?.tool_call?.arguments?.song_name;
        if (!song || typeof song !== 'string') continue;
        if (strategy !== 'ask_user') continue;

        const s = song.trim();
        // Allow placeholders only; block concrete guessed names.
        const placeholder = /^(unknown|ask_user|user_input|please_provide_song_name|song_name)$/i.test(s);
        if (!placeholder) {
            errors.push(`RANDOM_SONG_NAME_GUESS: needs "${need.id || need.type}" guessed song_name="${s}". Ask user instead.`);
        }
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * T9: If instrument_hint contains "Serum" but not in known_fx, require fx_name need or ReaSynth.
 */
function validateSerumFx(plan, opts = {}) {
    const errors = [];
    const knownFx = opts.capabilities?.known_fx || [];
    const hasSerum = knownFx.some((f) => /serum/i.test(f));

    for (const track of plan.tracks || []) {
        const hint = (track.instrument_hint || '').toLowerCase();
        if (!hint.includes('serum')) continue;

        const hasFxNeed = (plan.needs || []).some((n) => n.type === 'fx_name');
        if (!hasSerum && !hasFxNeed && !/reasynth/i.test(hint)) {
            errors.push('UNCONFIRMED_FX_NAME: Serum in instrument_hint but not in known FX. Add needs.fx_name or use ReaSynth.');
        }
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * T10: If user wants transcribe and no audio in assets, require audio_file_url need. Never output midiUrl.
 */
function validateTranscribeIntent(plan, opts = {}) {
    const errors = [];
    const userText = (opts.userText || '').toLowerCase();
    const assets = opts.assets || {};
    const hasAudio = (assets.uploaded_files || []).some((f) => f.url && /\.(wav|mp3|flac|m4a|ogg)$/i.test(f.name || f.url));
    if (!/transcribe|midi|convert.*midi/.test(userText)) return { ok: true, errors: [], warnings: [] };

    if (!hasAudio) {
        const hasAudioNeed = (plan.needs || []).some((n) => n.type === 'audio_file_url' || n.type === 'midi_url');
        if (!hasAudioNeed) {
            errors.push('MISSING_AUDIO: Transcribe to MIDI requires audio. Add needs.audio_file_url. Never output midiUrl without audio source.');
        }
    }
    return { ok: errors.length === 0, errors, warnings: [] };
}

/**
 * Full plan validation: schema + timing + transport + tracks + intent-based rules.
 * @param {object} plan
 * @param {object} [opts] - { userText, assets, capabilities: { known_fx } }
 * @returns {{ ok: boolean; errors: string[]; warnings: string[]; normalizedPlan?: object }}
 */
function validatePlan(plan, opts = {}) {
    const allErrors = [];
    const allWarnings = [];

    const schemaResult = validateSchema(plan);
    if (!schemaResult.ok) {
        allErrors.push(...(schemaResult.errors || []));
    }

    const timing = validateTiming(plan);
    allErrors.push(...timing.errors);
    allWarnings.push(...timing.warnings);

    const transport = validateTransport(plan);
    allErrors.push(...transport.errors);
    allWarnings.push(...transport.warnings);

    const tracks = validateTracks(plan);
    allErrors.push(...tracks.errors);

    const tsAlign = validateTimeSignatureAlignment(plan);
    allErrors.push(...tsAlign.errors);

    const audio = validateAudioNeeds(plan, opts);
    allErrors.push(...audio.errors);

    const tension = validateTensionRelease(plan, opts);
    allErrors.push(...tension.errors);

    const stems = validateStemsIntent(plan, opts);
    allErrors.push(...stems.errors);

    const needToolCalls = validateNeedsToolCalls(plan);
    allErrors.push(...needToolCalls.errors);

    const stemsSongName = validateStemsSongNameGuess(plan);
    allErrors.push(...stemsSongName.errors);

    const serum = validateSerumFx(plan, opts);
    allErrors.push(...serum.errors);

    const transcribe = validateTranscribeIntent(plan, opts);
    allErrors.push(...transcribe.errors);

    const ok = allErrors.length === 0;
    return {
        ok,
        errors: allErrors,
        warnings: allWarnings,
        normalizedPlan: ok ? applyDefaults(plan) : undefined,
    };
}

function applyDefaults(plan) {
    const t = plan.transport || {};
    return {
        ...plan,
        transport: {
            tempo_bpm: t.tempo_bpm ?? 120,
            time_signature: t.time_signature ?? '4/4',
            key: t.key ?? 'C major',
            bar_count: t.bar_count ?? 8,
        },
        execution_policy: {
            allow_auto_resolve: plan.execution_policy?.allow_auto_resolve ?? true,
            max_tool_calls: plan.execution_policy?.max_tool_calls ?? 30,
            on_missing_required: plan.execution_policy?.on_missing_required ?? 'block',
        },
    };
}

module.exports = {
    validatePlan,
    validateTiming,
    validateTransport,
    validateTracks,
    validateTimeSignatureAlignment,
    validateAudioNeeds,
    validateTensionRelease,
    validateStemsIntent,
    validateNeedsToolCalls,
    validateStemsSongNameGuess,
    validateSerumFx,
    validateTranscribeIntent,
    getBeatsPerBar,
};
