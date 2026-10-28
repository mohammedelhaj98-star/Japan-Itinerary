#!/usr/bin/env bash
# What the faces container is built from, downloaded here first (the image build itself needs no network):
# the Python wheels, and the models (InsightFace buffalo_l: SCRFD det_10g + ArcFace w600k_r50; YOLOX-s). ~600 MB, once.
set -euo pipefail
cd "$(dirname "$0")/server"
mkdir -p parts/wheels parts/models
[ -n "$(ls parts/wheels 2>/dev/null)" ] || pip download -q --only-binary=:all: --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 --python-version 3.12 -d parts/wheels -r requirements.txt
if [ ! -f parts/models/w600k_r50.onnx ]; then
  curl -sSfL -o parts/buffalo_l.zip https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
  unzip -o -q -j parts/buffalo_l.zip det_10g.onnx w600k_r50.onnx -d parts/models && rm parts/buffalo_l.zip
fi
[ -f parts/models/yolox_s.onnx ] || curl -sSfL -o parts/models/yolox_s.onnx https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx
