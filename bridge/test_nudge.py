
import requests
import json

code = """
import reapy
project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track and track.n_items > 0:
    source_item = track.items[0]
    
    # Select only source item
    reapy.reascript_api.SelectAllMediaItems(0, False)
    source_item.selected = True
    
    print(f"Source Item: {source_item}")
    
    # Try "Item: Duplicate items" (41295)
    # This duplicates item and places it immediately after?
    # Or "Item: Paste items/tracks" (40058)
    
    # Let's try Duplicate
    reapy.reascript_api.Main_OnCommand(41295, 0)
    
    # Check count
    print(f"Items after: {track.n_items}")
    
    # If successful, the new item is selected?
    if track.n_items > 1:
        new_item = project.selected_items[0]
        print(f"New Item Pos: {new_item.position}")
        # Verify notes?
        print(f"New Item Notes: {len(new_item.active_take.notes)}")
else:
    print("Track not found or empty")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
