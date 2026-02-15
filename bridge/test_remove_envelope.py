import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

print("--- Testing Envelope Removal ---")

# Find 'Eddy' track
track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)
if not track:
    track = project.tracks[0] # Fallback
    print(f"Eddy not found, using first track: {track.name}")

print(f"Targeting track: {track.name}")

# 1. Get Envelope Pointer
env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
print(f"Envelope Pointer: {env_ptr}")

if str(env_ptr).endswith("00000000"):
    print("Envelope already invalid/hidden.")
else:
    # 2. Clear all points
    # DeleteEnvelopePointRange(envelope, start_time, end_time)
    print("Clearing points...")
    RPR.DeleteEnvelopePointRange(env_ptr, 0.0, project.length + 1000.0)
    
    # 3. Check Visibility and Hide
    # We can inspect the state chunk or just toggle if we confirm it's visible?
    # Simpler: Use the specific Action "Track: Toggle track volume envelope visible" (40406)
    # But we need to know if it IS visible first.
    
    ret_tuple = RPR.GetEnvelopeStateChunk(env_ptr, "", 1000000, False)
    print(f"GetEnvelopeStateChunk returned {len(ret_tuple)} items: {ret_tuple}")
    # Usually the string is the 2nd item (index 1) or follows retval
    str_chunk = str(ret_tuple) # Fallback if we can't find it
    for item in ret_tuple:
        if isinstance(item, str) and "VIS" in item:
            str_chunk = item
            break
            
    is_visible = "VIS 1" in str_chunk
    print(f"Envelope Visible State: {is_visible}")
    
    if is_visible:
        print("Hiding envelope...")
        # Select track
        RPR.Main_OnCommand(40297, 0) # Unselect all
        track.select()
        # Toggle Volume Visibility
        RPR.Main_OnCommand(40406, 0) 
        
    # 4. Refresh UI
    print("Refreshing UI...")
    RPR.Envelope_SortPoints(env_ptr)
    RPR.TrackList_AdjustWindows(False)
    RPR.UpdateArrange()

print("--- Removal Complete ---")
