#!/usr/bin/env python3
"""
Configure REAPER to use the Python that has reapy installed.
Run this from a terminal (REAPER can be open or closed).

  python3 configure_reaper.py

Then restart REAPER. After that, run reaper_server.py from inside REAPER
(Actions -> ReaScript: Run script...) to enable the distant API for the bridge.
"""
import os
import sys

# Default REAPER resource path on macOS
REAPER_RESOURCE_PATH = os.path.expanduser("~/Library/Application Support/REAPER")
REAPER_INI = os.path.join(REAPER_RESOURCE_PATH, "reaper.ini")

try:
    import reapy
    from reapy.config.shared_library import get_python_shared_library
except ModuleNotFoundError:
    print("reapy is not installed. Run: pip install python-reapy")
    sys.exit(1)


def main():
    if not os.path.exists(REAPER_INI):
        print(f"REAPER config not found at {REAPER_INI}")
        print("Make sure REAPER has been run at least once.")
        sys.exit(1)

    try:
        shared_lib = get_python_shared_library()
    except FileNotFoundError as e:
        print(f"Could not find Python shared library: {e}")
        sys.exit(1)

    lib_dir = os.path.dirname(shared_lib)
    lib_name = os.path.basename(shared_lib)
    print(f"Using Python: {shared_lib}")

    # Read reaper.ini
    with open(REAPER_INI, "r") as f:
        lines = f.readlines()

    # Update or add pythonlibpath64 and pythonlibdll64
    updated = {}
    new_lines = []
    in_reaper = False

    for line in lines:
        if line.strip() == "[reaper]":
            in_reaper = True
        elif in_reaper and line.startswith("["):
            in_reaper = False

        if in_reaper:
            if line.strip().startswith("pythonlibpath64="):
                new_lines.append(f"pythonlibpath64={lib_dir}\n")
                updated["path"] = True
                continue
            elif line.strip().startswith("pythonlibdll64="):
                new_lines.append(f"pythonlibdll64={lib_name}\n")
                updated["dll"] = True
                continue

        new_lines.append(line)

    # If we didn't find the keys, add them to [reaper] section
    if "path" not in updated or "dll" not in updated:
        for i, line in enumerate(new_lines):
            if line.strip() == "[reaper]":
                # Find the next line and insert after it
                insert_idx = i + 1
                while insert_idx < len(new_lines) and not new_lines[insert_idx].strip().startswith("["):
                    insert_idx += 1
                insert_lines = []
                if "path" not in updated:
                    insert_lines.append(f"pythonlibpath64={lib_dir}\n")
                if "dll" not in updated:
                    insert_lines.append(f"pythonlibdll64={lib_name}\n")
                for j, extra in enumerate(insert_lines):
                    new_lines.insert(insert_idx + j, extra)
                break

    with open(REAPER_INI, "w") as f:
        f.writelines(new_lines)

    print(f"Updated {REAPER_INI}")
    print("  pythonlibpath64 =", lib_dir)
    print("  pythonlibdll64  =", lib_name)
    print()
    print("Done! Restart REAPER, then run reaper_server.py from inside REAPER")
    print("  (Actions -> Show action list -> ReaScript: Run script...)")


if __name__ == "__main__":
    main()
