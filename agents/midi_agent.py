"""
agents/midi_agent.py — MIDI composition specialist agent.

Knows music theory, MIDI note values, rhythm, and how to build
chord progressions / melodies / drum patterns via REAPER MIDI items.

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
You are a MIDI composition specialist integrated with REAPER DAW.

You understand:
- Music theory: scales, modes, chord progressions, voice leading
- MIDI note numbers: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
  (each octave = +12; e.g. C3=48, C5=72)
- Rhythm: beats, subdivisions (quarter=1 beat, eighth=0.5, sixteenth=0.25)
- Common drum MIDI mappings (GM): Kick=36, Snare=38, Hi-hat closed=42,
  Hi-hat open=46, Crash=49, Ride=51, Tom hi=48, Tom mid=45, Tom low=41

Rules:
- Always call analyze_project first to understand the current state.
- Create tracks before adding MIDI items to them.
- MIDI item positions and lengths are in BEATS, not seconds.
- Notes' start times are relative to the MIDI item's start, in beats.
- Use velocities: drums 80–110, melodic 60–100, accents up to 120.
- When creating a drum pattern, use one MIDI item that covers the full
  loop length and pack all drum hits into it.
- Clap/snare (pitch 38): place on beats 2 and 4 of each bar (every other beat,
  the backbeat). Do NOT put clap on every kick beat — only on 2 and 4.
- Think step-by-step before calling tools. Be precise with note numbers
  and timing math.
"""

# Only expose MIDI-relevant tools to this agent
_MIDI_TOOL_NAMES = {
    "create_track", "set_tempo", "create_midi_item",
    "add_midi_notes", "read_midi_notes", "extend_harmony",
    "delete_midi_notes", "replace_harmony",
    "analyze_project",
}

# Convert to OpenAI function-calling format
def _to_openai_tools(names: set) -> list:
    return [
        {"type": "function", "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        }}
        for t in TOOL_SCHEMAS if t["name"] in names
    ]

MIDI_TOOLS = _to_openai_tools(_MIDI_TOOL_NAMES)


def run(task: str, verbose: bool = True) -> list[dict]:
    """
    Execute a MIDI composition task.

    Parameters
    ----------
    task : str
        Natural-language instruction, e.g.
        "Create a 4-bar lo-fi chord progression in C minor on track 0"
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
            tools=MIDI_TOOLS,
            messages=messages,
        )

        msg = response.choices[0].message

        if msg.content and verbose:
            print(f"[MIDIAgent] {msg.content}")

        # Append assistant message to history
        messages.append(msg)

        if not msg.tool_calls:
            break

        # Execute each tool call
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
                print(f"[MIDIAgent] → {call.function.name}({args}) = {result}")

            results.append({"tool": call.function.name, "input": args, "result": result})
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return results
