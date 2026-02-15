"""
Modal serverless app for Magentic ML functions:
  - /separate-stems  — Demucs (htdemucs) stem separation
  - /transcribe-to-midi — Basic Pitch (ONNX) audio-to-MIDI

Optimized: models pre-loaded at container startup, Demucs via Python API (no subprocess).

Deploy:  modal deploy planner/modal_functions.py
Health:  curl https://kaisunwang--magentic-functions-serve.modal.run/health
"""

import base64
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import modal
from fastapi import FastAPI
from pydantic import BaseModel

app = modal.App("magentic-functions")

# ---------------------------------------------------------------------------
# Image: CUDA + PyTorch + Demucs + Basic Pitch (ONNX)
# ---------------------------------------------------------------------------
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04",
        add_python="3.10",
    )
    .apt_install("ffmpeg")
    .pip_install(
        "torch",
        "torchaudio",
        index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "dora-search",
        "einops",
        "julius>=0.2.3",
        "lameenc>=1.2",
        "openunmix",
        "pyyaml",
        "tqdm",
    )
    .pip_install("demucs", extra_options="--no-deps")
    .pip_install("numpy<2")
    .pip_install(
        "basic-pitch",
        "onnxruntime",
        "librosa",
        "mir_eval",
        "pretty_midi",
        "resampy>=0.2.2,<0.4.3",
        "scikit-learn",
        "scipy",
        "typing_extensions",
    )
    .pip_install("requests", "fastapi")
    # Pre-download htdemucs model weights into the image
    .run_commands("python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"")
)

web_app = FastAPI()

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class StemRequest(BaseModel):
    input_url: str
    song_name: Optional[str] = None
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    bucket: str = "magentic-files"


class TranscribeRequest(BaseModel):
    input_url: str
    # Vocal-optimized: lower thresholds catch softer onsets & pitch frames
    onset_threshold: float = 0.5
    frame_threshold: float = 0.3
    minimum_note_length: int = 58  # ms


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _download(url: str, dest: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Magentic-Modal/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        with open(dest, "wb") as f:
            f.write(resp.read())


def _upload_to_supabase(
    supabase_url: str,
    service_key: str,
    bucket: str,
    storage_path: str,
    data: bytes,
    content_type: str,
) -> str:
    import requests as req_lib

    encoded = quote(storage_path, safe="/")
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{encoded}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = req_lib.post(upload_url, headers=headers, data=data, timeout=120)
    if resp.status_code >= 300:
        raise RuntimeError(f"Supabase upload failed ({resp.status_code}): {resp.text}")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{encoded}"


def _infer_ext(url: str) -> str:
    filename = url.split("?")[0].split("/")[-1]
    if "." in filename:
        ext = "." + filename.split(".")[-1].lower()
        if ext in (".mp3", ".wav", ".flac", ".m4a", ".ogg"):
            return ext
    return ".mp3"


def _safe_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in name) or "output"


# ---------------------------------------------------------------------------
# Persistent model holder — loaded once at container startup
# ---------------------------------------------------------------------------
_demucs_model = None
_bp_model = None


def _load_models():
    """Load Demucs + Basic Pitch models into GPU/memory once."""
    global _demucs_model, _bp_model

    if _demucs_model is None:
        import torch
        from demucs.pretrained import get_model

        model = get_model("htdemucs")
        model.eval()
        if torch.cuda.is_available():
            model.cuda()
        _demucs_model = model
        print(f"[startup] Demucs htdemucs loaded on {'cuda' if torch.cuda.is_available() else 'cpu'}")

    if _bp_model is None:
        from basic_pitch import ICASSP_2022_MODEL_PATH
        from basic_pitch.inference import predict

        # Warm up: run a tiny predict to load ONNX session into memory
        # (basic_pitch caches the session after first call)
        import numpy as np

        try:
            # Create a tiny silent wav to trigger model load
            _dummy_path = "/tmp/_bp_warmup.wav"
            import soundfile as sf
            sf.write(_dummy_path, np.zeros(16000, dtype=np.float32), 16000)
            predict(_dummy_path)
            os.remove(_dummy_path)
        except Exception:
            pass  # warmup is best-effort
        _bp_model = True
        print("[startup] Basic Pitch ONNX model loaded")


# ---------------------------------------------------------------------------
# Demucs via Python API (no subprocess)
# ---------------------------------------------------------------------------
def _separate_stems_fast(input_path: str, output_dir: str) -> dict:
    """Separate stems using pre-loaded Demucs model — no subprocess overhead."""
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.audio import save_audio

    model = _demucs_model
    device = next(model.parameters()).device

    # Load audio at model's sample rate
    wav, sr = torchaudio.load(input_path)
    if sr != model.samplerate:
        wav = torchaudio.functional.resample(wav, sr, model.samplerate)

    # Ensure stereo
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    elif wav.shape[0] > 2:
        wav = wav[:2]

    # Normalize
    ref = wav.mean(0)
    mean = ref.mean()
    std = ref.std()
    wav = (wav - mean) / (std + 1e-8)

    # Run model
    with torch.no_grad():
        sources = apply_model(model, wav[None].to(device), progress=False)[0]

    # Denormalize
    sources = sources * std + mean
    sources = sources.cpu()

    # Save stems as mp3
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem_paths = {}
    for i, name in enumerate(model.sources):
        stem_path = out_dir / f"{name}.mp3"
        save_audio(sources[i], str(stem_path), model.samplerate)
        stem_paths[name] = str(stem_path)

    return stem_paths


# ---------------------------------------------------------------------------
# Basic Pitch via Python API (pre-loaded ONNX session)
# ---------------------------------------------------------------------------
def _transcribe_to_midi_fast(
    input_path: str,
    output_dir: str,
    onset_threshold: float = 0.5,
    frame_threshold: float = 0.3,
    minimum_note_length: int = 58,
) -> str:
    """Transcribe audio to MIDI using pre-loaded Basic Pitch model."""
    from basic_pitch.inference import predict

    input_p = Path(input_path)
    output_p = Path(output_dir)
    output_p.mkdir(parents=True, exist_ok=True)

    try:
        model_output, midi_data, note_events = predict(
            str(input_p),
            onset_threshold=onset_threshold,
            frame_threshold=frame_threshold,
            minimum_note_length=minimum_note_length,
        )
    except Exception as e:
        # Retry with more permissive vocal-friendly settings
        print(f"[transcribe] First attempt failed ({e}), retrying with vocal settings...")
        model_output, midi_data, note_events = predict(
            str(input_p),
            onset_threshold=0.3,
            frame_threshold=0.15,
            minimum_note_length=127,
        )

    if not note_events or len(note_events) == 0:
        raise RuntimeError(
            "No pitched notes detected in the audio. "
            "This can happen with vocals that are heavily processed, very quiet, "
            "or contain mostly unpitched sounds (e.g. rap, spoken word)."
        )

    midi_filename = input_p.stem + "_basic_pitch.mid"
    midi_file = output_p / midi_filename
    midi_data.write(str(midi_file))

    return str(midi_file)


# ---------------------------------------------------------------------------
# Modal function + FastAPI endpoints
# ---------------------------------------------------------------------------
@app.function(
    image=image,
    gpu="A10G",
    timeout=600,
    scaledown_window=600,
)
@modal.concurrent(max_inputs=2)
@modal.asgi_app()
def serve():
    @web_app.on_event("startup")
    def startup():
        _load_models()

    @web_app.get("/health")
    def health():
        return {
            "status": "ok",
            "models": ["htdemucs", "basic_pitch_onnx"],
            "demucs_loaded": _demucs_model is not None,
            "bp_loaded": _bp_model is not None,
        }

    @web_app.post("/separate-stems")
    def separate_stems(req: StemRequest):
        with tempfile.TemporaryDirectory() as tmpdir:
            ext = _infer_ext(req.input_url)
            input_path = os.path.join(tmpdir, f"input{ext}")
            _download(req.input_url, input_path)

            stems = _separate_stems_fast(input_path, os.path.join(tmpdir, "stems"))

            song_name = req.song_name or Path(input_path).stem
            safe_song = _safe_name(song_name)

            if req.supabase_url and req.supabase_service_key:
                stem_urls = {}
                for name, fpath in stems.items():
                    with open(fpath, "rb") as f:
                        data = f.read()
                    storage_path = f"{safe_song}/{name}.mp3"
                    stem_urls[name] = _upload_to_supabase(
                        req.supabase_url, req.supabase_service_key,
                        req.bucket, storage_path, data, "audio/mpeg",
                    )
                return {"stem_urls": stem_urls}

            result = {}
            for name, fpath in stems.items():
                with open(fpath, "rb") as f:
                    result[name] = base64.b64encode(f.read()).decode("utf-8")
            return {"stems": result}

    @web_app.post("/transcribe-to-midi")
    def transcribe_to_midi(req: TranscribeRequest):
        with tempfile.TemporaryDirectory() as tmpdir:
            ext = _infer_ext(req.input_url)
            input_path = os.path.join(tmpdir, f"input{ext}")
            _download(req.input_url, input_path)

            midi_path = _transcribe_to_midi_fast(
                input_path,
                os.path.join(tmpdir, "midi"),
                onset_threshold=req.onset_threshold,
                frame_threshold=req.frame_threshold,
                minimum_note_length=req.minimum_note_length,
            )

            with open(midi_path, "rb") as f:
                midi_b64 = base64.b64encode(f.read()).decode("utf-8")

            return {"midi_base64": midi_b64, "filename": os.path.basename(midi_path)}

    return web_app
