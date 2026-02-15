
# Run this script from inside REAPER to start the reapy server.
# In REAPER: Actions -> Show action list -> ReaScript: Run script...
# Select this file. Port 8080 will open and the bridge can connect.
import reapy
import reapy.config.config
import reapy.config.resource_path
import sys
import psutil

# 1. Inject psutil into reapy's internal module because it skips importing it inside REAPER
#    but uses it in configure_reaper().
reapy.config.resource_path.psutil = psutil

# 2. Monkey patch reapy.config.config.CaseInsensitiveDict.__contains__
#    to fix Python 3.14 compatibility issue where configparser passes non-string keys 
#    (UNNAMED_SECTION) to __contains__, causing AttributeError on .lower().

OriginalCaseInsensitiveDict = reapy.config.config.CaseInsensitiveDict
original_contains = OriginalCaseInsensitiveDict.__contains__

def patched_contains(self, key):
    if not isinstance(key, str):
        return False
    return original_contains(self, key)

reapy.config.config.CaseInsensitiveDict.__contains__ = patched_contains

# 3. Use the new recommended function
try:
    reapy.config.configure_reaper()
    reapy.print("Magentic Bridge: REAPER configured successfully!")
except Exception as e:
    reapy.print(f"Magentic Bridge: Error configuring REAPER: {e}")
    # Print more details if possible
    import traceback
    reapy.print(traceback.format_exc())
