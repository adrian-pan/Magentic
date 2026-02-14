"""
Magentic Bridge — Python/reapy bridge for direct REAPER control.
Runs as a FastAPI server on port 5000.
"""

import io
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
        "project": None,
        "__builtins__": __builtins__,
    }

    try:
        # Get current project
        namespace["project"] = reapy.Project()

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


@app.get("/analyze")
def analyze_project():
    """Analyze the current REAPER project and return its full state."""
    try:
        import reapy
    except Exception as e:
        return {"success": False, "error": f"Cannot connect to REAPER: {str(e)}"}

    try:
        project = reapy.Project()

        # Build comprehensive project snapshot
        tracks_data = []
        for i, track in enumerate(project.tracks):
            track_info = {
                "index": i,
                "name": track.name or f"Track {i + 1}",
                "volume": round(track.volume, 3),
                "pan": round(track.pan, 3),
                "is_muted": track.is_muted,
                "is_solo": track.is_solo,
                "is_armed": track.is_armed,
                "n_items": track.n_items,
                "color": track.color,
                "fx": [],
            }

            # Get FX chain details
            try:
                for j, fx in enumerate(track.fxs):
                    fx_info = {
                        "index": j,
                        "name": fx.name,
                        "is_enabled": fx.is_enabled,
                        "n_params": fx.n_params,
                        "params": {},
                    }
                    # Capture first 10 params (to avoid huge payloads)
                    try:
                        for k in range(min(fx.n_params, 10)):
                            param_name = fx.params[k].name if hasattr(fx.params[k], 'name') else f"Param {k}"
                            fx_info["params"][param_name] = round(float(fx.params[k]), 4)
                    except Exception:
                        pass
                    track_info["fx"].append(fx_info)
            except Exception:
                pass

            # Get item info
            items_data = []
            try:
                for item in track.items:
                    items_data.append({
                        "position": round(item.position, 3),
                        "length": round(item.length, 3),
                        "is_muted": item.is_muted,
                        "active_take": item.active_take.name if item.active_take else None,
                    })
            except Exception:
                pass
            track_info["items"] = items_data

            tracks_data.append(track_info)

        project_state = {
            "success": True,
            "project": {
                "name": project.name,
                "bpm": project.bpm,
                "length": round(project.length, 3),
                "n_tracks": len(project.tracks),
                "cursor_position": round(project.cursor_position, 3),
                "is_playing": False,  # reapy may not expose this directly
            },
            "tracks": tracks_data,
        }

        # Try to get play state
        try:
            project_state["project"]["is_playing"] = project.is_playing
        except Exception:
            pass

        return project_state

    except Exception as e:
        tb = traceback.format_exc()
        return {"success": False, "error": f"{str(e)}\n\n{tb}"}


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

    print("\n🧲 Magentic Bridge starting on http://localhost:5000")
    print("   POST /execute  — Run reapy code in REAPER")
    print("   GET  /analyze  — Read full REAPER project state")
    print("   GET  /status   — Check REAPER connection\n")
    uvicorn.run(app, host="0.0.0.0", port=5000)
