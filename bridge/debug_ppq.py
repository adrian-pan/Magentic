
import requests
import json

code = """
import reapy
import math

project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track:
    # Source item
    source_item = track.items[0]
    source_take = source_item.active_take
    
    # Get first note info
    res = reapy.reascript_api.MIDI_GetNote(source_take.id, 0, 0, 0, 0, 0, 0, 0, 0)
    # returns (retval, selected, muted, startppqpos, endppqpos, chan, pitch, vel)
    if res[0]:
        print(f"Source Item Pos: {source_item.position}")
        print(f"Source Note 0 PPQ: {res[3]}")
        
        # Calculate what GetPPQPosFromProjTime gives for this time
        calc_ppq = reapy.reascript_api.MIDI_GetPPQPosFromProjTime(source_take.id, source_item.position)
        print(f"Source Start PPQ from Time: {calc_ppq}")
    
    # Check 2nd item (created variation) if exists
    if track.n_items > 1:
        item2 = track.items[1]
        take2 = item2.active_take
        print(f"Item 2 Pos: {item2.position}")
        
        # What does GetPPQPos give for Item 2 start?
        calc_ppq2 = reapy.reascript_api.MIDI_GetPPQPosFromProjTime(take2.id, item2.position)
        print(f"Item 2 Start PPQ from Time: {calc_ppq2}")
        
        # What does it give for Item 2 + 1s?
        calc_ppq2_1s = reapy.reascript_api.MIDI_GetPPQPosFromProjTime(take2.id, item2.position + 1.0)
        print(f"Item 2 + 1s PPQ: {calc_ppq2_1s}")
    else:
        print("No second item found")

else:
    print("Track not found")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
