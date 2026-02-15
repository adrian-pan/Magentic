/**
 * musicTheory.js — Knowledge base of music production terminology & concepts.
 *
 * Used by the Magentic agent to teach beginners the proper industry terms,
 * explain concepts with simple analogies, and suggest what to try next.
 *
 * Categories:
 *   rhythm      — beat patterns and time-feel concepts
 *   mixing      — EQ, compression, effects, gain staging
 *   arrangement — song structure and sections
 *   sound_design— synthesis, sampling, sound shaping
 *   genre       — genre-specific production conventions
 *   beginner    — foundational concepts every producer should know
 */

const MUSIC_TERMS = [
    // ===================================================================
    // RHYTHM — beat patterns, time feels, grooves
    // ===================================================================
    {
        name: "Four-on-the-Floor",
        category: "rhythm",
        aliases: ["4-on-the-floor", "four on the floor", "kick every beat", "techno kick", "house kick"],
        definition: "A rhythm pattern where the kick drum hits on every beat (1, 2, 3, 4) in a 4/4 time signature.",
        context: "The foundation of House, Techno, Trance, and Disco music. It provides a steady, driving pulse.",
        beginner_tip: "This is probably the simplest drum pattern you can make — just put a kick on every beat. It's the heartbeat of dance music.",
    },
    {
        name: "Backbeat",
        category: "rhythm",
        aliases: ["back beat", "snare on 2 and 4", "standard rock beat", "pop beat"],
        definition: "A rhythmic emphasis on the second and fourth beats of a 4/4 measure, typically played by the snare drum.",
        context: "The backbone of Rock, Pop, R&B, and Hip-Hop. It creates a sense of stability and forward motion.",
        beginner_tip: "If you clap along to most songs, you're clapping on the backbeat (beats 2 and 4). Try: kick on 1 and 3, snare on 2 and 4.",
    },
    {
        name: "Syncopation",
        category: "rhythm",
        aliases: ["off-beat", "syncopated", "offbeat rhythm", "in between the beats"],
        definition: "Accenting a weak beat or an off-beat (between the counts) rather than a strong beat.",
        context: "Essential for Funk, Jazz, Latin, and modern electronic genres to add groove and prevent rhythms from sounding robotic.",
        beginner_tip: "Syncopation is what makes a beat feel 'groovy' instead of stiff. Try placing a note slightly before or after where you'd expect it.",
    },
    {
        name: "Half-Time",
        category: "rhythm",
        aliases: ["half time", "breakdown feel", "half time feel", "slow feel"],
        definition: "A rhythmic feel where the snare hits on beat 3 only (instead of 2 and 4), making the tempo feel twice as slow while the BPM remains constant.",
        context: "Common in Dubstep, Trap, and Metal breakdowns to create a heavy, spacious feel.",
        beginner_tip: "The BPM stays the same, but it FEELS slower because the snare only hits once per bar. Trap music almost always uses half-time feel.",
    },
    {
        name: "Double-Time",
        category: "rhythm",
        aliases: ["double time", "fast feel"],
        definition: "A rhythmic feel where the snare hits on the 'and' of every beat (twice as fast as standard), making the tempo feel twice as fast.",
        context: "Used in Drum & Bass, Punk, and intense sections of Jazz.",
        beginner_tip: "Same BPM, but everything feels like it sped up. Great for building energy in a song.",
    },
    {
        name: "Trap Hi-Hats",
        category: "rhythm",
        aliases: ["rolling hats", "hat rolls", "trap hats", "hi hat rolls", "rapid hi hats"],
        definition: "Fast, subdivided hi-hat patterns (1/16th, 1/32nd notes, or triplets) that often speed up and slow down, sometimes with pitch variation.",
        context: "A defining characteristic of Trap and modern Hip-Hop production. Producers like Metro Boomin and Southside popularized this.",
        beginner_tip: "Start with steady 1/8th notes on the hi-hat, then try adding a few quick 1/32nd note rolls. Vary the velocity (how hard they hit) to make it feel human.",
    },
    {
        name: "Dem Bow",
        category: "rhythm",
        aliases: ["dembow", "reggaeton beat", "reggaeton rhythm", "latin beat"],
        definition: "A syncopated rhythm distinct to Reggaeton and Dancehall, characterized by a kick-snare pattern with a specific 3+3+2 subdivision feel.",
        context: "The driving rhythm behind Reggaeton, Moombahton, and much of modern Latin Pop. Named after the Shabba Ranks song 'Dem Bow'.",
        beginner_tip: "The easiest way to make a reggaeton beat: kick on 1 and 3, snare on every 'and' (the off-beats). It's instantly recognizable.",
    },
    {
        name: "Boom Bap",
        category: "rhythm",
        aliases: ["boom-bap", "90s hip hop beat", "old school hip hop", "classic hip hop"],
        definition: "A raw, punchy drum pattern with a strong kick ('boom') and snappy snare ('bap'), typically with a swing or shuffle feel. Often built from sampled breakbeats.",
        context: "The classic sound of 90s East Coast Hip-Hop. Think J Dilla, DJ Premier, Pete Rock.",
        beginner_tip: "Use a punchy kick, a crispy snare, and add some swing (about 55-60%) to make it feel loose and human. Sample-based drums work best.",
    },
    {
        name: "Drill Beat",
        category: "rhythm",
        aliases: ["drill", "uk drill", "chicago drill", "ny drill", "drill pattern"],
        definition: "A dark, aggressive beat style featuring sliding 808 bass, fast hi-hat patterns, and a distinctive snare/clap placement. Usually around 140-150 BPM in half-time.",
        context: "Originated in Chicago, evolved in the UK, and now dominates globally. Characterized by dark melodies, sliding 808s, and bouncy drum patterns.",
        beginner_tip: "Start at 140 BPM, use a half-time snare (beat 3), add fast hi-hats, and make your 808 bass notes slide between pitches using portamento/glide.",
    },
    {
        name: "Polyrhythm",
        category: "rhythm",
        aliases: ["cross-rhythm", "3 over 2", "4 against 3", "polyrhythmic"],
        definition: "The simultaneous use of two or more conflicting rhythms (e.g., triplets against straight eighths).",
        context: "Found in African music, Jazz, and complex IDM/Techno. Adds tension and complexity.",
        beginner_tip: "Try this: put a kick every 3 beats and a hi-hat every 2 beats. They'll go in and out of sync — that's a polyrhythm!",
    },
    {
        name: "Swing / Shuffle",
        category: "rhythm",
        aliases: ["swing", "shuffle", "groove", "swing feel", "shuffle beat", "mpc swing"],
        definition: "A timing adjustment that delays the off-beat notes slightly, creating a 'bouncy' or 'lopsided' feel instead of perfectly straight timing.",
        context: "Essential in Jazz, Funk, R&B, and Lo-Fi Hip-Hop. MPC-style swing is a signature of J Dilla and lo-fi beats.",
        beginner_tip: "Most DAWs have a 'swing' knob — try setting it to 55-65%. It makes robotic patterns feel like a real drummer played them.",
    },
    {
        name: "Quantize",
        category: "rhythm",
        aliases: ["quantization", "snap to grid", "grid snap", "straighten timing"],
        definition: "Automatically snapping MIDI notes or audio to the nearest beat/subdivision on the grid, correcting imprecise timing.",
        context: "Used in all genres to clean up recorded performances. Over-quantizing can make music sound robotic.",
        beginner_tip: "If you play notes on a keyboard and they sound sloppy, quantize them to snap to the grid. But don't quantize everything — small imperfections add human feel.",
    },

    // ===================================================================
    // MIXING — EQ, compression, effects, levels
    // ===================================================================
    {
        name: "EQ (Equalization)",
        category: "mixing",
        aliases: ["eq", "equalizer", "equalize", "frequency balance", "tone shaping", "bass boost", "treble"],
        definition: "A tool that boosts or cuts specific frequency ranges in a sound. Like a tone control on steroids — you can shape which parts of the sound are loud or quiet.",
        context: "The most fundamental mixing tool. Every professional mix uses EQ on almost every track.",
        beginner_tip: "Think of EQ like a graphic equalizer on a stereo: bass on the left (20-200 Hz), mids in the middle (200 Hz-5 kHz), treble on the right (5-20 kHz). Cut what sounds bad before boosting what sounds good.",
    },
    {
        name: "High-Pass Filter",
        category: "mixing",
        aliases: ["hpf", "low cut", "high pass", "roll off bass", "rumble filter"],
        definition: "A filter that removes low frequencies below a set point, letting only the high frequencies pass through.",
        context: "One of the most important mixing moves. Used on almost every track except kick and bass to remove muddy rumble.",
        beginner_tip: "Put a high-pass filter on every track that isn't your kick or bass. Set it around 80-150 Hz. This is the single biggest mixing improvement a beginner can make.",
    },
    {
        name: "Compression",
        category: "mixing",
        aliases: ["compressor", "dynamics", "compress", "squash", "dynamic range"],
        definition: "A tool that reduces the volume difference between the loudest and quietest parts of a sound, making everything more consistent and punchy.",
        context: "Used on vocals, drums, bass, and the master bus. It's what makes professional mixes sound loud and cohesive.",
        beginner_tip: "Imagine compression as an automatic hand on the volume fader — when the sound gets too loud, it turns it down. Start with a ratio of 3:1 and a medium attack.",
    },
    {
        name: "Reverb",
        category: "mixing",
        aliases: ["reverb effect", "room sound", "space", "echo", "hall", "plate reverb", "ambience"],
        definition: "An effect that simulates the sound reflections of a physical space (room, hall, cathedral). Makes sounds feel like they exist in a real environment.",
        context: "Used on almost every mix to add depth and space. Different reverb types simulate different environments.",
        beginner_tip: "Reverb is like the 'room' your sound lives in. A small room reverb sounds intimate, a large hall sounds epic. Start with a short decay (1-2 seconds) and mix it in subtly.",
    },
    {
        name: "Delay",
        category: "mixing",
        aliases: ["delay effect", "echo effect", "repeat", "slapback", "ping pong delay", "tape delay"],
        definition: "An effect that creates copies of a sound at timed intervals, like distinct echoes. Unlike reverb, you can hear each repeat clearly.",
        context: "Versatile effect for vocals, guitars, synths. Synced to tempo (1/4 note, 1/8 note) to stay rhythmic.",
        beginner_tip: "Delay is different from reverb — reverb is like a room, delay is like distinct echoes. Try a 1/4 note delay synced to your BPM for a classic effect.",
    },
    {
        name: "Sidechain Compression",
        category: "mixing",
        aliases: ["pumping", "ducking", "sidechain", "sidechain pump", "volume ducking"],
        definition: "A technique where one track's volume is automatically reduced whenever another track plays. Most commonly: bass ducks when the kick hits.",
        context: "Crucial in EDM/House to let the kick cut through, and in Pop for vocal clarity. Creates the 'pumping' effect in dance music.",
        beginner_tip: "This is how producers make the bass 'breathe' with the kick drum. Set up a compressor on your bass track, and trigger it from the kick. The bass will duck every time the kick hits.",
    },
    {
        name: "Gain Staging",
        category: "mixing",
        aliases: ["gain structure", "levels", "headroom", "volume levels", "clipping"],
        definition: "Setting proper volume levels at each stage of the signal chain so nothing distorts and the mix has 'headroom' (room to breathe).",
        context: "Poor gain staging causes muddy, distorted mixes. Good gain staging is invisible but essential.",
        beginner_tip: "Before mixing, pull ALL your faders down to -10 or -12 dB. Aim for your master bus to peak around -6 dB. This gives you room to work.",
    },
    {
        name: "Panning",
        category: "mixing",
        aliases: ["pan", "stereo placement", "left right", "stereo width", "stereo image"],
        definition: "Positioning a sound anywhere in the left-right stereo field. Center (0) means equal in both speakers; hard left/right means only one speaker.",
        context: "Creates width and separation in a mix. Kick, bass, and vocals usually stay centered; guitars, keys, and hi-hats spread left/right.",
        beginner_tip: "Keep your kick, bass, snare, and main vocal dead center. Pan other instruments left and right to create space. Think of it like placing musicians on a stage.",
    },
    {
        name: "Clipping",
        category: "mixing",
        aliases: ["distortion", "peaking", "red lining", "too loud", "digital distortion"],
        definition: "When a signal exceeds the maximum volume level (0 dB), causing harsh digital distortion. The meters go into the red.",
        context: "Always avoid unintentional clipping. It sounds harsh and damages the quality of your mix.",
        beginner_tip: "If your meter turns red, it's clipping — turn things down! Your master bus should never go above 0 dB. If it does, lower individual track volumes.",
    },
    {
        name: "Bus / Group",
        category: "mixing",
        aliases: ["bus", "group track", "submix", "drum bus", "vocal bus", "stem"],
        definition: "A track that combines multiple individual tracks together so you can process them as a group. For example, routing all drum tracks to a single 'drum bus'.",
        context: "Essential for organized mixing. Allows you to control and process groups of related sounds together.",
        beginner_tip: "Route all your drums to one bus, all your vocals to another. Then you can EQ and compress all the drums together, which 'glues' them into one cohesive sound.",
    },
    {
        name: "Wet / Dry",
        category: "mixing",
        aliases: ["wet dry", "mix knob", "dry wet", "effect amount", "blend"],
        definition: "The balance between the original unprocessed sound (dry) and the effect-processed sound (wet). A 'Mix' knob at 100% is fully wet; 0% is fully dry.",
        context: "Every effect plugin has a wet/dry control. Finding the right balance is key to good mixing.",
        beginner_tip: "A common beginner mistake is using too much reverb or delay (too 'wet'). Start at 20-30% wet and increase slowly until it sounds right.",
    },

    // ===================================================================
    // ARRANGEMENT — song structure and sections
    // ===================================================================
    {
        name: "Song Structure",
        category: "arrangement",
        aliases: ["arrangement", "song form", "structure", "song layout", "how to arrange", "song sections"],
        definition: "The order of sections in a song. A common Pop structure: Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro.",
        context: "Good arrangement is what keeps listeners engaged. It creates tension and release, build-up and payoff.",
        beginner_tip: "Start with the simplest structure: Intro (4 bars) → Verse (8 bars) → Chorus (8 bars) → Verse → Chorus → Outro (4 bars). Add more sections once you're comfortable.",
    },
    {
        name: "Intro",
        category: "arrangement",
        aliases: ["introduction", "opening", "song intro", "beginning"],
        definition: "The opening section of a song that sets the mood and draws the listener in. Usually simpler than the rest of the song.",
        context: "In EDM, intros are usually 16-32 bars for DJ mixing. In Pop, intros are short (4-8 bars).",
        beginner_tip: "Start with just one or two elements (like a melody + pad) and gradually add more. The intro should make the listener curious about what comes next.",
    },
    {
        name: "Verse",
        category: "arrangement",
        aliases: ["verse section", "story part", "verse melody"],
        definition: "The storytelling section of a song. The melody and chords stay the same, but lyrics change each time. Usually more laid-back than the chorus.",
        context: "The verse builds anticipation for the chorus. In instrumental music, it introduces the main theme with fewer layers.",
        beginner_tip: "Verses are quieter and less intense than choruses. Try removing some instruments from the chorus to create the verse — that contrast is what makes the chorus hit hard.",
    },
    {
        name: "Chorus / Hook",
        category: "arrangement",
        aliases: ["chorus", "hook", "drop", "main part", "catchy part", "the big part"],
        definition: "The most memorable, energetic part of a song that repeats with the same melody and lyrics. In EDM, this is often called 'the drop'.",
        context: "The chorus is what people remember and sing along to. It should be the emotional peak of each song cycle.",
        beginner_tip: "Make the chorus DIFFERENT from the verse — louder, more instruments, bigger drums, catchier melody. The contrast between verse and chorus is what makes both effective.",
    },
    {
        name: "Drop",
        category: "arrangement",
        aliases: ["the drop", "beat drop", "bass drop", "edm drop"],
        definition: "In electronic music, the moment when the full beat and bass kick in after a build-up. The most intense part of the track.",
        context: "Central to EDM, Dubstep, Trap, and House. The build-up creates tension; the drop releases it.",
        beginner_tip: "The drop feels powerful because of CONTRAST. Before the drop, strip everything away (just a riser or vocal). Then hit them with everything at once — full drums, bass, synths.",
    },
    {
        name: "Bridge",
        category: "arrangement",
        aliases: ["middle 8", "breakdown", "b section", "bridge section"],
        definition: "A section that breaks the verse-chorus pattern with different chords, melody, or energy. Provides contrast and keeps the song interesting.",
        context: "Usually appears once, between the second chorus and final chorus. In EDM, this is often a 'breakdown' — stripped-back and atmospheric.",
        beginner_tip: "The bridge should feel like a detour — different from both verse and chorus. Try changing the chords, dropping the drums, or introducing a new melody.",
    },
    {
        name: "Build-Up / Riser",
        category: "arrangement",
        aliases: ["buildup", "riser", "tension", "rising energy", "snare roll build"],
        definition: "A section that gradually increases energy and tension, leading into a drop or chorus. Uses rising pitch, increasing drum density, and effects like sweeps.",
        context: "Essential in EDM and used in all genres to create anticipation before a big moment.",
        beginner_tip: "Layer these for a build-up: (1) a drum roll that gets faster, (2) a rising white noise sweep, (3) gradually add more instruments. Then cut everything right before the drop for maximum impact.",
    },
    {
        name: "Outro",
        category: "arrangement",
        aliases: ["ending", "outro section", "fadeout", "song ending"],
        definition: "The closing section that winds the song down. Can be a fade-out, a stripped-back reprise, or a definitive ending.",
        context: "In DJ music, outros mirror intros for smooth transitions. In Pop, they often fade out or end abruptly.",
        beginner_tip: "The simplest outro: take your last chorus and gradually remove elements over 4-8 bars until only one instrument remains. Or just use a fade-out volume envelope.",
    },
    {
        name: "8-Bar Loop",
        category: "arrangement",
        aliases: ["loop", "8 bar loop", "basic loop", "beat loop", "pattern"],
        definition: "A repeating musical section, typically 8 bars (or 4 bars) long. The building block of most electronic music production.",
        context: "Most producers start by making a loop, then arrange it into a full song by adding/removing elements.",
        beginner_tip: "Don't try to write a full song right away. Make an 8-bar loop that sounds good — drums, bass, melody, chords. Once you love the loop, THEN think about arrangement.",
    },

    // ===================================================================
    // SOUND DESIGN — synthesis, sampling, sound shaping
    // ===================================================================
    {
        name: "Oscillator",
        category: "sound_design",
        aliases: ["osc", "waveform", "wave shape", "synth wave", "saw wave", "sine wave", "square wave"],
        definition: "The core sound generator in a synthesizer. It produces a basic waveform (sine, saw, square, triangle) that you then shape with filters and effects.",
        context: "Every synth sound starts with oscillators. Saw waves sound bright/buzzy, sine waves sound smooth/pure, square waves sound hollow.",
        beginner_tip: "Think of oscillators as the 'raw ingredient' of a synth sound. A saw wave is like a raw block of marble — you carve it into shape with filters and envelopes.",
    },
    {
        name: "Filter",
        category: "sound_design",
        aliases: ["low pass filter", "lpf", "cutoff", "filter sweep", "resonance", "filter cutoff"],
        definition: "Removes certain frequencies from a sound. A low-pass filter (most common) removes high frequencies, making sounds darker/warmer.",
        context: "Filters are the most important sound-shaping tool after oscillators. Filter sweeps (automating the cutoff) create movement.",
        beginner_tip: "Turn down the filter cutoff on a bright saw synth — notice how it goes from buzzy to warm to muffled. Automating this cutoff over time creates those classic 'wah' sweeps.",
    },
    {
        name: "ADSR Envelope",
        category: "sound_design",
        aliases: ["adsr", "envelope", "attack", "decay", "sustain", "release", "amp envelope"],
        definition: "Controls HOW a sound changes over time: Attack (how fast it starts), Decay (how fast it drops to sustain), Sustain (held level), Release (how fast it fades after letting go).",
        context: "Every synth has at least one ADSR for volume (amp envelope). You can also apply envelopes to filter, pitch, etc.",
        beginner_tip: "Short attack + short release = plucky sound (like a piano). Long attack + long release = pad sound (like a string section). Experiment with just these two to hear the difference.",
    },
    {
        name: "LFO (Low Frequency Oscillator)",
        category: "sound_design",
        aliases: ["lfo", "modulation", "wobble", "vibrato", "tremolo", "autopan"],
        definition: "An oscillator that runs too slow to hear as sound, instead used to automatically wiggle other parameters (pitch = vibrato, volume = tremolo, filter = wobble).",
        context: "LFOs create movement and life in synth patches. The 'wobble bass' in Dubstep is an LFO on the filter cutoff.",
        beginner_tip: "Route an LFO to filter cutoff with a slow rate — instant movement. Route it to pitch with a fast, subtle rate — instant vibrato. LFOs make static sounds come alive.",
    },
    {
        name: "Sampling",
        category: "sound_design",
        aliases: ["sample", "sampler", "chop", "sampling a record", "flip a sample"],
        definition: "Taking a piece of existing audio (a drum hit, a vocal snippet, a loop from a record) and using it in a new production.",
        context: "The foundation of Hip-Hop, and widely used in all electronic genres. Producers 'chop' samples into pieces and rearrange them.",
        beginner_tip: "Start by using drum sample packs — individual kick, snare, and hi-hat sounds. As you advance, try chopping a melody from an old record and rearranging it.",
    },
    {
        name: "808",
        category: "sound_design",
        aliases: ["808 bass", "808 kick", "sub bass", "trap bass", "808 drum machine", "boomy bass"],
        definition: "Originally the Roland TR-808 drum machine. In modern production, '808' usually refers to the pitched, sustained sub-bass sound derived from the 808's kick drum.",
        context: "The backbone of Trap, modern Hip-Hop, and R&B production. The 808 bass plays melodic bass lines, not just single hits.",
        beginner_tip: "An 808 is basically a very low, long bass note that starts with a punchy kick transient. In Trap, the 808 IS the bass — there's usually no separate bass instrument.",
    },

    // ===================================================================
    // GENRE TEMPLATES — what makes each genre sound the way it does
    // ===================================================================

    // --- Hip-Hop & Rap ---
    {
        name: "Trap Music",
        category: "genre",
        aliases: ["trap", "trap beat", "trap production", "atlanta trap", "trap music production"],
        definition: "A Hip-Hop subgenre featuring heavy 808 bass, rapid hi-hats, dark melodies, and a half-time feel. Usually 130-170 BPM (in half-time, so it feels like 65-85).",
        context: "Originated in Atlanta. Defined by producers like Lex Luger, Metro Boomin, Southside, and TM88.",
        beginner_tip: "Recipe: 140 BPM, half-time snare on beat 3, fast hi-hat rolls, deep 808 bass with slides, dark minor key melodies. Start with the 808 pattern — it drives the whole beat.",
    },
    {
        name: "Boom Bap (genre)",
        category: "genre",
        aliases: ["boom bap beat", "90s hip hop", "old school hip hop beat", "classic hip hop beat", "east coast hip hop"],
        definition: "The classic 90s Hip-Hop sound built on punchy sampled drums, chopped soul/jazz samples, and a raw, unpolished aesthetic. Usually 85-100 BPM with swing.",
        context: "The golden era sound. Think DJ Premier, Pete Rock, J Dilla, 9th Wonder, Madlib. Often uses vinyl samples and an MPC workflow.",
        beginner_tip: "Recipe: 90 BPM, punchy kick + crispy snare with 55-60% swing, a chopped piano or soul sample, simple bassline following the root notes. Keep it raw — don't over-polish.",
    },
    {
        name: "Drill",
        category: "genre",
        aliases: ["drill beat", "uk drill", "ny drill", "chicago drill", "drill music"],
        definition: "A dark, aggressive subgenre with sliding 808s, bouncy hi-hat patterns, and menacing melodies. UK Drill runs 140-145 BPM; NY Drill is similar but with different drum bounce.",
        context: "Started in Chicago (Chief Keef era), evolved in the UK (67, Headie One), then NYC (Pop Smoke, Sheff G). Each region has a distinct flavor.",
        beginner_tip: "Recipe: 140 BPM, half-time snare, fast hi-hats with triplet rolls, sliding 808 bass (use pitch glide/portamento), dark piano or string melodies in minor key.",
    },
    {
        name: "Lo-Fi Hip-Hop",
        category: "genre",
        aliases: ["lofi", "lo-fi", "lo fi beat", "chill beat", "study beat", "lofi hip hop", "chillhop"],
        definition: "A mellow, nostalgic subgenre featuring dusty drums, jazzy chords, vinyl crackle, and a laid-back swing feel. Usually 70-90 BPM.",
        context: "Popularized by the 'lofi hip hop radio' streams. Influenced by J Dilla, Nujabes, and MadLib.",
        beginner_tip: "Recipe: 75 BPM, boom-bap drums with heavy swing, jazz piano chords (7ths and 9ths), vinyl crackle FX, and a low-pass filter on everything to make it sound warm and old.",
    },
    {
        name: "Phonk",
        category: "genre",
        aliases: ["phonk beat", "drift phonk", "memphis phonk", "cowbell phonk", "gym phonk"],
        definition: "A dark, distorted subgenre blending Memphis rap aesthetics with aggressive bass, cowbell patterns, and chopped vocal samples. Usually 130-160 BPM.",
        context: "Rooted in 90s Memphis rap (Three 6 Mafia, DJ Screw). Modern 'drift phonk' went viral on TikTok/car culture. Producers: KORDHELL, DVRST, Freddie Dredd.",
        beginner_tip: "Recipe: 140 BPM, distorted 808 kick, cowbell on every beat, aggressive hi-hats, heavy bass, pitched-down vocal chops, and lots of distortion/saturation on everything.",
    },
    {
        name: "Pluggnb / Plugg",
        category: "genre",
        aliases: ["plugg", "pluggnb", "plug beat", "plugg beat", "rage beat"],
        definition: "A dreamy, melodic Hip-Hop subgenre with floaty synths, soft 808s, and ethereal bells/plucks. Usually 140-160 BPM in half-time.",
        context: "Popularized by producers like F1lthy, Pi'erre Bourne, and artists like Playboi Carti, Destroy Lonely, Ken Carson.",
        beginner_tip: "Recipe: 150 BPM half-time, soft/round 808, dreamy bell or pluck melodies, light hi-hats, lots of reverb on everything. The vibe is spacey and hypnotic.",
    },
    {
        name: "Trap Soul / R&B Trap",
        category: "genre",
        aliases: ["trapsoul", "trap soul", "rnb trap", "modern rnb", "dark rnb", "bryson tiller type"],
        definition: "A fusion of Trap production with R&B vocals and songwriting. Features 808s and trap drums but with smoother, more melodic elements. Usually 120-140 BPM.",
        context: "Defined by Bryson Tiller's 'TRAPSOUL' album. Also: The Weeknd, 6LACK, Summer Walker, SZA. Bridges hip-hop and R&B.",
        beginner_tip: "Recipe: 130 BPM, muted/soft 808, snappy snare, gentle hi-hats, warm pad chords, smooth guitar or piano melody. Leave space for vocals — don't overcrowd the beat.",
    },

    // --- Electronic / Dance ---
    {
        name: "House Music",
        category: "genre",
        aliases: ["house", "deep house", "house beat", "house music production", "classic house"],
        definition: "Electronic dance music built on a four-on-the-floor kick, off-beat hi-hats, soulful chords/vocals, and a groove-focused bassline. Usually 120-130 BPM.",
        context: "Born in Chicago in the 1980s. The grandfather of most modern dance music. Frankie Knuckles, Larry Heard, Marshall Jefferson.",
        beginner_tip: "Recipe: 124 BPM, kick on every beat, open hi-hat on every off-beat, clap/snare on 2 and 4, a groovy bassline, and warm pads or vocal chops.",
    },
    {
        name: "Tech House",
        category: "genre",
        aliases: ["tech house beat", "tech house production", "fisher style", "chris lake style"],
        definition: "A fusion of House and Techno — the groove and warmth of House with the driving, hypnotic energy of Techno. Usually 124-130 BPM.",
        context: "Huge in modern club culture. Artists: Fisher, Chris Lake, Patrick Topping, Green Velvet. Focuses on bass-heavy grooves and minimal melodies.",
        beginner_tip: "Recipe: 126 BPM, punchy four-on-the-floor kick, tight hi-hats, a deep rolling bassline (often with a filter sweep), minimal melodic elements, and percussive groove layers.",
    },
    {
        name: "Techno",
        category: "genre",
        aliases: ["techno beat", "techno production", "detroit techno", "dark techno", "industrial techno"],
        definition: "Repetitive, driving electronic music focused on rhythm and atmosphere over melody. Dark, hypnotic, and relentless. Usually 125-150 BPM.",
        context: "Born in Detroit in the 1980s. Pioneers: Juan Atkins, Derrick May, Kevin Saunderson. Modern: Amelie Lens, Charlotte de Witte, Adam Beyer.",
        beginner_tip: "Recipe: 130 BPM, hard four-on-the-floor kick, closed hi-hat on off-beats, clap on 2 and 4, a dark droning bassline, and atmospheric textures (pads, noise, metallic hits). Less is more.",
    },
    {
        name: "Dubstep",
        category: "genre",
        aliases: ["dubstep beat", "brostep", "riddim", "heavy dubstep", "wub wub", "bass music"],
        definition: "An aggressive bass-heavy genre with a half-time feel, heavy wobble bass, and dramatic build-ups/drops. Usually 140-150 BPM in half-time.",
        context: "Originated in UK (Skream, Benga), evolved into 'brostep' (Skrillex). Subgenres: Riddim (minimal, repetitive), Melodic Dubstep (Seven Lions), Tearout.",
        beginner_tip: "Recipe: 140 BPM half-time, massive kick on 1, snare on 3, wobble bass made with an LFO on filter cutoff, huge build-ups with risers, and a devastating drop. Go big or go home.",
    },
    {
        name: "Future Bass",
        category: "genre",
        aliases: ["future bass beat", "kawaii bass", "flume style", "supersaws", "melodic edm"],
        definition: "A colorful, emotional EDM subgenre featuring detuned supersaw chords, pitched vocal chops, and uplifting melodies with wobbly sidechain bass. Usually 130-160 BPM.",
        context: "Popularized by Flume, Marshmello, San Holo, Illenium. Bridges pop-friendly melodies with electronic bass music.",
        beginner_tip: "Recipe: 150 BPM, supersaw chords with sidechain pumping, pitched-up vocal chops, snappy trap-style drums, and a bright, major-key melody. Use lots of reverb for that wide, dreamy sound.",
    },
    {
        name: "Drum & Bass",
        category: "genre",
        aliases: ["dnb", "drum and bass", "jungle", "d&b", "liquid dnb", "neurofunk"],
        definition: "A fast-paced electronic genre built on breakbeat drums and heavy bass. Usually 160-180 BPM.",
        context: "Originated in the UK rave scene. Subgenres: Liquid (smooth, musical), Neurofunk (dark, technical), Jump-Up (bouncy, aggressive).",
        beginner_tip: "Recipe: 174 BPM, a chopped breakbeat (the 'Amen break' is classic), a heavy sub-bass that moves, and energetic synths or pads. The drum pattern is everything in DnB.",
    },
    {
        name: "Trance",
        category: "genre",
        aliases: ["trance beat", "trance music", "uplifting trance", "psytrance", "progressive trance"],
        definition: "Euphoric, melodic electronic music with long build-ups, soaring synth leads, and a driving four-on-the-floor beat. Usually 128-145 BPM (Psytrance: 145-150).",
        context: "Peaked in the late 90s/2000s (Tiesto, Armin van Buuren, Paul van Dyk). Still huge globally. Psytrance is the harder, trippier cousin.",
        beginner_tip: "Recipe: 138 BPM, four-on-the-floor kick, rolling bassline, a soaring lead synth melody with lots of delay, long 32-bar build-ups, and an emotional breakdown in the middle.",
    },
    {
        name: "EDM / Big Room",
        category: "genre",
        aliases: ["edm", "big room", "festival edm", "mainstage", "electro house", "big room house"],
        definition: "High-energy festival electronic music with massive build-ups, a simple drop (often just a kick + lead), and crowd-friendly simplicity. Usually 126-132 BPM.",
        context: "The 'festival sound' of 2012-2016 (Martin Garrix, Dimitri Vegas & Like Mike, Hardwell). Still popular at mainstage events.",
        beginner_tip: "Recipe: 128 BPM, huge build-up with snare rolls and risers, a simple catchy lead melody, then drop everything to just kick + lead. Big Room is all about the drop moment.",
    },
    {
        name: "Garage / UK Garage",
        category: "genre",
        aliases: ["uk garage", "2-step", "ukg", "speed garage", "garage beat", "2 step"],
        definition: "A skippy, shuffled dance genre with a distinctive 2-step drum pattern (kick-hat-snare-hat but with the kick slightly off-grid). Usually 130-140 BPM.",
        context: "Born in the UK in the 90s (MJ Cole, Todd Edwards, Craig David). Influenced Dubstep, Grime, and modern Bass music.",
        beginner_tip: "Recipe: 135 BPM, a shuffled 2-step kick pattern (not straight like house), snappy snares, warm sub-bass, chopped vocal samples, and organ or piano stabs. The rhythm is everything.",
    },
    {
        name: "Synthwave / Retrowave",
        category: "genre",
        aliases: ["synthwave", "retrowave", "outrun", "80s synth", "vaporwave", "retro electronic"],
        definition: "A nostalgic electronic genre inspired by 1980s synth-pop, movie soundtracks, and video game music. Features analog-style synths, gated reverb drums, and arpeggiated basslines.",
        context: "Popularized by the 'Drive' movie soundtrack and artists like Kavinsky, The Midnight, Perturbator, and Com Truise.",
        beginner_tip: "Recipe: 100-120 BPM, big gated reverb snare, punchy electronic kick, arpeggiated synth bassline, lush pad chords, and a soaring lead synth. Everything should sound '80s' — use retro synth presets.",
    },
    {
        name: "Ambient",
        category: "genre",
        aliases: ["ambient music", "ambient production", "atmospheric", "brian eno", "chill ambient", "dark ambient"],
        definition: "Atmospheric, textural music focused on mood and space rather than rhythm or melody. Can be peaceful or dark. Often no drums at all.",
        context: "Pioneered by Brian Eno. Used in film scores, meditation, and as interludes in albums. Modern: Aphex Twin (Selected Ambient Works), Tim Hecker.",
        beginner_tip: "Recipe: no set BPM, long sustained pad chords with lots of reverb, subtle evolving textures (use LFOs on filter/pitch), field recordings or nature sounds. Focus on creating a mood, not a beat.",
    },

    // --- Pop & Mainstream ---
    {
        name: "Pop Production",
        category: "genre",
        aliases: ["pop", "pop beat", "pop music", "modern pop", "top 40", "radio pop"],
        definition: "Mainstream popular music production. Focuses on catchy hooks, clean mixing, and a clear vocal-forward arrangement. Usually 100-130 BPM.",
        context: "Pop borrows from every genre. Modern pop often blends elements of EDM, Trap, R&B, and Indie.",
        beginner_tip: "Recipe: clean drums (not too heavy), a memorable 4-chord progression, a catchy top-line melody, and lots of space for vocals. Keep it simple — the best pop songs have surprisingly few elements.",
    },
    {
        name: "Indie Pop / Bedroom Pop",
        category: "genre",
        aliases: ["indie pop", "bedroom pop", "indie beat", "chill indie", "clairo style", "boy pablo style"],
        definition: "Lo-fi, intimate pop with a DIY aesthetic — dreamy guitars, soft vocals, simple production, and a warm, imperfect character. Usually 90-130 BPM.",
        context: "The 'bedroom producer' sound. Artists: Clairo, Boy Pablo, Rex Orange County, Gus Dapperton, beabadoobee.",
        beginner_tip: "Recipe: 110 BPM, simple drum machine beat, jangly or clean electric guitar chords, soft bass, and a dreamy vocal with lots of reverb. Imperfection is part of the charm.",
    },
    {
        name: "Hyperpop",
        category: "genre",
        aliases: ["hyperpop", "hyper pop", "pc music", "100 gecs style", "charli xcx style", "glitchpop"],
        definition: "An experimental, maximalist pop subgenre that exaggerates pop conventions — pitched vocals, distorted 808s, glitchy production, and chaotic energy. Usually 130-170 BPM.",
        context: "Pioneered by PC Music (A.G. Cook, SOPHIE) and popularized by 100 gecs, Charli XCX, Bladee. Embraces excess and genre-bending.",
        beginner_tip: "Recipe: 150 BPM, distorted everything, pitch-shifted vocals (up or down), glitchy edits, 808s pushed into distortion, pop chord progressions but with chaotic sound design layered on top.",
    },

    // --- R&B & Soul ---
    {
        name: "R&B / Neo-Soul",
        category: "genre",
        aliases: ["rnb", "r&b", "neo soul", "modern rnb", "contemporary rnb", "soul music", "r and b"],
        definition: "Rhythm and Blues — smooth, groove-based music centered on vocals, jazz-influenced chords, and laid-back drums. Neo-Soul adds organic, live-instrument textures.",
        context: "Classic R&B: Marvin Gaye, Stevie Wonder. Neo-Soul: D'Angelo, Erykah Badu, Frank Ocean. Modern: Daniel Caesar, SZA, Steve Lacy.",
        beginner_tip: "Recipe: 80-100 BPM, soft kick + snappy snare, smooth electric bass, warm Rhodes/Wurlitzer piano chords with 7ths and 9ths, and space for a vocal melody. Groove and feel matter more than complexity.",
    },

    // --- Rock & Alternative ---
    {
        name: "Rock Production",
        category: "genre",
        aliases: ["rock", "rock beat", "rock music", "guitar music", "rock production", "indie rock", "alternative rock"],
        definition: "Guitar-driven music with a live band feel — drums, bass, guitar(s), and vocals. Production ranges from raw and gritty to polished and layered.",
        context: "The broadest genre. Subgenres: Punk (fast, aggressive), Grunge (heavy, distorted), Indie Rock (quirky, lo-fi), Pop Rock (radio-friendly), Metal (extreme).",
        beginner_tip: "Recipe: 120 BPM, live-sounding kick/snare/hat pattern, distorted electric guitar chords, bass following the guitar root notes, and maybe a lead guitar melody. Use room reverb on drums for a 'live' feel.",
    },
    {
        name: "Metal / Heavy Rock",
        category: "genre",
        aliases: ["metal", "heavy metal", "metalcore", "djent", "death metal", "heavy rock"],
        definition: "Aggressive, heavy guitar-driven music with distorted guitars, fast double-kick drums, and intense energy. Tuned down for extra heaviness.",
        context: "Subgenres: Thrash (Metallica), Death Metal (extreme), Djent (polyrhythmic, Meshuggah), Metalcore (breakdowns, Bring Me The Horizon).",
        beginner_tip: "Recipe: 100-180 BPM, heavily distorted downtuned guitars, double-kick drum patterns, palm-muted riffs, breakdowns (half-time heavy sections). Use amp sim plugins for guitar tones.",
    },

    // --- Latin & Caribbean ---
    {
        name: "Reggaeton",
        category: "genre",
        aliases: ["reggaeton beat", "reggaeton production", "dembow beat", "latin trap", "perreo", "bad bunny style"],
        definition: "Latin urban music built on the iconic Dem Bow riddim — a syncopated kick-snare pattern that's instantly recognizable. Usually 85-100 BPM.",
        context: "Exploded globally via Daddy Yankee, Bad Bunny, J Balvin, Ozuna. Modern reggaeton often blends with Trap and Pop.",
        beginner_tip: "Recipe: 95 BPM, the classic Dem Bow drum pattern (kick on 1 and 3, snare on every off-beat), a simple bass pattern, and a catchy melodic hook. The drum pattern IS reggaeton — get that right and you're 80% there.",
    },
    {
        name: "Afrobeats",
        category: "genre",
        aliases: ["afrobeat", "afrobeats", "afro beat", "amapiano", "afro pop", "burna boy style", "wizkid style"],
        definition: "A broad term for modern African-influenced pop music with infectious rhythms, log drums, shakers, and a bouncy, percussive groove. Usually 100-120 BPM.",
        context: "Global phenomenon led by Burna Boy, Wizkid, Davido, Tems, Rema. Amapiano is a South African subgenre with log drums and deep basslines.",
        beginner_tip: "Recipe: 108 BPM, bouncy kick pattern, shaker or hi-hat grooves, log drum hits (for Amapiano), percussive guitar, warm pads, and call-and-response vocal melodies. The groove should make you dance.",
    },
    {
        name: "Dancehall",
        category: "genre",
        aliases: ["dancehall beat", "dancehall production", "jamaican dancehall", "bashment"],
        definition: "Jamaican-rooted dance music with heavy bass, digital riddims, and an energetic, bouncy rhythm. Usually 90-110 BPM.",
        context: "Roots in Jamaica. Artists: Vybz Kartel, Sean Paul, Popcaan, Shenseea. Heavily influenced Reggaeton, Moombahton, and modern Pop.",
        beginner_tip: "Recipe: 100 BPM, punchy electronic kick + snare pattern, heavy sub-bass, digital/synthetic instrument sounds, and a catchy rhythmic vocal hook. The riddim (instrumental) is shared between multiple artists in dancehall culture.",
    },
    {
        name: "Reggae",
        category: "genre",
        aliases: ["reggae beat", "reggae music", "dub", "roots reggae", "bob marley", "one drop"],
        definition: "Jamaican music characterized by the 'one drop' rhythm (kick on beat 3, guitar/keys on off-beats), a warm bass-heavy sound, and a laid-back groove. Usually 70-90 BPM.",
        context: "Bob Marley, Peter Tosh, Lee Scratch Perry. Dub is the instrumental, effects-heavy version. One of the most influential genres in history.",
        beginner_tip: "Recipe: 78 BPM, kick ONLY on beat 3 (the 'one drop'), guitar or keys playing 'chops' on every off-beat (the 'skank'), deep warm bass, and lots of reverb/delay on everything for a dub feel.",
    },
    {
        name: "Moombahton",
        category: "genre",
        aliases: ["moombahton", "moombah", "tropical bass", "slow house"],
        definition: "A fusion genre blending House music's structure with Reggaeton/Dancehall rhythms at a slower tempo. Usually 108-112 BPM.",
        context: "Created by Dave Nada in 2009 by slowing down a House track to Reggaeton tempo. Bridges Latin and electronic music.",
        beginner_tip: "Recipe: 110 BPM, four-on-the-floor kick OR dem bow pattern, tropical percussion (congas, bongos), synth stabs, and a rolling bassline. Think of it as House music on a beach vacation.",
    },
    {
        name: "Bachata",
        category: "genre",
        aliases: ["bachata beat", "bachata music", "dominican bachata", "modern bachata"],
        definition: "A romantic Dominican genre with a distinctive guitar-driven rhythm, bongo patterns, and a syncopated bass feel. Usually 120-140 BPM.",
        context: "Traditional: Romeo Santos, Aventura. Modern Bachata fuses with Pop and R&B. Huge in Latin dance culture.",
        beginner_tip: "Recipe: 130 BPM, bongo pattern with the classic 'derecho' rhythm, acoustic or nylon guitar arpeggios, bass guitar following the chord roots, and a maracas/guira shaker pattern.",
    },
    {
        name: "Salsa",
        category: "genre",
        aliases: ["salsa music", "salsa beat", "salsa production", "latin salsa"],
        definition: "An energetic Latin dance genre with layered percussion (clave, congas, timbales), a strong piano montuno pattern, and a driving horn section. Usually 160-220 BPM.",
        context: "Roots in Cuban Son and NYC Latin communities. Artists: Celia Cruz, Hector Lavoe, Marc Anthony. The clave rhythm is the heartbeat of Salsa.",
        beginner_tip: "Recipe: 180 BPM, start with the 'son clave' pattern (3-2 or 2-3 rhythm), add conga drum pattern, a piano 'montuno' (repeated rhythmic pattern), and bass following the clave. Everything revolves around the clave.",
    },

    // --- Funk, Soul, Disco ---
    {
        name: "Funk",
        category: "genre",
        aliases: ["funk beat", "funk music", "funky beat", "get funky", "groove music"],
        definition: "A rhythmically complex, groove-driven genre emphasizing syncopated bass, tight drums, and rhythmic guitar. Everything serves the GROOVE. Usually 90-120 BPM.",
        context: "James Brown, Parliament/Funkadelic, Bootsy Collins. Funk is the ancestor of Hip-Hop, House, and modern Pop production.",
        beginner_tip: "Recipe: 100 BPM, heavily syncopated kick/snare pattern with ghost notes, a BUSY syncopated bassline, rhythmic 'chicken scratch' guitar, and horn stabs. The 'one' (beat 1) is EVERYTHING in Funk.",
    },
    {
        name: "Disco",
        category: "genre",
        aliases: ["disco beat", "disco music", "nu-disco", "disco production", "daft punk style"],
        definition: "A dance genre built on a four-on-the-floor beat, driving basslines, lush strings, and a euphoric, celebratory energy. Usually 110-130 BPM.",
        context: "1970s origins (Donna Summer, Bee Gees, Chic). Massively influential on House and modern Pop. Nu-Disco revival: Daft Punk, Dua Lipa.",
        beginner_tip: "Recipe: 120 BPM, four-on-the-floor kick, open hi-hat on off-beats, funky bassline (octave jumps are classic), string pads, and rhythmic guitar. Nile Rodgers' guitar style defines disco.",
    },

    // --- Jazz & Blues ---
    {
        name: "Jazz Production",
        category: "genre",
        aliases: ["jazz", "jazz beat", "jazz chords", "jazz music", "smooth jazz", "jazz hop"],
        definition: "Improvisational music with complex harmony (7th, 9th, 13th chords), swing rhythms, and interplay between instruments. Ranges from smooth to avant-garde.",
        context: "Miles Davis, John Coltrane, Herbie Hancock. Modern jazz-influenced production (Robert Glasper, Tom Misch) bridges jazz with Hip-Hop and R&B.",
        beginner_tip: "Recipe: 100 BPM with swing, ride cymbal pattern (ding-ding-a-ding), walking bass (moving bass notes), piano comp with 7th/9th chords. Start with ii-V-I progressions — they're the foundation of jazz harmony.",
    },
    {
        name: "Blues",
        category: "genre",
        aliases: ["blues music", "blues beat", "12-bar blues", "blues production", "blues guitar"],
        definition: "Roots music built on the 12-bar blues chord progression (I-I-I-I-IV-IV-I-I-V-IV-I-V), blue notes, and emotional expression. Usually 70-120 BPM.",
        context: "The foundation of Rock, Jazz, R&B, and Hip-Hop. B.B. King, Muddy Waters, Robert Johnson. The 12-bar blues is one of music's most important structures.",
        beginner_tip: "Recipe: 80 BPM with shuffle feel, the 12-bar blues progression (4 bars on I, 2 bars on IV, 2 bars on I, 1 bar V, 1 bar IV, 2 bars I), shuffle drums, and guitar with 'blue notes' (flat 3rd, flat 5th, flat 7th).",
    },

    // --- Country & Folk ---
    {
        name: "Country",
        category: "genre",
        aliases: ["country music", "country beat", "country production", "modern country", "country pop", "nashville"],
        definition: "American roots music featuring acoustic/electric guitar, fiddle, pedal steel, storytelling lyrics, and a straightforward song structure. Usually 100-140 BPM.",
        context: "From traditional (Johnny Cash, Hank Williams) to modern Pop-Country (Luke Combs, Morgan Wallen, Zach Bryan). Nashville is the industry hub.",
        beginner_tip: "Recipe: 120 BPM, 'train beat' drums (steady eighth-note hi-hat), acoustic guitar strumming or fingerpicking, bass following root notes, and a clear vocal-forward mix. Keep it honest and simple.",
    },

    // --- World & Experimental ---
    {
        name: "K-Pop Production",
        category: "genre",
        aliases: ["kpop", "k-pop", "korean pop", "k pop beat", "bts style", "blackpink style"],
        definition: "Highly polished Korean pop with genre-blending production — a single song might mix EDM drops, rap verses, R&B bridges, and rock choruses. Usually 100-140 BPM.",
        context: "BTS, BLACKPINK, Stray Kids, NewJeans. K-Pop production is known for its density, genre-switching within songs, and pristine mixing.",
        beginner_tip: "Recipe: varies wildly by section. The key is CONTRAST — a soft verse might suddenly shift into a hard-hitting chorus with completely different production. Don't be afraid to switch genres mid-song.",
    },
    {
        name: "Amapiano",
        category: "genre",
        aliases: ["amapiano beat", "amapiano production", "south african house", "log drum", "piano house"],
        definition: "A South African genre blending deep house, jazz, and lounge music with distinctive log drum bass, wide pads, and a hypnotic groove. Usually 110-120 BPM.",
        context: "Originated in South African townships. Global breakout via Kabza De Small, DJ Maphorisa, Uncle Waffles. The log drum sound is instantly recognizable.",
        beginner_tip: "Recipe: 115 BPM, deep four-on-the-floor kick, the signature log drum bassline (a pitched-down wooden drum sound), wide shaker patterns, jazzy Rhodes piano chords, and sparse vocal chops.",
    },
    {
        name: "Grime",
        category: "genre",
        aliases: ["grime beat", "grime music", "uk grime", "140 bpm", "eskimo dance"],
        definition: "A raw, aggressive UK genre with dark square-wave bass, icy synths, and a driving 140 BPM rhythm. The vocals are fast, punchy, and rhythmic.",
        context: "Born in London (Wiley, Dizzee Rascal, Skepta, Stormzy). Distinct from UK Drill — Grime is more electronic and synth-based.",
        beginner_tip: "Recipe: 140 BPM, aggressive square-wave or reese bass, icy/metallic synth stabs, tight electronic drums, minimal arrangement. The energy should feel confrontational and urgent.",
    },
    {
        name: "Jersey Club",
        category: "genre",
        aliases: ["jersey club beat", "jersey club", "jersey bounce", "bed squeak beat"],
        definition: "A high-energy, sample-heavy dance genre with rapid-fire kick patterns, chopped vocal samples, and a distinctive bouncy rhythm. Usually 130-145 BPM.",
        context: "Born in Newark, NJ. Characterized by its 'bed squeak' sound, pitched vocal chops, and relentless energy. Artists: DJ Sliink, Nadus. Went viral on TikTok.",
        beginner_tip: "Recipe: 140 BPM, rapid kick drum patterns (kick-kick-kick-rest), chopped and pitched vocal samples, 'bed squeak' FX, hi-hat rolls, and a bouncy, energetic vibe. It's all about the sample chops.",
    },
    {
        name: "Brazilian Funk (Funk Carioca)",
        category: "genre",
        aliases: ["funk carioca", "baile funk", "brazilian funk", "funk brasil", "anitta style"],
        definition: "A high-energy Brazilian dance genre with booming 808 bass, call-and-response vocals, and the distinctive 'tamborzao' drum pattern. Usually 130-150 BPM.",
        context: "Born in Rio de Janeiro's favelas. Now global via Anitta, MC Kevinho, LUDMILLA. The 'tamborzao' beat is the genre's signature.",
        beginner_tip: "Recipe: 130 BPM, the 'tamborzao' kick pattern (syncopated, bouncy), heavy sub-bass 808, simple vocal chants, and minimal melodic elements. The drum pattern and bass carry everything.",
    },
    {
        name: "Dembow / Dominican Dembow",
        category: "genre",
        aliases: ["dembow music", "dominican dembow", "el alfa style", "dembow beat"],
        definition: "A fast, percussive Dominican genre evolved from Reggaeton with more aggressive drums and rapid-fire vocals. Usually 115-130 BPM.",
        context: "El Alfa, Tokischa, Rochy RD. Distinct from Puerto Rican Reggaeton — faster, rawer, more percussive. Massive in Latin clubs.",
        beginner_tip: "Recipe: 120 BPM, aggressive version of the dem bow drum pattern with more percussion layers, heavy bass, minimal melody, and high-energy vocal delivery. Think Reggaeton's wild cousin.",
    },
    {
        name: "Afro House",
        category: "genre",
        aliases: ["afro house beat", "afro house production", "tribal house", "black coffee style"],
        definition: "A fusion of House music with African percussion, polyrhythmic drums, and organic textures. Deep, spiritual, and groove-heavy. Usually 118-125 BPM.",
        context: "Black Coffee, Keinemusik, Rampa, Da Capo. Bridges African musical traditions with electronic dance music. Huge in Ibiza and global club scenes.",
        beginner_tip: "Recipe: 122 BPM, four-on-the-floor kick, layered African percussion (djembe, shakers, congas), deep bassline, organic textures (vocal chants, kalimba), and hypnotic repetition.",
    },

    // ===================================================================
    // BEGINNER — foundational concepts
    // ===================================================================
    {
        name: "BPM (Beats Per Minute)",
        category: "beginner",
        aliases: ["bpm", "tempo", "speed", "how fast", "beats per minute"],
        definition: "The speed of a song, measured in beats per minute. Higher BPM = faster. Common ranges: Hip-Hop 70-100, Pop 100-130, House 120-130, DnB 170-180.",
        context: "BPM is the first thing to set when starting a new project. It determines the energy and genre of your track.",
        beginner_tip: "Not sure what BPM to use? Tap along to a song you like at https://www.all8.com/tools/bpm.htm, or just start at 120 BPM — it works for almost everything.",
    },
    {
        name: "Time Signature",
        category: "beginner",
        aliases: ["time sig", "4/4", "3/4", "6/8", "meter", "time signature explained"],
        definition: "How beats are grouped in each measure. 4/4 (four beats per bar) is by far the most common. 3/4 is waltz time. 6/8 is a swaying feel.",
        context: "99% of pop, hip-hop, and EDM is in 4/4. Don't overthink this — just use 4/4 unless you specifically want something unusual.",
        beginner_tip: "Stick with 4/4 as a beginner. It means each bar has 4 beats, and the grid lines up nicely. You can experiment with odd time signatures later.",
    },
    {
        name: "Key / Scale",
        category: "beginner",
        aliases: ["key", "scale", "musical key", "major key", "minor key", "what key", "notes that sound good together"],
        definition: "A set of notes that sound good together. Major keys sound happy/bright; minor keys sound sad/dark. Every note in your song should (usually) belong to the same key.",
        context: "Choosing a key determines the mood of your track. C minor and G minor are popular in Hip-Hop; C major and G major are popular in Pop.",
        beginner_tip: "Easiest approach: pick C minor (all the white keys minus E, A, and B — or just use the black keys for a pentatonic scale that always sounds good). Use a scale plugin to lock to a key if you're unsure.",
    },
    {
        name: "Chord Progression",
        category: "beginner",
        aliases: ["chords", "chord progression", "harmony", "what chords to use", "chord pattern", "four chord song"],
        definition: "A sequence of chords that repeats throughout a section. Common example: I-V-vi-IV (like C-G-Am-F in the key of C) — used in thousands of hit songs.",
        context: "Chord progressions create the emotional foundation of a song. Even simple 2-3 chord progressions can sound great.",
        beginner_tip: "The 'hit song' progression: play C major, G major, A minor, F major in order (4 beats each). This progression is used in hundreds of famous songs. Start there and experiment.",
    },
    {
        name: "MIDI",
        category: "beginner",
        aliases: ["midi", "midi notes", "midi controller", "midi keyboard", "piano roll"],
        definition: "A digital language that tells instruments WHICH notes to play, HOW hard (velocity), and WHEN. MIDI isn't sound — it's instructions, like sheet music for computers.",
        context: "You create MIDI using the piano roll editor or a MIDI keyboard. The MIDI triggers virtual instruments (synths, drums, etc.) to produce sound.",
        beginner_tip: "Think of MIDI like a player piano scroll — it tells the instrument what to do, but makes no sound itself. You can change the instrument later and the same MIDI will play the new sound.",
    },
    {
        name: "Plugin / VST",
        category: "beginner",
        aliases: ["vst", "plugin", "vst plugin", "au plugin", "virtual instrument", "software instrument", "vsti"],
        definition: "Software that adds instruments or effects to your DAW. Virtual instruments (VSTi) generate sound; effects (VST) process sound. Common formats: VST, VST3, AU.",
        context: "Plugins are how you get sounds in your DAW. REAPER comes with built-in plugins (ReaEQ, ReaComp, etc.) and you can install third-party ones.",
        beginner_tip: "Start with the free plugins that come with REAPER — they're actually professional quality. As you learn what sounds you want, explore free third-party plugins before buying anything.",
    },
    {
        name: "DAW (Digital Audio Workstation)",
        category: "beginner",
        aliases: ["daw", "digital audio workstation", "reaper", "production software", "music software"],
        definition: "The software you make music in — like a virtual recording studio. REAPER is a DAW. Others include Ableton Live, FL Studio, Logic Pro, and Pro Tools.",
        context: "Your DAW is your main tool. REAPER is powerful, customizable, and affordable. The DAW doesn't determine the quality of your music — your skills do.",
        beginner_tip: "Don't worry about which DAW is 'best' — they all make the same music. Focus on learning ONE DAW deeply. REAPER is a great choice because it's flexible and has a huge community.",
    },
    {
        name: "Mixing vs. Mastering",
        category: "beginner",
        aliases: ["mixing", "mastering", "mix and master", "what is mixing", "what is mastering", "difference between mixing and mastering"],
        definition: "Mixing: balancing all the individual tracks (volume, EQ, effects) so they sound good together. Mastering: final polish on the mixed stereo file to make it loud, consistent, and ready for release.",
        context: "Mixing is done first, mastering is the final step. They require different skills and tools.",
        beginner_tip: "As a beginner, focus on mixing first — get your tracks sounding balanced and clear. Mastering can wait. A good mix is 90% of the battle.",
    },
    {
        name: "Call and Response",
        category: "arrangement",
        aliases: ["question and answer", "call response", "antiphony"],
        definition: "A compositional technique where one musical phrase (the call) is followed by a second phrase (the response) that seems to answer it.",
        context: "Fundamental in Blues, Jazz, Gospel, and melodic arrangement in all genres. Creates a conversational feel in music.",
        beginner_tip: "Try writing a 2-bar melody, then answer it with a different 2-bar melody. It's like a musical conversation — one part asks, the other answers.",
    },
    {
        name: "Layering",
        category: "sound_design",
        aliases: ["layer", "sound layering", "stacking sounds", "layered drums", "fat sound"],
        definition: "Combining multiple sounds together to create a fuller, richer result. For example, layering two kick drums or two synth patches.",
        context: "Used in all genres to make sounds bigger and more interesting. Professional drums almost always use layered samples.",
        beginner_tip: "Layer a punchy kick with a sub-heavy kick to get both the click AND the low-end thump. Just make sure layered sounds don't clash in frequency — use EQ to give each layer its own space.",
    },
    {
        name: "Automation",
        category: "mixing",
        aliases: ["automate", "automation lane", "volume automation", "parameter automation", "moving faders"],
        definition: "Recording changes to any parameter over time — volume, pan, filter cutoff, effect sends, etc. Makes static mixes come alive with movement.",
        context: "Professional mixes use automation extensively. Even subtle volume rides on vocals make a huge difference.",
        beginner_tip: "Start with volume automation: make the verse quieter and the chorus louder. Then try automating a filter cutoff to open up during the chorus. Automation is what turns a loop into a song.",
    },
    // ===================================================================
    // EMOTIONS & MOODS — how to create specific feelings
    // ===================================================================
    {
        name: "Sad / Melancholic",
        category: "emotion",
        aliases: ["sad beat", "sad music", "emotional beat", "depressing music", "how to make sad music", "melancholy"],
        definition: "Music that evokes sadness or longing. Key characteristics: Minor keys, slow tempos, and intimate instrumentation.",
        context: "Common in Ballads, Lo-Fi, and Emo Rap. Think Adele, juice WRLD, XXXTENTACION.",
        beginner_tip: "Recipe: Use a Minor scale (Natural Minor). Slow tempo (60-80 BPM). Use piano or strings. Drench everything in reverb. Use 'closed' chord voicings in the lower midrange for a somber feel.",
    },
    {
        name: "Hype / Aggressive",
        category: "emotion",
        aliases: ["hype beat", "aggressive music", "angry beat", "hard beat", "gym music", "workout music"],
        definition: "High-energy music meant to pump you up. Uses dissonance, loud drums, and distortion.",
        context: "Trap, Drill, Heavy Metal, Dubstep. Music for working out or moshing.",
        beginner_tip: "Recipe: Use the PHRYGIAN mode (minor scale with a flat 2nd). Fast tempo (140+ BPM). Distorted 808s. Use semitone intervals (notes right next to each other) to create tension and dissonance.",
    },
    {
        name: "Happy / Uplifting",
        category: "emotion",
        aliases: ["happy beat", "uplifting music", "positive vibes", "good vibes", "cheerful music"],
        definition: "Music that feels bright and optimistic. Major keys and fast/bouncy rhythms.",
        context: "Pop, House, Future Bass. Katy Perry, Avicii.",
        beginner_tip: "Recipe: Use a Major scale or Lydian mode. Fast or bouncy tempo (120+ BPM). Bright sounds (supersaws, bells, acoustic guitar). Keep chords simple (I-IV-V). Avoid too many minor chords.",
    },
    {
        name: "Chill / Relaxed",
        category: "emotion",
        aliases: ["chill beat", "relaxing music", "vibe music", "study music", "background music"],
        definition: "Low-energy music for relaxing. Smooth textures, slow tempos, and lack of harsh transients.",
        context: "Lo-Fi, Ambient, R&B. Music to study or sleep to.",
        beginner_tip: "Recipe: Moderate tempo (80-90 BPM). Use 'extended' chords (Major 7th, Minor 9th) for a jazzy feel. Filter out the high frequencies (low-pass filter) on drums and synths to make them sound soft and warm.",
    },
    {
        name: "Dark / Mysterious",
        category: "emotion",
        aliases: ["dark beat", "mysterious music", "creepy music", "horror music", "suspense"],
        definition: "Music that creates tension and unease. Uses dissonance, chromaticism, and sparse arrangement.",
        context: "Drill, Techno, Cinematic scores.",
        beginner_tip: "Recipe: Minor scale or Locrian mode. Use lots of space/silence. unexpected sounds. Use a heavy, detuned 808. Pitch-shift samples down. Dissonant intervals like the tritone (6 semitones) create instant evil vibes.",
    },

    // ===================================================================
    // SPECIFIC GENRE RECIPES — Detailed patterns
    // ===================================================================
    {
        name: "Jersey Club Recipe",
        category: "genre_recipe",
        aliases: ["how to make jersey club", "jersey club pattern", "jersey kick pattern"],
        definition: "The 'heartbeat' of Jersey Club. A specific 5-hit kick pattern in one bar.",
        context: "The defining element of the genre. If you don't use this kick pattern, it's not Jersey Club.",
        beginner_tip: "Kick Pattern (1 Bar): Beat 1, Beat 2, Beat 3, Beat 4, and the 'and' of 4. \nRhythm: Boom - Boom - Boom - Boom-Boom. \nBPM: 135-145. \nAdd 'bed squeak' samples on the off-beats and triplet chopped vocals.",
    },
    {
        name: "UK Drill Recipe",
        category: "genre_recipe",
        aliases: ["how to make drill", "drill pattern", "drill hi hats", "drill 808"],
        definition: "Detailed Drill drum production. It's all about the syncopation and slides.",
        context: "Pop Smoke, Central Cee type beats.",
        beginner_tip: "1. Tempo: 140-145 BPM.\n2. Snare: Place on beat 3 and beat 8 (in double-time) — creating a 'delayed' feel.\n3. Hi-Hats: Use triplet grids (1/12 or 1/24). Randomize velocity.\n4. 808: MUST SLIDE. Use portamento to slide the bass pitch up an octave usually at the end of a bar.",
    },
    {
        name: "Modern Trap Recipe",
        category: "genre_recipe",
        aliases: ["how to make trap", "trap pattern", "rolling hi hats"],
        definition: "The distinct Atlanta Trap sound recipe.",
        context: "Future, Metro Boomin.",
        beginner_tip: "1. Tempo: 130-170 BPM.\n2. Snare: Hard clip on beat 3 of every measure.\n3. Hi-Hats: 2-step (1/8th notes) as base, then sprinkle in 1/32 note rolls.\n4. Kick/808: Keep them simple but LOUD. Sidechain isn't always needed if the samples are short and punchy.",
    },

    // ===================================================================
    // ADVANCED THEORY — Modes & Voicings
    // ===================================================================
    {
        name: "Phrygian Mode",
        category: "theory",
        aliases: ["phrygian", "trap scale", "evil scale", "spanish scale", "exotic scale"],
        definition: "A musical mode that sounds dark, aggressive, and exotic. It's the natural minor scale with a FLAT 2nd note.",
        context: "Used constantly in Trap, Drill, and Metal for that 'menacing' sound.",
        beginner_tip: "Take a natural minor scale (e.g., E Minor: E F# G A B C D) and flatten the second note (F# becomes F). That half-step movement from E to F creates instant tension and evil vibes.",
    },
    {
        name: "Lydian Mode",
        category: "theory",
        aliases: ["lydian", "dreamy scale", "movie scale", "simpsons scale", "sci-fi scale"],
        definition: "A major scale with a SHARP 4th note. It sounds floaty, magical, and hopeful.",
        context: "Film scores (E.T., Back to the Future) and dreamy Pop/Ambient music.",
        beginner_tip: "Take a C Major scale (all white keys) and sharpen the 4th note (F becomes F#). Try playing a Major II chord (D Major in key of C) to really bring out that Lydian sound.",
    },
    {
        name: "Dorian Mode",
        category: "theory",
        aliases: ["dorian", "funky minor", "house scale", "santana scale"],
        definition: "A minor scale with a NATURAL 6th note (instead of flat 6). Sounds cooler, funkier, and less 'sad' than normal minor.",
        context: "Daft Punk 'Get Lucky', Santana 'Oye Como Va', Deep House, Funk.",
        beginner_tip: "Play D minor on all white keys (D to D). That's Dorian. It has a 'bright minor' sound that is great for groovy basslines.",
    },
    {
        name: "Shell Chords",
        category: "theory",
        aliases: ["jazz chords", "simple chords", "shells", "guide tones"],
        definition: "Playing only the essential notes of a chord: The Root, the 3rd, and the 7th. You leave out the 5th.",
        context: "Essential for Jazz, Neo-Soul, and Lofi Hip-Hop. Makes complex chords sound cleaner.",
        beginner_tip: "If your 7th chords sound muddy, delete the 5th (the middle note). Just play Root-3rd-7th. It instantly sounds more professional and jazzy.",
    },
    {
        name: "Chord Extensions",
        category: "theory",
        aliases: ["7ths", "9ths", "11ths", "fancy chords", "extensions", "color notes"],
        definition: "Adding extra notes on top of a basic triad (1-3-5) to add color and emotion. 7ths are jazzy, 9ths are dreamy.",
        context: "R&B, Jazz, Lofi, Neo-Soul.",
        beginner_tip: "To make any chord sound 'expensive', add the 7th node (count 7 notes up from the root in the scale) or the 9th. C Major becomes C Major 9 (C-E-G-B-D).",
    },
];

// Stop words to ignore when tokenizing queries
const _STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'it', 'i', 'me', 'my', 'do', 'does', 'how',
    'to', 'what', 'can', 'you', 'want', 'make', 'add', 'put', 'get',
    'in', 'on', 'of', 'for', 'with', 'that', 'this', 'and', 'or', 'so',
    'like', 'some', 'about', 'more', 'just', 'really', 'very',
]);

function searchMusicTerms(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // 1. Exact match on name or aliases
    const exact = MUSIC_TERMS.find(t =>
        t.name.toLowerCase() === q ||
        t.aliases.some(a => a.toLowerCase() === q)
    );
    if (exact) return [exact];

    // 2. Tokenize query — remove stop words for better matching
    const tokens = q.split(/\s+/).filter(w => w.length >= 2 && !_STOP_WORDS.has(w));

    // 3. Score each term
    const scored = MUSIC_TERMS
        .map(t => {
            let score = 0;
            const nl = t.name.toLowerCase();
            const def = t.definition.toLowerCase();
            const ctx = t.context.toLowerCase();
            const tip = (t.beginner_tip || '').toLowerCase();
            const allAliases = t.aliases.map(a => a.toLowerCase());

            // Full query substring match (high confidence)
            if (nl.includes(q)) score += 15;
            if (allAliases.some(a => a.includes(q))) score += 12;
            if (def.includes(q)) score += 5;
            if (ctx.includes(q)) score += 3;

            // Token-level matching (catches "what is eq", "how to compress", etc.)
            for (const tok of tokens) {
                if (nl.includes(tok)) score += 8;
                if (allAliases.some(a => a.includes(tok))) score += 6;
                if (def.includes(tok)) score += 2;
                if (ctx.includes(tok)) score += 1;
                if (tip.includes(tok)) score += 1;
            }

            return { term: t, score };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.term);

    return scored;
}

module.exports = {
    MUSIC_TERMS,
    searchMusicTerms
};
