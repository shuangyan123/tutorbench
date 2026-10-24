#!/bin/bash
cd "$(dirname "$0")"
r() { o=$(printf "frames/%s_%03d.png" $1 $2); [ -f $o ] || ../blender-venv/bin/python scene.py $1 $2 $o.tmp.png 1200 750 32 > /dev/null 2>&1 && mv $o.tmp.png $o; echo "$1 $2 $(date +%T)"; }
for f in $(seq 0 2 46) 47; do r P $f; done
for f in $(seq 2 2 28); do r L $f; done
echo EVENDONE
for f in $(seq 1 2 45); do r P $f; done
for f in $(seq 1 2 29); do r L $f; done
echo ALLDONE
