#!/bin/bash
# Clone demucs and basic-pitch into the functions folder
# Run from project root: ./functions/setup_repos.sh

set -e
cd "$(dirname "$0")"

echo "Cloning demucs..."
git clone https://github.com/facebookresearch/demucs.git

echo "Cloning basic-pitch..."
git clone https://github.com/spotify/basic-pitch.git

echo "Done! Install with: pip install -r backend/functions/requirements.txt"
ls -la
