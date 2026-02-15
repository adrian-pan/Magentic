
import requests
import json

code = """
import reapy
project = reapy.Project()

# Find the melody track
melody_track = next((t for t in project.tracks if "melody" in t.name.lower()), None)

if melody_track and melody_track.n_items > 0:
    melody_item = melody_track.items[0]
    take = melody_item.active_take
    notes = take.notes

    melody_notes = [{"pitch": note.pitch, "start": note.start, "end": note.end, "velocity": note.velocity} for note in notes]
    print(f"Melody notes: {melody_notes}")
    
    import json
    with open("melody_notes.json", "w") as f:
        json.dump(melody_notes, f)

else:
    print("Melody track or item not found. Please ensure it's labeled correctly.")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
