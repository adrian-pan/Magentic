import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

print("--- Checking Hidden Envelope Pointer ---")

# Find 'Eddy' track
track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)
if not track:
    track = project.tracks[0]

print(f"Track: {track.name}")

# 1. Force Create/Show first
RPR.Main_OnCommand(40297, 0)
track.select()
RPR.Main_OnCommand(40406, 0) # Toggle On

env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
print(f"Pointer (Visible): {env_ptr}")

# 2. Hide it
RPR.Main_OnCommand(40406, 0) # Toggle Off

env_ptr_hidden = RPR.GetTrackEnvelopeByName(track.id, "Volume")
print(f"Pointer (Hidden): {env_ptr_hidden}")

if str(env_ptr_hidden) == str(env_ptr) and not str(env_ptr).endswith("00000000"):
    print("CONCLUSION: Pointer IS VALID when hidden! 'if env_ptr == 0' is FLAWED.")
else:
    print("CONCLUSION: Pointer became NULL when hidden.")
