# frames -> film.mp4 (H.264) + film.webm (AV1 via SVT-AV1 when available)
# usage: python assemble.py FRAMES_DIR OUT_DIR [FPS_IN=12]
# 12 fps renders are motion-interpolated to 24 fps; 0.6 s crossfades between shots; 1 s fade in / 1.2 s fade out.
import os, subprocess, sys
frames, out = sys.argv[1], sys.argv[2]; fps = int(sys.argv[3]) if len(sys.argv) > 3 else 12
SHOTS = ["believe", "ask", "explore", "make", "see", "keep"]; X = 0.6
os.makedirs(out, exist_ok=True); clips = os.path.join(out, "clips"); os.makedirs(clips, exist_ok=True)
run = lambda *a: subprocess.run(list(a), check=True)
vf = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1,format=yuv420p" if fps < 24 else "format=yuv420p"
dur = {}
for s in SHOTS:
    c = os.path.join(clips, s + ".mp4")
    run("ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(frames, s + "_%03d.png"),
        "-vf", vf, "-c:v", "libx264", "-crf", "10", "-preset", "slow", c)
    dur[s] = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", c],
                                  capture_output=True, text=True, check=True).stdout)
offs, t = [], 0.0
for s in SHOTS[:-1]:
    t += dur[s] - X; offs.append(t)
total = offs[-1] + dur[SHOTS[-1]]
f, prev = [], "[0]"
for i, o in enumerate(offs):
    lab = f"[x{i}]"; f.append(f"{prev}[{i + 1}]xfade=transition=fade:duration={X}:offset={o:.3f}{lab}"); prev = lab
f.append(f"{prev}fade=t=in:st=0:d=1,fade=t=out:st={total - 1.2:.3f}:d=1.2,format=yuv420p[v]")
ins = sum([["-i", os.path.join(clips, s + ".mp4")] for s in SHOTS], [])
master = os.path.join(out, "master.mp4")
run("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", "[v]", "-c:v", "libx264", "-crf", "8", "-preset", "slow", "-an", master)
run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-profile:v", "high",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", os.path.join(out, "film.mp4"))
try:
    run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-c:v", "libsvtav1", "-crf", "34", "-preset", "5", "-pix_fmt", "yuv420p10le", "-an", os.path.join(out, "film.webm"))
except Exception as e:
    print("AV1 skipped:", e)
print("shot starts:", [0.0] + [round(o, 3) for o in offs], "total", round(total, 3))
