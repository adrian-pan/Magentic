"""
Magentic functions: stem separation and audio-to-MIDI transcription.

Usage:
    from functions import separate_stems, transcribe_to_midi

    stems = separate_stems("song.mp3", "output/stems")
    midi_path = transcribe_to_midi(stems["bass"], "output/midi")
"""

from .api import separate_stems, transcribe_to_midi

__all__ = ["separate_stems", "transcribe_to_midi"]
