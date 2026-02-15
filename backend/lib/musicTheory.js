/**
 * musicTheory.js — A knowledge base of music production terminology
 * used by the "Educational Music Producer" agent.
 */

const MUSIC_TERMS = [
    {
        name: "Four-on-the-Floor",
        aliases: ["4-on-the-floor", "four on the floor", "kick every beat", "techno kick"],
        definition: "A rhythm pattern where the kick drum hits on every beat (1, 2, 3, 4) in a 4/4 time signature.",
        context: "The foundation of House, Techno, Trance, and Disco music. It provides a steady, driving pulse."
    },
    {
        name: "Backbeat",
        aliases: ["back beat", "snare on 2 and 4", "standard rock beat"],
        definition: "A rhythmic emphasis on the second and fourth beats of a 4/4 measure, typically played by the snare drum.",
        context: "The backbone of Rock, Pop, R&B, and Hip-Hop. It creates a sense of stability and forward motion."
    },
    {
        name: "Syncopation",
        aliases: ["off-beat", "syncepated"],
        definition: "Accenting a weak beat or an off-beat (between the counts) rather than a strong beat.",
        context: "Essential for Funk, Jazz, Latin, and modern electronic genres to add groove and prevent rhythms from sounding robotic."
    },
    {
        name: "Half-Time",
        aliases: ["half time", "breakdown feel"],
        definition: "A rhythmic feel where the snare hits on beat 3 only (instead of 2 and 4), making the tempo feel twice as slow while the BPM remains constant.",
        context: "Common in Dubstep, Trap, and Metal breakdowns to create a heavy, spacious feel."
    },
    {
        name: "Double-Time",
        aliases: ["double time", "fast feel"],
        definition: "A rhythmic feel where the snare hits on the 'and' of every beat (twice as fast as standard), making the tempo feel twice as fast.",
        context: "Used in Drum & Bass, Punk, and intense sections of Jazz."
    },
    {
        name: "Trap Hi-Hats",
        aliases: ["rolling hats", "hat rolls", "trap hats"],
        definition: "Fast, subdivided hi-hat rolls (often 1/16th, 1/32nd, or triplets) that pitch up or down.",
        context: "A defining characteristic of Trap and modern Hip-Hop production."
    },
    {
        name: "Dem Bow",
        aliases: ["dembow", "reggaeton beat", "tresillo"],
        definition: "A syncopated rhythm distinct to Reggaeton and Dancehall, characterized by a 'boom-ch-boom-ch' pattern (Kick on 1, 2, 3, 4; Snare on the 'and' of 1, 'and' of 2, etc, or specifically 3+3+2 subdivision).",
        context: " The driving rhythm behind Reggaeton, Moombahton, and much of modern Latin Pop."
    },
    {
        name: "Polyrhythm",
        aliases: ["cross-rhythm", "3 over 2", "4 against 3"],
        definition: "The simultaneous use of two or more conflicting rhythms that are not readily perceived as deriving from one another (e.g., triplets against straight eighths).",
        context: "Found in African music, Jazz, and complex IDM/Techno. Adds tension and complexity."
    },
    {
        name: "Call and Response",
        aliases: ["question and answer"],
        definition: "A compositional technique where one musical phrase (the call) is followed by a second phrase (the response) that seems to answer it.",
        context: "Fundamental in Blues, Jazz, and melodic arrangement in all genres."
    },
    {
        name: "Sidechain Compression",
        aliases: ["pumping", "ducking", "sidechain"],
        definition: "A production technique where the volume of one track (e.g., bass) is automatically lowered when another track (e.g., kick) plays.",
        context: "Crucial in EDM/House to let the kick cut through and create a rhythmic 'pumping' effect."
    }
];

function searchMusicTerms(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // 1. Exact match on name or aliases
    const exact = MUSIC_TERMS.find(t =>
        t.name.toLowerCase() === q ||
        t.aliases.some(a => a.toLowerCase() === q)
    );
    if (exact) return [exact];

    // 2. Partial match on definition or context or name
    return MUSIC_TERMS.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.aliases.some(a => a.toLowerCase().includes(q)) ||
        t.definition.toLowerCase().includes(q) ||
        t.context.toLowerCase().includes(q)
    );
}

module.exports = {
    MUSIC_TERMS,
    searchMusicTerms
};
