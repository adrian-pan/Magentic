# Magentic ML functions: stem separation (Demucs) + audio-to-MIDI (Basic Pitch)
# Target: linux/amd64 for RunPod serverless GPU
# Build: docker build --platform linux/amd64 -t magentic-ml:latest .

FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python 3.10 (PyTorch bundles its own CUDA libs via pip, no system CUDA libs needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3.10-venv python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python

WORKDIR /app

# Install PyTorch with CUDA (for Demucs)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install Demucs deps (excluding torch/torchaudio which are already installed above)
# Demucs pins torchaudio<2.1 which would downgrade our cu121 install, so we use --no-deps
COPY demucs/ /app/demucs/
RUN pip install --no-cache-dir dora-search einops "julius>=0.2.3" "lameenc>=1.2" openunmix pyyaml tqdm
RUN pip install --no-cache-dir --no-deps -e /app/demucs/

# Pre-download the htdemucs model so it's baked into the image
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"

# Pin NumPy <2 to stay compatible with PyTorch/torchaudio compiled against NumPy 1.x
RUN pip install --no-cache-dir "numpy<2"

# Install Basic Pitch with ONNX only (no TensorFlow)
COPY basic-pitch/ /app/basic-pitch/
RUN pip install --no-cache-dir onnxruntime librosa mir_eval pretty_midi "resampy>=0.2.2,<0.4.3" scikit-learn scipy typing_extensions
RUN pip install --no-cache-dir --no-deps -e /app/basic-pitch/

# Install RunPod handler deps
COPY requirements-runpod.txt /app/requirements-runpod.txt
RUN pip install --no-cache-dir -r /app/requirements-runpod.txt

# Copy API and handler
COPY api.py /app/api.py
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
