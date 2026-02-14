"""
agents — Multi-agent REAPER control system.

Entry point:
    from agents.orchestrator import handle
    result = handle("Create a lo-fi beat in C minor")

Individual agents can also be called directly:
    from agents import midi_agent, sound_agent, mix_agent
    midi_agent.run("Add a 4-bar chord progression on track 0")
"""

from . import midi_agent, sound_agent, mix_agent
from .orchestrator import handle

__all__ = ["midi_agent", "sound_agent", "mix_agent", "handle"]
