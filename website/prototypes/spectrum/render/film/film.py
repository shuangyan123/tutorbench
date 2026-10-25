# render the preview film: python film.py OUTDIR W H SPP FPS [shots...]
import os, sys, runpy, time
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = [("believe", 8), ("ask", 7), ("explore", 7), ("make", 7), ("see", 9), ("keep", 8)]
out, W, H, SPP, FPS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
only = sys.argv[6:]
os.makedirs(out, exist_ok=True)
for shot, sec in SHOTS:
    if only and shot not in only: continue
    n = sec * FPS
    for i in range(n):
        f = os.path.join(out, f"{shot}_{i:03d}.png")
        if os.path.exists(f): continue
        os.environ["T"] = str(i / (n - 1)); os.environ["FR"] = "0.02" if shot == "explore" else "0.014"
        sys.argv = ["dandelion.py", shot, f + ".tmp.png", W, H, SPP]
        t0 = time.time()
        runpy.run_path(os.path.join(HERE, "dandelion.py"), run_name="__main__")
        os.replace(f + ".tmp.png", f)
        print(shot, i, n, round(time.time() - t0, 1), flush=True)
