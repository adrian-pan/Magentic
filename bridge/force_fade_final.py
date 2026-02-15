import reapy
import sys

# Connect to REAPER
project = reapy.Project()
RPR = reapy.reascript_api

print("--- Force Fade Final ---")

# 1. Find Track
track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)
if not track:
    print("Error: Track 'Eddy' not found.")
    sys.exit(1)
print(f"Target Track: {track.name}")

# 2. Get Envelope Pointer (Create if missing)
env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
if str(env_ptr).endswith("00000000"):
    print("Envelope pointer 0. Creating via toggle...")
    # Select only this track
    RPR.Main_OnCommand(40297, 0) # Unselect all
    track.select()
    RPR.Main_OnCommand(40406, 0) # Toggle On
    env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

if str(env_ptr).endswith("00000000"):
    print("Error: Failed to create envelope.")
    sys.exit(1)

# 3. Force Visibility via State Chunk (The "Sledgehammer")
# Get current state
ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
str_chunk = ""
for item in ret_tuple:
    if isinstance(item, str) and "VIS" in item:
        str_chunk = item
        break

if str_chunk:
    # Replace VIS 0 with VIS 1
    # Also ensure the lane has height? Default is usually fine.
    # We use a simple string replace for "VIS 0" -> "VIS 1"
    if "VIS 0" in str_chunk:
        print("State says HIDDEN. Forcing VISIBLE...")
        new_chunk = str_chunk.replace("VIS 0", "VIS 1")
        RPR.SetEnvelopeStateChunk(env_ptr, new_chunk, False)
    else:
        print("State says VISIBLE (or not found).")
else:
    print("Error: Could not retrieve state chunk.")

# 4. Insert Points
# Clear first to be clean
RPR.DeleteEnvelopePointRange(env_ptr, 0.0, project.length + 1000.0)

print("Inserting Points: 1.0 -> 0.1")
# Point 1: 0.0s -> 1.0
RPR.InsertEnvelopePoint(env_ptr, 0.0, 1.0, 0, 0, False, True)
# Point 2: End -> 0.1
RPR.InsertEnvelopePoint(env_ptr, project.length, 0.1, 0, 0, False, True)

# 5. Refresh UI (Critical Step)
RPR.Envelope_SortPoints(env_ptr)
RPR.TrackList_AdjustWindows(False) 
RPR.UpdateArrange()

print("--- Success! Check REAPER. ---")
