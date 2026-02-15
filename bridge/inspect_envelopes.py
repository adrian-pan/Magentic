import reapy
project = reapy.Project()

if len(project.tracks) > 0:
    track = project.tracks[0]
    print(f"Inspecting envelopes for track: {track.name}")
    
    # List all envelopes
    for i, env in enumerate(track.envelopes):
        print(f"Envelope {i}: {env.name}")
        
    # Try to add volume envelope if it doesn't exist
    # Note: In some reapy versions/setup, you cannot just 'get' it if it's not armed/visible
    
    print("\nAttempting to find 'Volume'...")
    try:
        vol = track.envelopes["Volume"]
        print("Found 'Volume' envelope!")
    except KeyError:
        print("'Volume' envelope not found in dict.")
        
    print("\nChecking chunks...")
    # Sometimes we need to toggle visibility via RPR to make it exist
else:
    print("No tracks in project.")
