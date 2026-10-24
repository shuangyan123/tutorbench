#!/bin/bash
# Q sequence: the 60 frames the page shows (end cap -> desk), 1920x1200, 48 spp
cd "$(dirname "$0")"
mkdir -p qframes
r() { o=$(printf "qframes/Q_%03d.png" $1); [ -f $o ] || { ../blender-venv/bin/python scene.py Q $1 $o.tmp.png 1920 1200 48 > /dev/null 2>&1 && mv $o.tmp.png $o; }; echo "Q $1 $(date +%T)"; }
for f in $(seq 0 4 56) 59; do r $f; done
echo QUARTER
for f in $(seq 2 4 58); do r $f; done
echo HALF
for f in $(seq 1 2 59); do r $f; done
echo ALLDONE
