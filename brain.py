"""
brain.py — CLI agent that generates beat instructions for Reaper DAW.

Asks the user for a genre, builds a configuration dictionary,
and writes it to instructions.json for downstream Lua consumption.
"""

import json
import os

# Genre presets
PRESETS = {
    "house": {
        "tempo": 120,
        "kick_sample": "/path/to/house_kick.wav",
        "hat_sample": "/path/to/house_hat.wav",
        "melody_notes": [60, 63, 67, 72],  # C minor triad arpeggio
    },
    "hiphop": {
        "tempo": 85,
        "kick_sample": "/path/to/hiphop_kick.wav",
        "hat_sample": "/path/to/hiphop_hat.wav",
        "melody_notes": [60, 62, 63, 67],
    },
}


def main():
    genre = input("What kind of beat do you want to make? (house/hiphop) ").strip().lower()

    if genre not in PRESETS:
        print(f"Unknown genre '{genre}'. Please choose 'house' or 'hiphop'.")
        return

    instructions = PRESETS[genre]

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instructions.json")
    with open(out_path, "w") as f:
        json.dump(instructions, f, indent=2)

    print(f"Wrote {genre} instructions to {out_path}")


if __name__ == "__main__":
    main()
