"""
Magentic Bridge — Python/reapy bridge for direct REAPER control.
Runs on BRIDGE_PORT (default 5001). Backend uses BRIDGE_URL=http://localhost:5001.
"""

import io
import os
import sys
import json
import traceback
import ssl
import tempfile
import urllib.request
from contextlib import redirect_stdout, redirect_stderr
from typing import Optional

import reapy
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

app = FastAPI(title="Magentic Bridge", version="1.0.0")
REAPY_LOCK = threading.Lock()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    code: str


class DownloadRequest(BaseModel):
    url: str
    filename: Optional[str] = None


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
    with REAPY_LOCK:
        try:
            # import reapy  <-- Removed
    
            version = reapy.get_reaper_version()
            return StatusResponse(reaper_connected=True, reaper_version=version)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return StatusResponse(reaper_connected=False, error=f"{type(e).__name__}: {str(e)}")



@app.post("/execute", response_model=ExecuteResponse)
def execute_code(request: ExecuteRequest):
    """Execute Python/reapy code in REAPER's context."""
    with REAPY_LOCK:
        try:
            # import reapy <-- Removed
            pass
    
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
    with REAPY_LOCK:
        try:
            # import reapy <-- Removed
            pass
    
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



def get_installed_instruments():
    """
    Scans REAPER's resource path for reaper-vstplugins*.ini and reaper-auplugins*.ini
    to find installed instruments.
    """
    instruments = []
    
    # Standard macOS REAPER resource path
    resource_path = os.path.expanduser("~/Library/Application Support/REAPER")
    
    # 1. Scan VST plugins
    # Look for reaper-vstplugins*.ini
    try:
        for filename in os.listdir(resource_path):
            if filename.startswith("reaper-vstplugins") and filename.endswith(".ini"):
                path = os.path.join(resource_path, filename)
                with open(path, "r", errors="ignore") as f:
                    for line in f:
                        # Format: filename=id,id,Name (Developer)!!!VSTi
                        if "!!!VSTi" in line:
                            # Extract name
                            parts = line.split(",")
                            if len(parts) >= 3:
                                raw_name = parts[2]
                                # Remove !!!VSTi and optional (Developer)
                                name = raw_name.replace("!!!VSTi", "").strip()
                                # Simple heuristic to remove developer suffix if present in parens at end
                                # But sometimes it's part of the name, so let's just keep it for now or minimal clean
                                
                                # The filename is the identifier for VSTs in many contexts, 
                                # but usually we need the name for reascript AddFx
                                
                                instruments.append({
                                    "type": "VST",
                                    "name": name,
                                    "raw": raw_name.strip()
                                })
    except Exception as e:
        print(f"Error scanning VSTs: {e}")

    # 2. Scan AU plugins
    # Look for reaper-auplugins*.ini
    try:
        for filename in os.listdir(resource_path):
            if filename.startswith("reaper-auplugins") and filename.endswith(".ini"):
                path = os.path.join(resource_path, filename)
                with open(path, "r", errors="ignore") as f:
                    for line in f:
                        # Format: Manufacturer: Plugin Name=<inst>
                        if "=<inst>" in line:
                            content = line.split("=<inst>")[0]
                            # content is like "Apple: DLSMusicDevice"
                            # For AU, the name we pass to AddFx is usually "AU:Plugin Name" or "AU:Manufacturer: Plugin Name"
                            # Let's store a usable identifier
                            
                            instruments.append({
                                "type": "AU",
                                "name": content, # e.g. "Apple: DLSMusicDevice"
                                "ident": f"AU:{content}"
                            })
    except Exception as e:
        print(f"Error scanning AUs: {e}")
        
    return instruments


@app.get("/analyze/instruments")
def analyze_instruments():
    """Return a list of installed virtual instruments."""
    insts = get_installed_instruments()
    return {"success": True, "instruments": insts}


@app.post("/download")
def download_file(request: DownloadRequest):
    """Download a file from URL to a temp path REAPER can access."""
    try:
        filename = request.filename or "sample"
        if "." not in filename and request.url:
            base = request.url.split("?")[0]
            ext = base.split(".")[-1]
            if len(ext) <= 4 and ext.isalnum():
                filename = f"{filename}.{ext}"
        suffix = os.path.splitext(filename)[1] or ".mp3"
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        try:
            import certifi
            ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(request.url, context=ssl_ctx) as resp:
            with open(path, "wb") as f:
                f.write(resp.read())
        return {"success": True, "path": path}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/")
def root():
    return {
        "service": "Magentic Bridge",
        "version": "1.0.0",
        "endpoints": {
            "GET /status": "Check REAPER connection",
            "POST /execute": "Execute reapy code in REAPER",
            "POST /download": "Download URL to temp path for REAPER",
            "GET /analyze": "Analyze current REAPER project state",
            "GET /analyze/instruments": "List installed VST/AU instruments",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("BRIDGE_PORT", 5001))
    print(f"\n🧲 Magentic Bridge starting on http://localhost:{port}")
    print("   POST /execute  — Run reapy code in REAPER")
    print("   GET  /analyze  — Read full REAPER project state")
    print("   GET  /analyze/instruments — List installed instruments")
    print("   GET  /status   — Check REAPER connection\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
