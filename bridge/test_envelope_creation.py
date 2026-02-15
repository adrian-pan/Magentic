import reapy
import sys

project = reapy.Project()
RPR = reapy.reascript_api

if len(project.tracks) > 0:
    track = project.tracks[0]
    print(f"Track: {track.name}")

    # Method 1: GetTrackEnvelopeByName
    # This usually works even if the envelope is hidden/inactive
    env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
    print(f"GetTrackEnvelopeByName('Volume') pointer: {env_ptr}")

    # Method 2: SetEnvelopeStateChunk to force create/show it
    # If pointer is 0, we might need to toggle it visible
    # 40406 = Toggle track volume envelope visible
    if env_ptr == 0:
        print("Envelope pointer is 0. Attempting to toggle visibility...")
        # Select the track strictly
        for t in project.tracks: t.select(False)
        track.select(True)
        
        # Command ID 40406: Track: Toggle track volume envelope visible
        RPR.Main_OnCommand(40406, 0)
        
        # Try getting it again
        env_ptr = RPR.GetTrackEnvelopeByName(track.id, "Volume")
        print(f"After toggle, pointer: {env_ptr}")

    if env_ptr != 0:
        print("SUCCESS: Found envelope pointer.")
        # Now try to wrap it in reapy's Envelope class if we wanted to (but we can just use RPR)
        # Reapy's Envelope object might just need the pointer?
        # envelope = reapy.Envelope(date_pointer=env_ptr) # construct manually if needed
        # But reapy usually expects to find it in the list.
        
        # Let's see if track.envelopes["Volume"] works NOW
        try:
            e = track.envelopes["Volume"]
            print(f"track.envelopes['Volume'] now accessible: {e}")
        except Exception as err:
            print(f"track.envelopes['Volume'] still failed: {err}")
            
else:
    print("No tracks.")
