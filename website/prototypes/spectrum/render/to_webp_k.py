"""Folds each rendered wedge in kframes/ into the full rosette, written to the page's assets."""
import glob, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "assets", "cover")
n = 0
for p in sorted(glob.glob(os.path.join(HERE, "kframes", "K_[0-9][0-9][0-9].png"))):
    o = os.path.join(DST, os.path.basename(p)[:-4] + ".webp")
    if os.path.exists(o) and os.path.getmtime(o) > os.path.getmtime(p): continue
    subprocess.run(["python3", os.path.join(HERE, "fold.py"), p, o, "1400", "30"], check=True); n += 1
print("folded", n)
