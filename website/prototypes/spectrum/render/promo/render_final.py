# Final 1080p/24 render of the promo film on a local GPU, resumable (finished frames are skipped).
# usage:  python render_final.py [all | fonts | frames | comp | mux]
# env:    DEVICE=OPTIX (or CUDA / CPU), SPP=48, PY=<python with bpy 5.2.3 + pillow> (default: this python)
import os, sys, subprocess, urllib.request, time
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts"); FR = os.path.join(HERE, "frames"); FIN = os.path.join(HERE, "final"); OUTD = os.path.join(HERE, "out")
FPS, W, H = 24, 1920, 1080
SPP = os.environ.get("SPP", "48"); PY = os.environ.get("PY", sys.executable)
FONT_URLS = {
    "NotoSerifSC.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    "Cormorant.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
    "LXGW.ttf": "https://raw.githubusercontent.com/lxgw/LxgwWenKai/main/fonts/TTF/LXGWWenKai-Regular.ttf",
}
BASE = dict(KEY="30", FILL="5", RIM="30", GLOW="25", BG="#97a9dc", PLINTH="#8495c6", EXPO="-0.6")
# shot id, seconds, scene script, SHOT arg, extra env  (same values as the approved animatic)
SHOTS = [
    ("S1", 2, "o_open.py", "vortex", dict(INKD="900", INKT="0.5", INKS="120")),
    ("S2", 2, "o_open.py", "papers", dict(EXPO="-1.3")),
    ("S3", 6, "o_open.py", "unit", dict(FSTOP="4")),
    ("S4", 8, "a_marble.py", "run", dict(FSTOP="5.6", LENS="55")),
    ("S5", 8, "a_marble.py", "run", dict(FSTOP="4")),
    ("S6", 6, "a_marble.py", "run", dict(FSTOP="4")),
    ("S7", 8, "a_marble.py", "steps", dict(EXPO="-0.8", FSTOP="5", LENS="40", BACK="0.2", SIDE="0.09", UP="0.07", AHEAD="0.18", TDZ="0.03")),
    ("S8", 10, "a_marble.py", "gates", dict(EXPO="-1.0", GLOW="8")),
    ("S9", 5, "a_marble.py", "rows", {}),
]


def fonts():
    os.makedirs(FONTS, exist_ok=True)
    for n, u in FONT_URLS.items():
        p = os.path.join(FONTS, n)
        if not os.path.exists(p):
            print("font", n); urllib.request.urlretrieve(u, p)


def env(extra):
    e = dict(os.environ); e.update(BASE); e.update(extra); e["FONTS"] = FONTS; e.setdefault("DEVICE", "OPTIX"); return e


def frames():
    for sid, sec, script, shot, extra in SHOTS:
        out = os.path.join(FR, sid); n = int(sec * FPS)
        done = len([f for f in os.listdir(out) if f.endswith(".png")]) if os.path.isdir(out) else 0
        if done >= n: print(sid, "done"); continue
        t0 = time.time(); print(sid, "rendering", n - done, "frames", flush=True)
        e = env(extra); e.update(ANIM=os.path.join(HERE, "anim.py"), SHOTID=sid, F0="0", F1=str(n), FSTEP="1", FPS=str(FPS))
        subprocess.run([PY, os.path.join(HERE, script), shot, out, str(W), str(H), SPP], env=e, check=True, cwd=HERE)
        print(sid, "%.1f min" % ((time.time() - t0) / 60), flush=True)
    end = os.path.join(FR, "end.png")
    if not os.path.exists(end):
        e = env(dict(EXPO="-1.0", GLOW="8", CAM="0.06,-0.40,0.035", TGT="0.0,0,-0.01"))
        subprocess.run([PY, os.path.join(HERE, "a_marble.py"), "end", end, str(W), str(H), str(int(SPP) * 2)], env=e, check=True, cwd=HERE)


def _comp(rng):
    e = dict(os.environ, FR=FR, OUT=FIN, FPS=str(FPS), OUT_W=str(W), OUT_H=str(H), FONTS=FONTS)
    subprocess.run([sys.executable, os.path.join(HERE, "comp.py"), str(rng[0]), str(rng[1])], env=e, check=True, cwd=HERE)


def comp():
    os.makedirs(FIN, exist_ok=True); n = 60 * FPS; k = max(1, (os.cpu_count() or 4) - 1); step = (n + k - 1) // k
    with ProcessPoolExecutor(k) as ex: list(ex.map(_comp, [(i, min(n, i + step)) for i in range(0, n, step)]))


def mux():
    os.makedirs(OUTD, exist_ok=True)
    a = ["ffmpeg", "-y", "-framerate", str(FPS), "-i", os.path.join(FIN, "%04d.png"), "-i", os.path.join(HERE, "audio.flac")]
    subprocess.run(a + ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "48000",
                        "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", os.path.join(OUTD, "promo_1080p.mp4")], check=True)
    subprocess.run(["ffmpeg", "-y", "-i", os.path.join(FIN, "%04d.png" % (21 * FPS)), os.path.join(OUTD, "poster.png")], check=True)


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if step in ("all", "fonts"): fonts()
    if step in ("all", "frames"): frames()
    if step in ("all", "comp"): comp()
    if step in ("all", "mux"): mux()
