"""
Magentic Bridge — Python/reapy bridge for direct REAPER control.
Runs as a FastAPI server on port 5000.
"""

import io
import os
import sys
import json
import traceback
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


@app.get("/status", response_model=StatusResponse)
def get_status():
    """Check if REAPER is reachable via reapy."""
    try:
        import reapy

        version = reapy.get_reaper_version()
        return StatusResponse(reaper_connected=True, reaper_version=version)
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
import reapy, json as _json
_RPR = reapy.reascript_api
_n = _RPR.CountTracks(0)
_tracks = []
for _i in range(_n):
    _t = _RPR.GetTrack(0, _i)
    _fx = []
    for _j in range(_RPR.TrackFX_GetCount(_t)):
        _fx.append({"index":_j,"name":_RPR.TrackFX_GetFXName(_t,_j,"",256)[3],"is_enabled":_RPR.TrackFX_GetEnabled(_t,_j),"n_params":_RPR.TrackFX_GetNumParams(_t,_j)})
    _tracks.append({"index":_i,"name":_RPR.GetSetMediaTrackInfo_String(_t,"P_NAME","",False)[3] or f"Track {_i+1}","volume":round(_RPR.GetMediaTrackInfo_Value(_t,"D_VOL"),3),"pan":round(_RPR.GetMediaTrackInfo_Value(_t,"D_PAN"),3),"is_muted":bool(_RPR.GetMediaTrackInfo_Value(_t,"B_MUTE")),"is_solo":bool(_RPR.GetMediaTrackInfo_Value(_t,"I_SOLO")),"is_armed":bool(_RPR.GetMediaTrackInfo_Value(_t,"I_RECARM")),"n_items":_RPR.CountTrackMediaItems(_t),"fx":_fx})
print(_json.dumps({"success":True,"project":{"bpm":_RPR.Master_GetTempo(),"n_tracks":_n,"cursor_position":round(_RPR.GetCursorPosition(),3),"is_playing":bool(_RPR.GetPlayState()&1)},"tracks":_tracks}))
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
