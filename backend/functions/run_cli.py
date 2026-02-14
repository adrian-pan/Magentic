#!/usr/bin/env python3
"""
CLI for backend functions. Called by Node.
Stdin: JSON {"action": "separate_stems"|"transcribe_to_midi", "input_path": "...", "output_dir": "..."}
Stdout: JSON result
"""
import json
import sys

def main():
    try:
        inp = json.load(sys.stdin)
        action = inp.get("action")
        input_path = inp.get("input_path")
        output_dir = inp.get("output_dir")

        if not action or not input_path:
            print(json.dumps({"error": "Missing action or input_path"}))
            sys.exit(1)

        if action == "separate_stems":
            from api import separate_stems
            stems = separate_stems(input_path, output_dir)
            print(json.dumps({"stems": stems}))

        elif action == "transcribe_to_midi":
            from api import transcribe_to_midi
            midi_path = transcribe_to_midi(input_path, output_dir)
            print(json.dumps({"midi_path": midi_path}))

        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
