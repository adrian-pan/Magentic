
import requests
import json

code = """
import reapy
project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track:
    print(f"Track: {track.name}")
    print(f"Items: {track.n_items}")
    for i, item in enumerate(track.items):
        take = item.active_take
        notes = take.notes
        print(f"Item {i}: Pos={item.position:.2f}, Len={item.length:.2f}, Notes={len(notes)}")
else:
    print("Track not found")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
