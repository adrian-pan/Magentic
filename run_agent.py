#!/usr/bin/env python3
"""
CLI entry point for the orchestrator. Called by the backend.
Reads JSON from stdin: {"prompt": "..."}
Outputs JSON to stdout: {"plan": [...], "results": {...}, "errors": [...]}
"""
import json
import sys

def main():
    try:
        inp = json.load(sys.stdin)
        prompt = inp.get("prompt", "").strip()
        if not prompt:
            print(json.dumps({"plan": [], "results": {}, "errors": ["Empty prompt"]}))
            sys.exit(1)

        from agents.orchestrator import handle
        result = handle(prompt, verbose=False)

        # Ensure JSON-serializable (handle returns plain dicts, but be safe)
        out = {
            "plan": result.get("plan", []),
            "results": result.get("results", {}),
            "errors": result.get("errors", []),
        }
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({
            "plan": [],
            "results": {},
            "errors": [str(e)],
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
