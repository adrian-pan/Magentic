
from fastapi import FastAPI
import reapy
import os

app = FastAPI()

@app.get("/")
def read_root():
    try:
        print("Connecting to REAPER...")
        # version = reapy.get_reaper_version()
        # print(f"REAPER version: {version}")
        print("Getting project...")
        project = reapy.Project()
        
        melody_track = next((t for t in project.tracks if "melody" in t.name.lower()), None)
        if melody_track and melody_track.n_items > 0:
            take = melody_track.items[0].active_take
            notes = take.notes
            # Try to get first 5 notes
            data = []
            for i, note in enumerate(notes):
                if i >= 5: break
                data.append({
                    "pitch": note.pitch,
                    "start": note.start,
                    "end": note.end,
                    "velocity": note.velocity
                })
            return {"notes": data}
        return {"error": "No melody track"}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
