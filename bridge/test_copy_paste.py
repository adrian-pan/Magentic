
import requests
import json

code = """
import reapy
import time

project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track and track.n_items > 0:
    source_item = track.items[0]
    n_before = track.n_items
    print(f"Items before: {n_before}")
    
    # 1. Select Track
    reapy.reascript_api.SetOnlyTrackSelected(track.id)
    
    # 2. Select Source Item
    reapy.reascript_api.SelectAllMediaItems(0, False) # Deselect all
    reapy.reascript_api.SetMediaItemSelected(source_item.id, True)
    
    # 3. Copy
    reapy.reascript_api.Main_OnCommand(40057, 0) # Edit: Copy items
    
    # 4. Move Cursor (to end of item + 1s)
    cursor = source_item.position + source_item.length + 1.0
    reapy.reascript_api.SetEditCurPos(cursor, False, False)
    
    # 5. Paste
    reapy.reascript_api.Main_OnCommand(40058, 0) # Item: Paste items/tracks
    
    # Check count
    n_after = track.n_items
    print(f"Items after: {n_after}")
    
    if n_after > n_before:
        # Get new item (should be selected)
        # reapy.selected_items might be cached?
        # Use RPR
        new_item_ptr = reapy.reascript_api.GetSelectedMediaItem(0, 0)
        if new_item_ptr:
            print("Paste successful, found selected item.")
            
            # Check if it has notes (should be copy of source)
            take_ptr = reapy.reascript_api.GetActiveTake(new_item_ptr)
            if take_ptr:
                # Count notes
                res = reapy.reascript_api.MIDI_CountEvts(take_ptr, 0, 0, 0)
                print(f"New item note count: {res[2]}")
                
            else:
                print("No active take on new item")
        else:
            print("Paste worked but no item selected?")
    else:
        print("Paste failed")

else:
    print("Track not found or empty")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
