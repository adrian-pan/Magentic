
import reapy
import io
import contextlib
import sys

# Standard connect
try:
    print("Normal connection...")
    p = reapy.Project()
    print(f"Normal tracks: {p.n_tracks}")
except Exception as e:
    print(f"Normal fail: {e}")

# Redirected
try:
    print("Redirected connection...")
    capture = io.StringIO()
    with contextlib.redirect_stdout(capture):
        print("Inside capture")
        p2 = reapy.Project()
        # triggering something complex
        if p2.n_tracks > 0:
            notes = p2.tracks[0].items[0].active_take.notes
            for n in notes:
                _ = n.start
    
    print("Redirected success!")
    print(f"Captured: {capture.getvalue()[:50]}...")
except Exception as e:
    print(f"Redirected fail: {e}")
    import traceback
    traceback.print_exc()
