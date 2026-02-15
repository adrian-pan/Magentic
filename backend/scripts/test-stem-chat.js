#!/usr/bin/env node
/**
 * Test chatbot stem flow: generate stems and add to pattern.
 * Usage: node scripts/test-stem-chat.js [audio_url]
 *
 * If no URL given, fetches /api/files and uses the first audio file.
 * Requires: backend running, bridge + REAPER, Supabase + RunPod for stems.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;

async function getAudioContext(urlArg) {
    if (urlArg && (urlArg.startsWith('http://') || urlArg.startsWith('https://'))) {
        return {
            id: 'test',
            name: 'Imported Song',
            type: 'audio',
            url: urlArg,
        };
    }
    const res = await fetch(`${API_BASE}/api/files`);
    if (!res.ok) throw new Error('Failed to list files');
    const files = await res.json();
    const audio = files.find((f) => f.type === 'audio');
    if (!audio) {
        throw new Error('No audio files in import. Upload an MP3 via the Import Module first.');
    }
    return {
        id: audio.id,
        name: audio.name,
        type: audio.type,
        url: audio.url,
    };
}

async function main() {
    const urlArg = process.argv[2];
    console.log('Testing chatbot stem flow...\n');

    try {
        const contextFile = await getAudioContext(urlArg);
        console.log('Context file:', contextFile.name, '| URL:', contextFile.url);

        const message = 'Generate stems for this song and add them as audio files to the pattern.';
        console.log('\nSending:', message);
        console.log('(This will call separate_stems, then insert_media_to_track for each stem)\n');

        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: message }],
                contextFiles: [contextFile],
                includeProjectState: true,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('Error:', data.error || `HTTP ${res.status}`);
            process.exit(1);
        }

        console.log('--- Assistant response ---');
        console.log(data.message?.content || '(no content)');
        if (data.toolResults && data.toolResults.length > 0) {
            console.log('\n--- Tool calls ---');
            for (const tr of data.toolResults) {
                console.log(`  ${tr.tool}:`, JSON.stringify(tr.result).slice(0, 120) + '...');
            }
        }
        console.log('\nDone. Check REAPER for the stems on the timeline.');
    } catch (err) {
        console.error('Failed:', err.message);
        if (err.cause?.code === 'ECONNREFUSED') {
            console.error('Is the backend running? Start with: cd backend && npm run dev');
        }
        process.exit(1);
    }
}

main();
