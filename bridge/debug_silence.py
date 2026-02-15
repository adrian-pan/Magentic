import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

print("--- Debugging Silence on Eddy ---")

track = next((t for t in project.tracks if "eddy" in t.name.lower()), None)
if not track:
    print("Error: Track 'Eddy' not found.")
    sys.exit(1)

print(f"Track: '{track.name}'")
print(f"Mute State: {track.is_muted}")
print(f"Solo State: {track.is_solo}")
# Get raw volume (D_VOL)
current_vol = RPR.GetMediaTrackInfo_Value(track.id, "D_VOL")
print(f"Current Volume (D_VOL): {current_vol}")

# Check Automation Mode
# 0=Trim/Read, 1=Read, 2=Touch, 3=Write, 4=Latch, 5=Latch Preview
auto_mode = RPR.GetMediaTrackInfo_Value(track.id, "I_AUTOMODE")
print(f"Automation Mode: {auto_mode}")

env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
print(f"Envelope Pointer: {env_ptr}")

if not str(env_ptr).endswith("00000000"):
    # Count points
    num_points = RPR.CountEnvelopePoints(env_ptr)
    print(f"Number of Points: {num_points}")
    
    for i in range(num_points):
        print(f"  Point {i} Raw: {ret_tuple}")
        
else:
    print("No volume envelope found.")

print("--- End Debug ---")
