"""
agents/orchestrator.py — Top-level orchestrator agent.

Receives a natural-language music production request, breaks it into
sub-tasks, and delegates each to the correct specialist agent
(MIDIAgent, SoundAgent, MixAgent).

Integration point for the chatbot backend:
    from agents.orchestrator import handle
    result = handle("Create an 8-bar lo-fi beat in C minor")
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from . import midi_agent, sound_agent, mix_agent

load_dotenv()

MODEL = "gpt-4o"

SYSTEM_PROMPT = """\
You are the orchestrator for a multi-agent AI music production system
connected to REAPER DAW.

Your job:
1. Understand what the user wants to create or do.
2. Break the request into an ordered list of sub-tasks.
3. Assign each sub-task to the correct specialist agent:
   - MIDIAgent  — notes, chords, melodies, drum patterns, tempo, MIDI items
   - SoundAgent — VST plugins, FX chains, sound design, synthesis presets
   - MixAgent   — track levels, panning, color coding, mute/solo, balance

Output ONLY a JSON array of sub-tasks — no prose, no markdown, just JSON.
Format:
[
  {"agent": "MIDIAgent",  "task": "...plain English task for that agent..."},
  {"agent": "SoundAgent", "task": "..."},
  {"agent": "MixAgent",   "task": "..."}
]

Rules:
- Keep tasks self-contained and specific — each agent doesn't see the others.
- Always include at minimum a MIDIAgent task if creating music.
- Include MixAgent at the end to balance everything after it's built.
- Order matters: MIDI first, then Sound (needs tracks to exist), then Mix.
- For requests about only one domain (e.g. "fix the reverb on track 2"),
  return a single-item array for the relevant agent.
"""


def _plan(prompt: str) -> list[dict]:
    """
    Ask the orchestrator LLM to produce a plan (list of agent sub-tasks).
    Returns a list of {"agent": str, "task": str} dicts.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw)


def handle(prompt: str, verbose: bool = True) -> dict:
    """
    Main entry point. Accepts a natural-language prompt from the chatbot,
    orchestrates agents, and returns a summary of all tool calls made.

    Parameters
    ----------
    prompt : str
        e.g. "Create an 8-bar lo-fi hip hop beat in C minor with piano chords,
               bass line, and drums"
    verbose : bool
        Stream agent activity to stdout.

    Returns
    -------
    dict with keys:
        plan    — list of sub-tasks as planned
        results — dict mapping agent name → list of tool call results
        errors  — list of any agent-level errors
    """
    if verbose:
        print(f"\n[Orchestrator] Planning: {prompt!r}\n")

    plan = _plan(prompt)

    if verbose:
        print(f"[Orchestrator] Plan ({len(plan)} steps):")
        for i, step in enumerate(plan, 1):
            print(f"  {i}. [{step['agent']}] {step['task']}")
        print()

    results = {}
    errors = []

    agent_map = {
        "MIDIAgent":  midi_agent.run,
        "SoundAgent": sound_agent.run,
        "MixAgent":   mix_agent.run,
    }

    for step in plan:
        agent_name = step["agent"]
        task = step["task"]

        if agent_name not in agent_map:
            errors.append(f"Unknown agent: {agent_name}")
            continue

        if verbose:
            print(f"\n[Orchestrator] → Dispatching to {agent_name}: {task!r}")

        try:
            step_results = agent_map[agent_name](task, verbose=verbose)
            results.setdefault(agent_name, []).extend(step_results)
        except Exception as exc:
            errors.append(f"{agent_name} error: {exc}")
            if verbose:
                print(f"[Orchestrator] ERROR in {agent_name}: {exc}")

    if verbose:
        print(f"\n[Orchestrator] Done. {sum(len(v) for v in results.values())} total tool calls.")

    return {"plan": plan, "results": results, "errors": errors}
