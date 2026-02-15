import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

print("--- Relative Volume Fade ---")

# 1. Find Track
track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)
if not track:
    print("Error: Track 'Eddy' not found.")
    sys.exit(1)

# 2. Get Current Volume
# D_VOL is the fader value (linear gain, e.g. 1.0 = +0dB, 0.5 = -6dB approx)
current_vol = RPR.GetMediaTrackInfo_Value(track.id, "D_VOL")
print(f"Track: {track.name}, Current Volume (Validation Base): {current_vol}")

# Target: 100% -> 1% of current
start_val = current_vol
end_val = current_vol * 0.01

print(f"Fade Plan: {start_val} -> {end_val} over {project.length}s")

# 3. Get Envelope Pointer (Create if missing)
env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
if str(env_ptr).endswith("00000000"):
    RPR.Main_OnCommand(40297, 0) # Unselect all
    track.select()
    RPR.Main_OnCommand(40406, 0) # Toggle On
    env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")

# 4. Force Visibility via State Chunk
ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
str_chunk = ""
for item in ret_tuple:
    if isinstance(item, str) and "VIS" in item:
        str_chunk = item
        break

if str_chunk and "VIS 0" in str_chunk:
    new_chunk = str_chunk.replace("VIS 0", "VIS 1")
    RPR.SetEnvelopeStateChunk(env_ptr, new_chunk, False)

# 5. Insert Points
# Clear first
RPR.DeleteEnvelopePointRange(env_ptr, 0.0, project.length + 1000.0)

# Start
RPR.InsertEnvelopePoint(env_ptr, 0.0, start_val, 0, 0, False, True)
# End
RPR.InsertEnvelopePoint(env_ptr, project.length, end_val, 0, 0, False, True)

# 6. Refresh UI
RPR.Envelope_SortPoints(env_ptr)
RPR.TrackList_AdjustWindows(False) 
RPR.UpdateArrange()

print("--- Relative Fade Applied ---")
