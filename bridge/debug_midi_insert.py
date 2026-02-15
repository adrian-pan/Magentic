
import requests
import json

code = """
import reapy
project = reapy.Project()
track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
if track:
    item = track.items[0]
    take = item.active_take
    print(f"Testing on first item (pos={item.position})")
    
    # Try to insert a note at the end of the item
    start_time = item.position + item.length - 0.5
    end_time = item.position + item.length - 0.1
    
    start_ppq = reapy.reascript_api.MIDI_GetPPQPosFromProjTime(take.id, start_time)
    end_ppq = reapy.reascript_api.MIDI_GetPPQPosFromProjTime(take.id, end_time)
    
    print(f"Insert at {start_time} -> {start_ppq}")
    
    res = reapy.reascript_api.MIDI_InsertNote(
        take.id,
        False, False,
        start_ppq, end_ppq,
        0, 60, 100, True
    )
    print(f"Result: {res}")
    
    reapy.reascript_api.MIDI_Sort(take.id)
    
    # Check count
    cnt = reapy.reascript_api.MIDI_CountEvts(take.id, 0, 0, 0)
    print(f"New note count (raw): {cnt[2]}") # returns (retval, notecnt, ccevtcnt, textsyxevtcnt)
else:
    print("Track not found")
"""

try:
    response = requests.post("http://localhost:5001/execute", json={"code": code})
    print(response.json()["output"])
except Exception as e:
    print(f"Error: {e}")
