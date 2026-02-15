"""
Magentic Bridge — Python/reapy bridge for direct REAPER control.
Runs as a FastAPI server on port 5000.
"""

# Import reapy FIRST to avoid circular import issues
import warnings
warnings.filterwarnings('ignore', category=UserWarning, module='reapy')

import reapy
REAPY_AVAILABLE = True

import io
import math
import os
import sys
import json
import traceback
import ssl
import tempfile
import urllib.request
from contextlib import redirect_stdout, redirect_stderr
from typing import Optional, List

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


class VolumeEnvelopeRequest(BaseModel):
    track_index: int
    points: List[dict]  # [{"time": float, "value": float, "shape"?: int}]
    curve: str = "linear"  # "linear" = straight line in gain, "constant_db" = perceptually even fade
    num_interpolation_points: int = 20  # number of intermediate points for constant_db curves


class RemoveEnvelopeRequest(BaseModel):
    track_index: int


@app.get("/status", response_model=StatusResponse)
def get_status():
    """Check if REAPER is reachable via reapy."""
    if not REAPY_AVAILABLE or reapy is None:
        return StatusResponse(reaper_connected=False, error="reapy not available")
    with REAPY_LOCK:
        try:
            version = reapy.get_reaper_version()
            return StatusResponse(reaper_connected=True, reaper_version=version)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return StatusResponse(reaper_connected=False, error=f"{type(e).__name__}: {str(e)}")



@app.post("/execute", response_model=ExecuteResponse)
def execute_code(request: ExecuteRequest):
    """Execute Python/reapy code in REAPER's context."""
    if not REAPY_AVAILABLE or reapy is None:
        return ExecuteResponse(success=False, error="reapy not available")
    with REAPY_LOCK:
        try:
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
    _ni = _RPR.CountTrackMediaItems(_t)
    _items = []
    for _k in range(_ni):
        _it = _RPR.GetTrackMediaItem(_t, _k)
        _items.append({"index":_k,"position":round(float(_RPR.GetMediaItemInfo_Value(_it,"D_POSITION")),3),"length":round(float(_RPR.GetMediaItemInfo_Value(_it,"D_LENGTH")),3)})
    _tracks.append({"index":_i,"name":_RPR.GetSetMediaTrackInfo_String(_t,"P_NAME","",False)[3] or f"Track {_i+1}","volume":round(_RPR.GetMediaTrackInfo_Value(_t,"D_VOL"),3),"pan":round(_RPR.GetMediaTrackInfo_Value(_t,"D_PAN"),3),"is_muted":bool(_RPR.GetMediaTrackInfo_Value(_t,"B_MUTE")),"is_solo":bool(_RPR.GetMediaTrackInfo_Value(_t,"I_SOLO")),"is_armed":bool(_RPR.GetMediaTrackInfo_Value(_t,"I_RECARM")),"n_items":_ni,"items":_items,"fx":_fx})
print(_json.dumps({"success":True,"project":{"bpm":_RPR.Master_GetTempo(),"n_tracks":_n,"cursor_position":round(_RPR.GetCursorPosition(),3),"is_playing":bool(_RPR.GetPlayState()&1)},"tracks":_tracks}))
"""

@app.get("/analyze")
def analyze_project():
    """Analyze the current REAPER project and return its full state."""
    if not REAPY_AVAILABLE or reapy is None:
        return {"success": False, "error": "reapy not available"}
    with REAPY_LOCK:
        try:
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


# ---------------------------------------------------------------------------
# Volume Envelope helpers (SetEnvelopeStateChunk approach)
# ---------------------------------------------------------------------------
# Why this approach?
#   - RPR.InsertEnvelopePoint() silently fails through reapy remote proxy
#   - SetTrackStateChunk replaces the ENTIRE track (items, FX, routing) which
#     can corrupt the track and kill audio
#   - GetEnvelopeStateChunk / SetEnvelopeStateChunk DO work through reapy
#     remote (proven by VIS toggle tests) — they only touch the envelope,
#     leaving the rest of the track completely intact


def _is_null_ptr(ptr):
    """Check if a reapy remote pointer is null/invalid."""
    if ptr is None:
        return True
    if isinstance(ptr, (int, float)) and ptr == 0:
        return True
    s = str(ptr)
    if s in ("0", "None", "", "nil"):
        return True
    # reapy remote pointers: "(TrackEnvelope*)0x00007FF1A2B3C4D5"
    # null pointers have all-zero hex digits
    if "0x" in s:
        hex_part = s.split("0x")[-1].rstrip(")")
        try:
            return int(hex_part, 16) == 0
        except ValueError:
            pass
    return False


def _select_only_track(RPR, track_index):
    """Deselect all tracks, then select only the given one."""
    n = int(RPR.CountTracks(0))
    for i in range(n):
        t = RPR.GetTrack(0, i)
        RPR.SetTrackSelected(t, i == track_index)


# Minimum dB floor (avoids log10(0) and keeps values audible until the end)
_DB_FLOOR = -80.0   # ≈ 0.0001 linear gain
_LIN_FLOOR = 10 ** (_DB_FLOOR / 20)   # pre-computed


def _interpolate_constant_db(points, n_steps=20):
    """Expand a list of {time, value} points into many intermediate points
    that follow a dB-linear (perceptually constant-rate) curve.

    A 2-point fade [1.0 → 0.0] in linear gain sounds like an instant
    drop because human hearing is logarithmic.  This function generates
    intermediate points so the gain decreases at a constant dB/sec rate,
    which *sounds* like a smooth, even fade.
    """
    if len(points) < 2:
        return points

    expanded = []
    for i in range(len(points) - 1):
        p0 = points[i]
        p1 = points[i + 1]
        t0 = float(p0.get("time", p0.get("t", 0)))
        t1 = float(p1.get("time", p1.get("t", 0)))
        v0 = max(float(p0.get("value", p0.get("v", 1.0))), _LIN_FLOOR)
        v1_raw = float(p1.get("value", p1.get("v", 0.0)))
        # If target is true silence (0.0), use floor for dB calc, set last point to 0
        target_silence = v1_raw <= 0.0
        v1 = max(v1_raw, _LIN_FLOOR)

        db0 = 20 * math.log10(v0)
        db1 = 20 * math.log10(v1)

        for j in range(n_steps + 1):
            frac = j / n_steps
            t = t0 + frac * (t1 - t0)
            db = db0 + frac * (db1 - db0)
            v = 10 ** (db / 20)
            # Last point: use the raw target (0.0 if silence was requested)
            if j == n_steps and target_silence:
                v = 0.0
            expanded.append({"time": round(t, 6), "value": round(v, 6), "shape": 0})

    return expanded


@app.post("/envelope/volume")
def create_volume_envelope(request: VolumeEnvelopeRequest):
    """Create or update volume automation using SetEnvelopeStateChunk.

    This only modifies the envelope — items, FX, and routing are untouched.
    """
    with REAPY_LOCK:
        try:
            RPR = reapy.reascript_api

            n_tracks = int(RPR.CountTracks(0))
            if request.track_index < 0 or request.track_index >= n_tracks:
                return {"success": False, "error": f"Track index {request.track_index} out of range (0-{n_tracks - 1})"}

            track = RPR.GetTrack(0, request.track_index)

            # --- get or create the volume envelope ---
            env = RPR.GetTrackEnvelopeByName(track, "Volume")

            if _is_null_ptr(env):
                # Envelope hidden/missing — select track and toggle it visible
                _select_only_track(RPR, request.track_index)
                RPR.Main_OnCommand(40406, 0)   # Toggle track volume envelope visible
                env = RPR.GetTrackEnvelopeByName(track, "Volume")

            if _is_null_ptr(env):
                return {
                    "success": False,
                    "error": "Could not create volume envelope. Is the track visible in REAPER?",
                }

            # --- interpolate if constant_db curve requested ---
            points = request.points
            if request.curve == "constant_db" and len(points) >= 2:
                points = _interpolate_constant_db(points, request.num_interpolation_points)

            # --- build the envelope state chunk (with points) ---
            pt_lines = []
            for pt in points:
                t = float(pt.get("time", pt.get("t", 0)))
                v = float(pt.get("value", pt.get("v", 1.0)))
                s = int(pt.get("shape", pt.get("s", 0)))
                pt_lines.append(f"PT {t} {v} {s}")

            env_chunk = (
                "<VOLENV\n"
                "ACT 1 -1\n"
                "VIS 1 1 1\n"
                "LANEHEIGHT 0 0\n"
                "ARM 0\n"
                "DEFSHAPE 0 -1 -1\n"
                + "\n".join(pt_lines) + "\n"
                ">"
            )

            # --- set the envelope state (leaves track items/FX untouched) ---
            RPR.SetEnvelopeStateChunk(env, env_chunk, False)

            # --- refresh UI ---
            RPR.Envelope_SortPoints(env)
            RPR.TrackList_AdjustWindows(False)
            RPR.UpdateArrange()

            curve_note = f" (constant dB curve, {len(points)} interpolated points)" if request.curve == "constant_db" else ""
            return {
                "success": True,
                "output": f"Volume envelope created with {len(points)} points on track {request.track_index}{curve_note}",
            }

        except Exception as e:
            tb = traceback.format_exc()
            return {"success": False, "error": f"{str(e)}\n{tb}"}


@app.post("/envelope/volume/remove")
def remove_volume_envelope(request: RemoveEnvelopeRequest):
    """Remove volume automation from a track."""
    with REAPY_LOCK:
        try:
            RPR = reapy.reascript_api

            track = RPR.GetTrack(0, request.track_index)
            env = RPR.GetTrackEnvelopeByName(track, "Volume")

            if _is_null_ptr(env):
                return {"success": True, "output": "No volume envelope found (already removed)"}

            # Set envelope to inactive + hidden with no points
            empty_chunk = (
                "<VOLENV\n"
                "ACT 0 -1\n"
                "VIS 0 0 0\n"
                "LANEHEIGHT 0 0\n"
                "ARM 0\n"
                "DEFSHAPE 0 -1 -1\n"
                ">"
            )
            RPR.SetEnvelopeStateChunk(env, empty_chunk, False)

            RPR.TrackList_AdjustWindows(False)
            RPR.UpdateArrange()

            return {"success": True, "output": f"Volume envelope removed from track {request.track_index}"}

        except Exception as e:
            tb = traceback.format_exc()
            return {"success": False, "error": f"{str(e)}\n{tb}"}


# ---------------------------------------------------------------------------
# FX preset search & load (for plugins with internal preset browsers)
# ---------------------------------------------------------------------------

# Known plugin preset directories on macOS
_PRESET_SEARCH_PATHS = [
    "/Library/Application Support/Valhalla DSP, LLC",
    os.path.expanduser("~/Library/Application Support/Valhalla DSP, LLC"),
]

_PRESET_EXTENSIONS = {".vpreset", ".fxp", ".vstpreset", ".xml"}

# Metadata attributes to skip when setting parameters from a preset file
_PRESET_SKIP_ATTRS = {"pluginVersion", "presetName", "mixLock", "uiWidth", "uiHeight",
                       "version", "name", "type", "category"}


class SearchPresetsRequest(BaseModel):
    query: str  # substring to match in preset filename (case-insensitive)
    plugin_name: str = ""  # optional substring to narrow to a specific plugin


class LoadPresetFileRequest(BaseModel):
    track_index: int
    fx_index: int
    preset_path: str  # full path to the .vpreset file


@app.post("/fx/presets/search")
def search_fx_presets(request: SearchPresetsRequest):
    """Search for FX preset files on disk by name substring."""
    try:
        query = request.query.strip().lower()
        plugin_filter = request.plugin_name.strip().lower()
        if not query:
            return {"success": False, "error": "query is required"}

        matches = []
        for base_path in _PRESET_SEARCH_PATHS:
            if not os.path.isdir(base_path):
                continue
            for root_dir, _dirs, files in os.walk(base_path):
                # Optional: filter by plugin name in path
                if plugin_filter and plugin_filter not in root_dir.lower():
                    continue
                for fname in files:
                    _name, ext = os.path.splitext(fname)
                    if ext.lower() not in _PRESET_EXTENSIONS:
                        continue
                    if query in fname.lower():
                        full_path = os.path.join(root_dir, fname)
                        # Extract category from directory structure
                        rel = os.path.relpath(full_path, base_path)
                        matches.append({
                            "name": _name,
                            "file": fname,
                            "path": full_path,
                            "category": os.path.dirname(rel),
                        })

        matches.sort(key=lambda m: m["name"].lower())
        return {
            "success": True,
            "query": request.query,
            "count": len(matches),
            "presets": matches[:50],  # cap at 50 results
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/fx/presets/load")
def load_fx_preset_file(request: LoadPresetFileRequest):
    """Load an FX preset from a .vpreset XML file by setting each parameter directly."""
    with REAPY_LOCK:
        try:
            import xml.etree.ElementTree as ET

            RPR = reapy.reascript_api

            # Validate path
            if not os.path.isfile(request.preset_path):
                return {"success": False, "error": f"File not found: {request.preset_path}"}

            # Parse preset XML
            tree = ET.parse(request.preset_path)
            root = tree.getroot()
            preset_name = root.attrib.get("presetName", os.path.splitext(os.path.basename(request.preset_path))[0])

            # Build plugin parameter map: name -> index
            track = RPR.GetTrack(0, request.track_index)
            n_params = int(RPR.TrackFX_GetNumParams(track, request.fx_index))
            param_map = {}
            for i in range(n_params):
                name_t = RPR.TrackFX_GetParamName(track, request.fx_index, i, "", 256)
                pname = name_t[4] if isinstance(name_t, (list, tuple)) and len(name_t) >= 5 else str(name_t)
                param_map[pname] = i

            # Set each parameter from the preset file
            set_count = 0
            skipped = []
            for attr, val in root.attrib.items():
                if attr in _PRESET_SKIP_ATTRS:
                    continue
                if attr in param_map:
                    try:
                        RPR.TrackFX_SetParamNormalized(track, request.fx_index, param_map[attr], float(val))
                        set_count += 1
                    except (ValueError, TypeError):
                        skipped.append(attr)
                else:
                    skipped.append(attr)

            result = {
                "success": True,
                "output": f"Loaded preset '{preset_name}': set {set_count} parameters on FX {request.fx_index} (track {request.track_index})",
                "preset_name": preset_name,
                "params_set": set_count,
            }
            if skipped:
                result["skipped_attrs"] = skipped
            return result

        except ET.ParseError as e:
            return {"success": False, "error": f"Invalid preset XML: {e}"}
        except Exception as e:
            tb = traceback.format_exc()
            return {"success": False, "error": f"{str(e)}\n{tb}"}


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
            "POST /envelope/volume": "Create/update volume automation on a track",
            "POST /envelope/volume/remove": "Remove volume automation from a track",
            "POST /fx/presets/search": "Search for FX preset files on disk by name",
            "POST /fx/presets/load": "Load an FX preset from a file by setting parameters",
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
