"""
agents/sound_agent.py — Sound design & FX specialist agent.

Knows synthesis, FX chains, VST parameter mapping, and how to shape
tone via REAPER's FX system.

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
You are a sound design and FX specialist integrated with REAPER DAW.

You understand:
- Synthesis: subtractive, wavetable, FM, additive
- FX chains: EQ, compression, reverb, delay, saturation, chorus, flanger
- Common REAPER built-in plugins: ReaEQ, ReaComp, ReaDelay, ReaVerb, ReaXcomp
- VST parameter ranges are normalized 0.0–1.0 when set via set_fx_param
- Common sound design goals and their FX mappings:
    lo-fi / vinyl: low-pass filter, gentle saturation, slight pitch wobble
    cinematic pad:  large reverb, long attack, stereo widening
    punchy kick:    transient shaper, multiband comp, high-pass above 30 Hz
    warm bass:      slight overdrive, low-shelf boost ~100 Hz, high cut ~4 kHz

Rules:
- Always call analyze_project first to read the existing track/FX state.
- Add FX using the exact plugin name as it appears in REAPER's FX browser.
  For VST3 instruments the format is: "VST3i: Plugin Name (Manufacturer)"
- Use set_fx_param with descriptive parameter names; it will fuzzy-match
  against the plugin's param list.
- If unsure of a parameter name, set the most impactful ones
  (e.g. mix/wet, cutoff, attack, release, gain).
- Think step-by-step. Describe your signal chain reasoning before calling tools.
"""

_SOUND_TOOL_NAMES = {"add_fx", "set_fx_param", "toggle_fx", "analyze_project"}

def _to_openai_tools(names: set) -> list:
    schemas = [t for t in TOOL_SCHEMAS if t["name"] in names]
    # Add toggle_fx inline if missing from TOOL_SCHEMAS
    if not any(t["name"] == "toggle_fx" for t in schemas):
        schemas.append({
            "name": "toggle_fx",
            "description": "Enable or bypass an FX plugin on a track.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "track_index": {"type": "integer"},
                    "fx_index": {"type": "integer"},
                    "enabled": {"type": "boolean", "default": True},
                },
                "required": ["track_index", "fx_index"],
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

SOUND_TOOLS = _to_openai_tools(_SOUND_TOOL_NAMES)


def run(task: str, verbose: bool = True) -> list[dict]:
    """
    Execute a sound design task.

    Parameters
    ----------
    task : str
        Natural-language instruction, e.g.
        "Add Serum 2 to track 0 and configure a warm supersaw patch"
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
            tools=SOUND_TOOLS,
            messages=messages,
        )

        msg = response.choices[0].message

        if msg.content and verbose:
            print(f"[SoundAgent] {msg.content}")

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
                print(f"[SoundAgent] → {call.function.name}({args}) = {result}")

            results.append({"tool": call.function.name, "input": args, "result": result})
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return results
