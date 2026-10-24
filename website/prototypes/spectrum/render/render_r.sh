#!/bin/bash
# R sequence = Q camera path with the detailed object cell, 120 frames, 1920x1200, 40 spp
cd "$(dirname "$0")"
mkdir -p rframes
r() { o=$(printf "rframes/R_%03d.png" $1); [ -f $o ] || { NQ=120 ../blender-venv/bin/python scene.py Q $1 $o.tmp.png 1920 1200 40 > /dev/null 2>&1 && mv $o.tmp.png $o; }; echo "R $1 $(date +%T)"; }
for f in $(seq 0 4 116) 119; do r $f; done
echo QUARTER
for f in $(seq 2 4 118); do r $f; done
echo HALF
for f in $(seq 1 2 117); do r $f; done
echo ALLDONE
