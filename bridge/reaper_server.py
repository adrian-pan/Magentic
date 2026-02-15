# Run this script from inside REAPER to start the reapy server.
# In REAPER: Actions -> Show action list -> ReaScript: Run script...
# Select this file. Port 8080 will open and the bridge can connect.
import reapy
reapy.config.enable_dist_api()
