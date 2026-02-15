import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

print("--- Testing Force Show via State Chunk ---")

track = next((t for t in project.tracks if "eddy" in t.name.lower()), project.tracks[0])
print(f"Track: {track.name}")

# 1. Ensure hidden first
RPR.Main_OnCommand(40297, 0)
track.select()
# Use a loop to toggle until hidden? No, let's just use state chunk
env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

if str(env_ptr).endswith("00000000"):
    # Create it first
    RPR.Main_OnCommand(40406, 0) 
    env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

# Verify hidden/visible
ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
str_chunk = ""
for item in ret_tuple:
    if isinstance(item, str) and "VIS" in item:
        str_chunk = item
        break

print(f"Initial Chunk Snippet: {str_chunk[:50]}...")

# Force HIDDEN (VIS 0)
if "VIS 1" in str_chunk:
    print("Forcing Hidden (VIS 0)...")
    new_chunk = str_chunk.replace("VIS 1", "VIS 0")
    RPR.SetEnvelopeStateChunk(env_ptr, new_chunk, False)
    RPR.TrackList_AdjustWindows(False)
    RPR.UpdateArrange()
    
# Check
ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
# extract again
str_chunk = ""
for item in ret_tuple:
    if isinstance(item, str) and "VIS" in item:
        str_chunk = item
        break
print(f"Post-Hide Chunk: { 'VIS 1' in str_chunk }")

# Force SHOW (VIS 1)
print("Forcing SHOW (VIS 1)...")
if "VIS 0" in str_chunk:
    new_chunk = str_chunk.replace("VIS 0", "VIS 1")
    RPR.SetEnvelopeStateChunk(env_ptr, new_chunk, False)
    RPR.TrackList_AdjustWindows(False)
    # Also need to ensure the lane height is non-zero? 
    # Usually VIS 1 handles it.

RPR.TrackList_AdjustWindows(False)
RPR.UpdateArrange()

# Verify
ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
# extract again
str_chunk = ""
for item in ret_tuple:
    if isinstance(item, str) and "VIS" in item:
        str_chunk = item
        break
print(f"Final Chunk Visible?: { 'VIS 1' in str_chunk }")
