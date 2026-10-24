#!/bin/bash
# K sequence: kaleidoscope A (cool palette, two mirrors at 30°, seed 3) as the chamber turns 0→15°.
# Each frame renders one wedge (WEDGE=1) and fold.py mirrors it into the rosette.
cd "$(dirname "$0")"
mkdir -p kframes
N=120
r() { o=$(printf "kframes/K_%03d.png" $1); [ -f $o ] || { PAL=cool SEED=3 ANGLE=30 SWEEP=15 WEDGE=1 TURN=$(python3 -c "print(15*$1/($N-1))") ../blender-venv/bin/python mandala.py $o.tmp.png 1400 64 > /dev/null 2>&1 && mv $o.tmp.png $o; }; echo "K $1 $(date +%T)"; }
for f in $(seq 0 4 116) 119; do r $f; done
echo QUARTER
for f in $(seq 2 4 118); do r $f; done
echo HALF
for f in $(seq 1 2 117); do r $f; done
echo ALLDONE
