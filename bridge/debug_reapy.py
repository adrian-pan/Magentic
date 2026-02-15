
import reapy
import sys

try:
    project = reapy.Project()
    # print(f"Project: {project}")
    
    # Find any track with MIDI
    # For now look for "melody"
    track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
    if not track:
        print("No melody track found. Using first track.")
        track = project.tracks[0]
        
    if track.n_items > 0:
        item = track.items[0]
        take = item.active_take
        print(f"Take: {take}")
        # print(f"Dir: {dir(take)}")
        
        # Check for common midi attributes
        has_midi = take.is_midi
        print(f"Is MIDI: {has_midi}")
        
        if has_midi:
            print("Trying to access MIDI notes...")
            notes = take.notes
            print(f"Notes object: {notes}")
            print(f"Count: {len(notes)}")
            
            print("Iterating notes...")
            for i, note in enumerate(notes):
                print(f"Note {i}: Pitch={note.pitch}, Start={note.start}, End={note.end}, Vel={note.velocity}")
                if i >= 5: break # only first 5

            
    else:
        print("Track has no items.")

except Exception as e:
    print(f"Error: {e}")
