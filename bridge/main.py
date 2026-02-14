"""
Magentic Bridge — Python/reapy bridge for direct REAPER control.
Runs as a FastAPI server on port 5000.
"""

import io
import os
import sys
import json
import traceback
import threading
from contextlib import redirect_stdout, redirect_stderr

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Magentic Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    code: str


class ExecuteResponse(BaseModel):
    success: bool
    output: str = ""
    error: str = ""


class StatusResponse(BaseModel):
    reaper_connected: bool
    reaper_version: str = ""
    error: str = ""


def _call_with_timeout(fn, timeout=5):
    """Call fn() in a background thread with a timeout. Returns (result, error)."""
    result = [None]
    error = [None]

    def target():
        try:
            result[0] = fn()
        except Exception as e:
            error[0] = str(e)

    t = threading.Thread(target=target, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        return None, "Timeout: REAPER did not respond"
    return result[0], error[0]


@app.get("/status", response_model=StatusResponse)
def get_status():
    """Check if REAPER is reachable via reapy."""
    try:
        import reapy
        RPR = reapy.reascript_api

        version, err = _call_with_timeout(lambda: RPR.GetAppVersion(), timeout=5)
        if err:
            return StatusResponse(reaper_connected=False, error=err)
        if version:
            return StatusResponse(reaper_connected=True, reaper_version=version)
        return StatusResponse(reaper_connected=False, error="Empty response from REAPER")
    except Exception as e:
        return StatusResponse(reaper_connected=False, error=str(e))


@app.post("/execute", response_model=ExecuteResponse)
def execute_code(request: ExecuteRequest):
    """Execute Python/reapy code in REAPER's context."""
    try:
        import reapy
    except Exception as e:
        return ExecuteResponse(
            success=False,
            error=f"Cannot connect to REAPER: {str(e)}. Make sure REAPER is open and reapy is configured.",
        )

    # Capture stdout
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    # Build execution namespace with reapy pre-imported
    namespace = {
        "reapy": reapy,
        "__builtins__": __builtins__,
    }

    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(request.code, namespace)

        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()

        if errors:
            return ExecuteResponse(success=True, output=output, error=errors)

        return ExecuteResponse(
            success=True,
            output=output or "Code executed successfully.",
        )
    except Exception as e:
        tb = traceback.format_exc()
        return ExecuteResponse(success=False, error=f"{str(e)}\n\n{tb}")


_ANALYZE_SCRIPT = """
import reapy, json
try:
    project = reapy.Project()
    RPR = reapy.reascript_api
    tracks_data = []
    
    # Iterate using reapy's object API which handles type conversion
    for i, track in enumerate(project.tracks):
        fx_list = []
        # Accessing track.fxs is a generator or list proxy
        try:
            n_fx = RPR.TrackFX_GetCount(track)
            for j in range(n_fx):
                name = RPR.TrackFX_GetFXName(track, j, "", 256)[3]
                is_enabled = bool(RPR.TrackFX_GetEnabled(track, j))
                n_params = RPR.TrackFX_GetNumParams(track, j)
                fx_list.append({
                    "index": j,
                    "name": name,
                    "is_enabled": is_enabled,
                    "n_params": n_params
                })
        except:
            pass
            
        # Use RPR for reliable property access
        name = RPR.GetSetMediaTrackInfo_String(track, "P_NAME", "", False)[3] or f"Track {i+1}"
        vol = RPR.GetMediaTrackInfo_Value(track, "D_VOL")
        pan = RPR.GetMediaTrackInfo_Value(track, "D_PAN")
        muted = bool(RPR.GetMediaTrackInfo_Value(track, "B_MUTE"))
        solo = bool(RPR.GetMediaTrackInfo_Value(track, "I_SOLO"))
        armed = bool(RPR.GetMediaTrackInfo_Value(track, "I_RECARM"))
        n_items = RPR.CountTrackMediaItems(track)

        tracks_data.append({
            "index": i,
            "name": name,
            "volume": round(vol, 3),
            "pan": round(pan, 3),
            "is_muted": muted,
            "is_solo": solo,
            "is_armed": armed,
            "n_items": n_items,
            "fx": fx_list
        })

    result = {
        "success": True,
        "project": {
            "bpm": RPR.Master_GetTempo(),
            "n_tracks": project.n_tracks,
            "cursor_position": round(project.cursor_position, 3),
            "is_playing": project.is_playing
        },
        "tracks": tracks_data
    }
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"success": False, "error": str(e) + "\\n" + traceback.format_exc()}))
"""

@app.get("/analyze")
def analyze_project():
    """Analyze the current REAPER project and return its full state."""
    try:
        import reapy
    except Exception as e:
        return {"success": False, "error": f"Cannot connect to REAPER: {str(e)}"}

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    ns = {"reapy": reapy, "__builtins__": __builtins__}
    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(_ANALYZE_SCRIPT, ns)
        out = stdout_buf.getvalue().strip()
        if not out:
            err = stderr_buf.getvalue().strip()
            return {"success": False, "error": err or "No output from analyze script"}
        return json.loads(out)
    except Exception as e:
        return {"success": False, "error": f"{str(e)}\n{stderr_buf.getvalue()}"}


@app.get("/")
def root():
    return {
        "service": "Magentic Bridge",
        "version": "1.0.0",
        "endpoints": {
            "GET /status": "Check REAPER connection",
            "POST /execute": "Execute reapy code in REAPER",
            "GET /analyze": "Analyze current REAPER project state",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("BRIDGE_PORT", 5001))
    print(f"\n🧲 Magentic Bridge starting on http://localhost:{port}")
    print("   POST /execute  — Run reapy code in REAPER")
    print("   GET  /analyze  — Read full REAPER project state")
    print("   GET  /status   — Check REAPER connection")

    # Warmup: flush reapy's connection to prevent stale first-call data
    # reapy's socket handshake leaves residual data that poisons the first
    # few API calls. We make several throwaway calls to drain it.
    try:
        import reapy
        RPR = reapy.reascript_api
        # Multiple calls to fully flush any stale handshake data
        for i in range(5):
            try:
                v = RPR.GetAppVersion()
            except Exception:
                pass
        n = RPR.CountTracks(0)
        print(f"   ✅  REAPER connected — {n} tracks in project\n")
    except Exception as e:
        print(f"   ⚠️  REAPER warmup failed: {e} (will retry on first request)\n")

    uvicorn.run(app, host="0.0.0.0", port=port)
