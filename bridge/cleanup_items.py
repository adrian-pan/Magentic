
import requests
import json

code = """
import reapy
project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track:
    # Delete all items except the first one (assuming first is source)
    # Iterate backwards to avoid index shifting issues
    n = track.n_items
    deleted = 0
    for i in range(n - 1, 0, -1):
        item = track.items[i]
        # Safety check: only delete if it's after the first item
        if item.position > track.items[0].position:
            item.delete()
            deleted += 1
    print(f"Deleted {deleted} items.")
else:
    print("Track not found")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
