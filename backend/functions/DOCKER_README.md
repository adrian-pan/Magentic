# Docker / RunPod Deployment

Package for deploying stem separation and audio-to-MIDI to RunPod serverless GPU.

## Build (from backend/functions/)

```bash
./build.sh
# or
docker build --platform linux/amd64 -t magentic-ml:latest .
```

## Push to Docker Hub

```bash
docker tag magentic-ml:latest YOUR_USERNAME/magentic-ml:latest
docker push YOUR_USERNAME/magentic-ml:latest
```

## RunPod Input/Output

**Input:**
```json
{
  "action": "separate_stems",
  "input_url": "https://example.com/track.mp3"
}
```
or
```json
{
  "action": "transcribe_to_midi",
  "input_url": "https://example.com/bass.mp3"
}
```

**Output (separate_stems):** `{ "stems": { "drums": "<base64>", "bass": "<base64>", ... } }`

**Output (transcribe_to_midi):** `{ "midi_base64": "<base64>", "filename": "..." }`

The backend decodes base64 and uploads to Supabase when calling RunPod.

## Deploy on RunPod

1. Push image to Docker Hub
2. RunPod Console → Serverless → New Endpoint
3. Import from Docker Registry → enter image URL
4. Select GPU (e.g. RTX 4090)
5. Set handler timeout (stem separation: 1–5 min per track)
