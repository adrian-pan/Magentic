
import requests
import json

# Python code to be executed inside REAPER
reaper_code = """
import reapy
import random

def create_variations():
    try:
        project = reapy.Project()
        
        # Find melody track
        track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
        if not track:
            return "Error: Melody track not found"
            
        if track.n_items == 0:
            return "Error: No items on melody track"
            
        # Source item
        source_item = track.items[0]
        source_take = source_item.active_take
        
        # Read source notes
        source_notes = []
        for n in source_take.notes:
            source_notes.append({
                "pitch": n.pitch,
                "start": n.start,
                "end": n.end,
                "velocity": n.velocity,
                "channel": n.channel
            })
        
        if not source_notes:
            return "Error: No notes in source item"
        
        # Parameters
        item_length = source_item.length
        start_pos = source_item.position
        clones_count = 8
        cursor = start_pos + item_length
        created_count = 0
        
        # Get source note PPQs for reference
        # Source note 0 PPQ was 0 (verified in debug).
        # We'll calculate relative PPQ from QN durations.
        
        for i in range(clones_count):
            # Step 1: Create new MIDI item using RPR
            new_item_ptr = reapy.reascript_api.CreateNewMIDIItemInProj(
                track.id, cursor, cursor + item_length, False
            )
            if not new_item_ptr:
                return f"Error: Failed to create MIDI item at {cursor}"
            
            # Step 2: Find this item as a reapy object by scanning track items.
            # The new item should be at position == cursor.
            new_item = None
            for item in track.items:
                if abs(item.position - cursor) < 0.01:
                    new_item = item
                    break
            
            if not new_item:
                return f"Error: Could not find new item at cursor {cursor}"
            
            # Step 3: Get the reapy Take object (this gives a proper .id pointer)
            new_take = new_item.active_take
            take_id = new_take.id  # This is the proper pointer that works with RPR calls
            
            # Determine Variation
            variation_type = i % 4
            # 0: exact copy, 1: velocity humanize, 2: octave shift, 3: both
            
            # Step 4: Insert notes using relative PPQ
            for j, note in enumerate(source_notes):
                pitch = note["pitch"]
                start_sec = note["start"]
                end_sec = note["end"]
                velocity = note["velocity"]
                channel = note["channel"]
                
                # Calculate PPQ from QN
                # Project QN at note start/end
                start_qn = reapy.reascript_api.TimeMap2_timeToQN(0, cursor + start_sec)
                end_qn = reapy.reascript_api.TimeMap2_timeToQN(0, cursor + end_sec)
                item_start_qn = reapy.reascript_api.TimeMap2_timeToQN(0, cursor)
                
                # Relative QN -> PPQ (960 ticks per quarter note, standard)
                rel_start_qn = start_qn - item_start_qn
                rel_end_qn = end_qn - item_start_qn
                start_ppq = rel_start_qn * 960.0
                end_ppq = rel_end_qn * 960.0
                
                # Apply Variation
                if variation_type == 1 or variation_type == 3:
                    delta = random.randint(-15, 15)
                    velocity = max(1, min(127, velocity + delta))
                    
                if variation_type == 2 or variation_type == 3:
                    if pitch + 12 <= 100:
                        pitch += 12
                    elif pitch - 12 >= 20:
                        pitch -= 12

                # Insert note
                res = reapy.reascript_api.MIDI_InsertNote(
                    take_id,
                    False, False,
                    start_ppq, end_ppq,
                    channel,
                    int(pitch),
                    int(velocity),
                    True  # noSort
                )
                
                # Debug: print first note of first variation
                if i == 0 and j == 0:
                    print(f"DEBUG: take_id={take_id}")
                    print(f"DEBUG: PPQ {start_ppq:.1f} -> {end_ppq:.1f}, pitch={pitch}")
                    print(f"DEBUG: InsertNote result={res}")
            
            reapy.reascript_api.MIDI_Sort(take_id)
            cursor += item_length
            created_count += 1
            
        return f"Success: Created {created_count} variations up to {cursor:.2f}s."
    except Exception as e:
        import traceback
        return f"Error: {str(e)}\\n{traceback.format_exc()}"

print(create_variations())
"""

try:
    print("Sending variation request to bridge...")
    response = requests.post("http://localhost:5001/execute", json={"code": reaper_code})
    result = response.json()
    print("Response:", json.dumps(result, indent=2))
except Exception as e:
    print(f"Request Error: {e}")
