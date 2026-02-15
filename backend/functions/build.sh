#!/bin/bash
# Build Magentic ML Docker image for linux/amd64 (RunPod)
set -e
cd "$(dirname "$0")"
docker build --platform linux/amd64 -t magentic-ml:latest .
echo "Built magentic-ml:latest"
