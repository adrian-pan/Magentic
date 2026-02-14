"""
Unified API for stem separation (Demucs) and audio-to-MIDI transcription (Basic Pitch).

Usage:
    from functions import separate_stems, transcribe_to_midi

    stems = separate_stems("song.mp3", "output/stems")
    midi_path = transcribe_to_midi(stems["bass"])  # MIDI saved next to stems
"""

from pathlib import Path
import os
import shutil
import subprocess
import sys
from typing import Optional, Union

_FUNCTIONS_DIR = Path(__file__).resolve().parent
_DEMUCS_DIR = _FUNCTIONS_DIR / "demucs"
_BASIC_PITCH_DIR = _FUNCTIONS_DIR / "basic-pitch"
_ONNX_MODEL_PATH = _BASIC_PITCH_DIR / "basic_pitch" / "saved_models" / "icassp_2022" / "nmp.onnx"


def separate_stems(
    input_path: Union[str, Path],
    output_dir: Union[str, Path],
    model: str = "htdemucs",
    format: str = "mp3",
) -> dict[str, str]:
    """
    Separate audio into stems (drums, bass, vocals, other) using Demucs.

    Args:
        input_path: Path to input audio file (mp3, wav, flac, etc.)
        output_dir: Directory for output stems (creates subdir model/track_name/)
        model: Model name (default: htdemucs)
        format: Output format - "mp3" or "wav"

    Returns:
        Dict mapping stem names to file paths, e.g.
        {"drums": "...", "bass": "...", "vocals": "...", "other": "..."}
    """
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    env = dict(os.environ)
    env["PYTHONPATH"] = str(_DEMUCS_DIR) + (f":{env.get('PYTHONPATH', '')}" if env.get("PYTHONPATH") else "")

    cmd = [
        sys.executable,
        "-m",
        "demucs.separate",
        "-n",
        model,
        "-o",
        str(output_dir),
        str(input_path),
    ]
    if format == "mp3":
        cmd.insert(-1, "--mp3")

    subprocess.run(cmd, check=True, env=env, cwd=str(_DEMUCS_DIR))

    song_name = input_path.stem
    demucs_stems_dir = output_dir / model / song_name
    if not demucs_stems_dir.exists():
        raise FileNotFoundError(f"Demucs output not found at {demucs_stems_dir}")

    # Flatten: move output_dir/model/song_name/* to output_dir/song_name/
    stems_dir = output_dir / song_name
    stems_dir.mkdir(parents=True, exist_ok=True)
    for f in demucs_stems_dir.iterdir():
        shutil.move(str(f), str(stems_dir / f.name))
    demucs_stems_dir.rmdir()
    (output_dir / model).rmdir()

    ext = "mp3" if format == "mp3" else "wav"
    return {f.stem: str(f) for f in stems_dir.iterdir() if f.suffix == f".{ext}"}


def transcribe_to_midi(
    input_path: Union[str, Path],
    output_dir: Optional[Union[str, Path]] = None,
    model_path: Union[str, Path, None] = None,
) -> str:
    """
    Transcribe audio to MIDI using Basic Pitch.

    Args:
        input_path: Path to input audio file (mp3, wav, flac, etc.)
        output_dir: Directory for output MIDI file (default: same folder as input)
        model_path: Optional path to model (default: ONNX ICASSP 2022 model)

    Returns:
        Path to the output .mid file
    """
    input_path = Path(input_path)
    output_dir = Path(output_dir) if output_dir is not None else input_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if str(_BASIC_PITCH_DIR) not in sys.path:
        sys.path.insert(0, str(_BASIC_PITCH_DIR))

    try:
        from basic_pitch.inference import predict_and_save
    except ImportError as e:
        raise ImportError(
            "basic-pitch not available. Install with: pip install 'basic-pitch[onnx]' "
            "or ensure basic-pitch is in functions/basic-pitch"
        ) from e

    # Default to ONNX model (most reliable across TF/CoreML compatibility issues)
    model = model_path if model_path else _ONNX_MODEL_PATH
    if isinstance(model, (str, Path)):
        model = Path(model)

    predict_and_save(
        [str(input_path)],
        str(output_dir),
        save_midi=True,
        sonify_midi=False,
        save_model_outputs=False,
        save_notes=False,
        model_or_model_path=model,
    )

    midi_filename = input_path.stem + "_basic_pitch.mid"
    midi_file = output_dir / midi_filename

    if not midi_file.exists():
        candidates = list(output_dir.glob("*.mid"))
        for cand in candidates:
            if input_path.stem in cand.name:
                return str(cand)
        raise FileNotFoundError(f"Basic-Pitch MIDI output not found at {midi_file}")

    return str(midi_file)
