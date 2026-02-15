import reapy
import sys

# Connect to REAPER
project = reapy.Project()
RPR = reapy.reascript_api

print("--- Starting Volume Automation Test ---")

if len(project.tracks) == 0:
    print("Error: No tracks found in project.")
    sys.exit(1)

# Target the first track
track = project.tracks[0]
print(f"Targeting Track 1: '{track.name}'")

# 1. Clear current selection to ensure command applies only to this track
RPR.Main_OnCommand(40297, 0) # Track: Unselect all tracks

# 2. Select our target track
# reapy's track.select() is good, but let's use RPR to be absolutely sure
track_pointer = RPR.GetTrack(0, 0) # Get pointer to first track (index 0)
RPR.SetMediaTrackInfo_Value(track_pointer, "I_SELECTED", 1)

# 3. Get Envelope Pointer
# If envelope doesn't exist, this returns 0
env_ptr = RPR.GetTrackEnvelopeByName(track_pointer, "Volume")
print(f"Initial Envelope Pointer: {env_ptr}")

if env_ptr == 0:
    print("Envelope hidden/missing. Toggling visibility...")
    # Command 40406: Track: Toggle track volume envelope visible
    RPR.Main_OnCommand(40406, 0)
    
    # Get pointer again
    env_ptr = RPR.GetTrackEnvelopeByName(track_pointer, "Volume")
    print(f"New Envelope Pointer: {env_ptr}")

# IMPORTANT: Check if pointer is valid (not 0 or None)
if str(env_ptr).endswith("00000000"): # Check for null pointer string representation
     print("Error: Envelope pointer is null. Attempting fallback creation...")
     # Fallback: Select track and use SWS or native action to show volume
     # 40406 = Track: Toggle track volume envelope visible
     RPR.Main_OnCommand(40406, 0)
     env_ptr = RPR.GetTrackEnvelopeByName(track_pointer, "Volume")
     print(f"Fallback Pointer: {env_ptr}")

if str(env_ptr).endswith("00000000"):
    print("CRITICAL ERROR: Could not get valid envelope pointer.")
    sys.exit(1)

# 5. Insert Points (High to Low)
# 1.0 = +0dB, 0.0 = -inf
print(f"Inserting points into envelope {env_ptr}...")
start_time = 0.0
end_time = 10.0 

if project.length > 1.0:
    end_time = project.length

# Point A: Start at Max
# InsertEnvelopePoint(envelope, time, value, shape, tension, selected, noSortIn)
RPR.InsertEnvelopePoint(env_ptr, start_time, 1.0, 0, 0, False, True) 

# Point B: End at Min
RPR.InsertEnvelopePoint(env_ptr, end_time, 0.0, 0, 0, False, True)

# 6. Sort and Redraw
RPR.Envelope_SortPoints(env_ptr)
RPR.TrackList_AdjustWindows(False)
RPR.UpdateArrange()

print("--- Done! Check REAPER API ---")
