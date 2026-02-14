"""
agents/mix_agent.py — Mixing & balance specialist agent.

Handles levels, panning, track colors, gain staging, and overall
mix balance. Operates on existing tracks rather than creating new content.

Receives a plain-English task string and executes it by calling
REAPER tools via the OpenAI function-calling loop.
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from .tools import TOOL_SCHEMAS, TOOL_DISPATCH

load_dotenv()

MODEL = "gpt-4o"

SYSTEM_PROMPT = """\
You are a mixing engineer integrated with REAPER DAW.

You understand:
- Gain staging: keeping levels healthy without clipping
- Volume scale: 1.0 = 0 dB, 0.707 ≈ -3 dB, 0.5 ≈ -6 dB, 0.0 = silence
- Panning: -1.0 = full left, 0.0 = center, 1.0 = full right
- Automation: creating volume envelopes for dynamic changes
- Track organization and color coding conventions:
    drums   → orange-red  (r=220 g=80  b=40)
    bass    → deep blue   (r=40  g=80  b=200)
    chords  → purple      (r=140 g=60  b=200)
    melody  → yellow      (r=220 g=200 b=40)
    vocals  → pink        (r=220 g=100 b=160)
    fx/amb  → teal        (r=40  g=180 b=160)
- Standard mixing approach: keep lows centered, spread mids, highs can be wide

Rules:
- Always call analyze_project first to understand track names and current levels.
- Make decisions based on track names when not given explicit instructions.
- Explain your mix decisions briefly before calling tools.
- Prefer subtle moves: ±3 dB volume nudges, light panning (±0.3 to ±0.7).
- Set track colors to improve visual organization in REAPER.
"""

_MIX_TOOL_NAMES = {
    "set_track_volume", "set_track_pan", "set_track_color",
    "mute_track", "analyze_project",
}

def _to_openai_tools(names: set) -> list:
    schemas = [t for t in TOOL_SCHEMAS if t["name"] in names]
    if not any(t["name"] == "mute_track" for t in schemas):
        schemas.append({
            "name": "mute_track",
            "description": "Mute or unmute a track.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "track_index": {"type": "integer"},
                    "muted": {"type": "boolean", "default": True},
                },
                "required": ["track_index"],
            },
        })
    return [
        {"type": "function", "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        }}
        for t in schemas
    ]

MIX_TOOLS = _to_openai_tools(_MIX_TOOL_NAMES)


def run(task: str, verbose: bool = True) -> list[dict]:
    """
    Execute a mixing task.

    Parameters
    ----------
    task : str
        Natural-language instruction, e.g.
        "Balance all tracks, pan drums center, chords slightly left, melody right"
    verbose : bool
        Print tool calls and results to stdout.

    Returns
    -------
    list of result dicts from each tool call.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": task},
    ]
    results = []

    while True:
        response = client.chat.completions.create(
            model=MODEL,
            tools=MIX_TOOLS,
            messages=messages,
        )

        msg = response.choices[0].message

        if msg.content and verbose:
            print(f"[MixAgent] {msg.content}")

        messages.append(msg)

        if not msg.tool_calls:
            break

        for call in msg.tool_calls:
            fn = TOOL_DISPATCH.get(call.function.name)
            args = json.loads(call.function.arguments)

            if fn is None:
                result = {"error": f"Unknown tool: {call.function.name}"}
            else:
                try:
                    result = fn(**args)
                except Exception as exc:
                    result = {"error": str(exc)}

            if verbose:
                print(f"[MixAgent] → {call.function.name}({args}) = {result}")

            results.append({"tool": call.function.name, "input": args, "result": result})
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return results
