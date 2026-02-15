"""
RunPod serverless handler for Magentic ML functions.
Input: { "action": "separate_stems"|"transcribe_to_midi", "input_url": "..." }
Output: stems dict (base64) or midi_base64 — backend decodes and uploads to Supabase.
"""
import base64
import os
import sys
import tempfile
import urllib.request
from urllib.parse import quote

import runpod
import requests

sys.path.insert(0, "/app")
from api import separate_stems, transcribe_to_midi


def download_file(url: str, dest_path: str) -> None:
    """Download file from URL to local path."""
    req = urllib.request.Request(url, headers={"User-Agent": "Magentic-RunPod/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        with open(dest_path, "wb") as f:
            f.write(resp.read())


def upload_to_supabase(
    supabase_url: str,
    service_key: str,
    bucket: str,
    storage_path: str,
    data: bytes,
    content_type: str,
) -> str:
    """Upload bytes to Supabase Storage and return public URL."""
    encoded_path = quote(storage_path, safe="/")
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{encoded_path}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = requests.post(upload_url, headers=headers, data=data, timeout=120)
    if resp.status_code >= 300:
        raise RuntimeError(f"Supabase upload failed ({resp.status_code}): {resp.text}")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{encoded_path}"


def handler(job):
    """RunPod handler: process job and return results."""
    job_input = job.get("input", {})
    action = job_input.get("action")
    input_url = job_input.get("input_url")
    supabase_url = job_input.get("supabase_url")
    supabase_service_key = job_input.get("supabase_service_key")
    bucket = job_input.get("bucket", "magentic-files")
    song_name = job_input.get("song_name")

    if not action or not input_url:
        return {"error": "Missing 'action' or 'input_url' in input"}

    if action not in ("separate_stems", "transcribe_to_midi"):
        return {"error": f"Unknown action: {action}"}

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input_audio")
        if "." in input_url.split("?")[0].split("/")[-1]:
            ext = "." + input_url.split("?")[0].split("/")[-1].split(".")[-1]
            if ext.lower() in (".mp3", ".wav", ".flac", ".m4a"):
                input_path += ext

        try:
            download_file(input_url, input_path)
        except Exception as e:
            return {"error": f"Failed to download: {e}"}

        try:
            if action == "separate_stems":
                output_dir = os.path.join(tmpdir, "stems")
                stems = separate_stems(input_path, output_dir, format="mp3")
                if song_name is None:
                    song_name = os.path.splitext(os.path.basename(input_path))[0]
                safe_song = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in song_name) or "output"

                # Prefer returning small URL payloads to avoid runsync body limits.
                if supabase_url and supabase_service_key:
                    result = {"stem_urls": {}}
                    for name, p in stems.items():
                        with open(p, "rb") as f:
                            data = f.read()
                        storage_path = f"{safe_song}/{name}.mp3"
                        result["stem_urls"][name] = upload_to_supabase(
                            supabase_url=supabase_url,
                            service_key=supabase_service_key,
                            bucket=bucket,
                            storage_path=storage_path,
                            data=data,
                            content_type="audio/mpeg",
                        )
                    return result

                # Fallback for environments without Supabase credentials.
                result = {"stems": {}}
                for name, p in stems.items():
                    with open(p, "rb") as f:
                        result["stems"][name] = base64.b64encode(f.read()).decode("utf-8")
                return result

            elif action == "transcribe_to_midi":
                output_dir = os.path.join(tmpdir, "midi")
                midi_path = transcribe_to_midi(input_path, output_dir)
                with open(midi_path, "rb") as f:
                    midi_b64 = base64.b64encode(f.read()).decode("utf-8")
                return {"midi_base64": midi_b64, "filename": os.path.basename(midi_path)}

        except Exception as e:
            return {"error": str(e)}


runpod.serverless.start({"handler": handler})
