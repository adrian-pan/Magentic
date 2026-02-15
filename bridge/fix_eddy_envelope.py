import reapy
import sys

# Connect to REAPER
project = reapy.Project()
RPR = reapy.reascript_api

print("--- Fixing Eddy Track Automation ---")

# Find 'Eddy' track
track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)

if not track:
    print("Error: Could not find track named 'Eddy'")
    sys.exit(1)

print(f"Found track: '{track.name}'")

# 1. Unselect all, allow our track to be the only selection
RPR.Main_OnCommand(40297, 0) # Unselect all
track.select()

# 2. Force Envelope Visible
# We use GetTrackEnvelopeByName to check, but let's just force the toggle logic if needed
env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

if str(env_ptr).endswith("00000000"):
    print("Envelope hidden. Toggling ON...")
    RPR.Main_OnCommand(40406, 0) # Toggle volume envelope visible
    env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

if str(env_ptr).endswith("00000000"):
    print("Error: Still could not create envelope.")
    sys.exit(1)

# 3. Insert Points (High to Low)
# Clear existing just in case
# RPR.DeleteEnvelopePointRange(env_ptr, 0, project.length + 10)

print("Inserting fade out (1.0 -> 0.1)...")
start_time = 0.0
end_time = project.length
if end_time < 2: end_time = 30.0

RPR.InsertEnvelopePoint(env_ptr, 0.0, 1.0, 0, 0, False, True)  # Start at Max
RPR.InsertEnvelopePoint(env_ptr, end_time, 0.1, 0, 0, False, True) # End at Low

# 4. CRITICAL REFRESH
RPR.Envelope_SortPoints(env_ptr)
RPR.TrackList_AdjustWindows(False) # <--- This fixes the "lane not showing" bug
RPR.UpdateArrange()

print("--- Done! Automation should be visible now. ---")
