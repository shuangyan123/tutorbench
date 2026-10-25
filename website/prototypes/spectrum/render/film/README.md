# Vision film: "Keep asking" (dandelion)

A ~42 s silent film for the About page. Six shots of one dandelion clock, rendered in Blender (Cycles) through the `bpy` Python module. Subtitles are page text over the video (zh / en), not burned in.

| Shot | Name | Seconds |
| --- | --- | --- |
| 1 | believe: the whole clock, backlit | 8 |
| 2 | ask: one seed lets go, camera follows it up | 7 |
| 3 | explore: seeds adrift | 7 |
| 4 | make: a seed touches still water, rings spread | 7 |
| 5 | see: rack focus onto one seed's crown | 9 |
| 6 | keep: the clock with a gap, two seeds leaving | 8 |

## Render

Needs Python 3.13 with `pip install bpy` (Blender 5.x) and ffmpeg.

```
python film.py FRAMES_DIR 1920 1080 16 12          # CPU
DEVICE=OPTIX python film.py FRAMES_DIR 1920 1080 16 12   # NVIDIA RTX (or CUDA / HIP / METAL)
python assemble.py FRAMES_DIR OUT_DIR 12
```

`film.py` skips frames that already exist, so it can be stopped and resumed, or run on several machines over a shared folder. Units are millimetres (1 Blender unit = 1 mm). The final uses the crisp look: no added haze, no extra depth of field (`DOFK` unset).
