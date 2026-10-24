#!/usr/bin/env python3
"""Builds the site's own web fonts (assets/fonts/) and their @font-face rules (fonts.css).

The pages used to load eight families from Google Fonts. That stylesheet is about 150 KB because of
the Chinese faces, it comes from another server and it blocks the first paint, so a phone on a slow
connection waited many seconds for any text. The site now serves the same families itself:

- the same font files Google Fonts serves (github.com/google/fonts, pinned below, all SIL OFL 1.1),
- limited to the weights the pages ask for (the ranges the old Google Fonts URL requested),
- and cut down to the characters the site uses. The text is static, so the Chinese faces only need
  the ~1,100 characters that appear in the pages: about 0.7 MB for the whole site instead of
  about 2.3 MB for the home page alone.

Run it again whenever pages gain new characters (tests/spectrum-site.test.ts fails until you do):

    pip install fonttools brotli
    python3 website/prototypes/spectrum/tools/build-fonts.py

Source fonts are downloaded once into ~/.cache/teachometry-fonts (or $FONT_CACHE).
"""
import glob
import html
import os
import re
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

PROTO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(PROTO, "assets", "fonts")
CACHE = os.environ.get("FONT_CACHE") or os.path.expanduser("~/.cache/teachometry-fonts")
COMMIT = "e7db6ca603fd4862010383ff17ffd6cc4ffac1c0"  # google/fonts main, 2026-10-24
RAW = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/"

# the Latin faces keep the whole Latin-1 block and common punctuation (so text added later in those
# ranges still renders in the right face), plus every other character the pages use below CJK
LATIN = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180)) | set(range(0x2000, 0x2070)) | {
    0x131, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193,
    0x2212, 0x2215, 0xFFFD,
}
CJK_START = 0x2E80
CJK_BLOCKS = set(range(0x2E80, 0xA000)) | set(range(0xF900, 0xFB00)) | set(range(0xFE30, 0xFE50)) | set(range(0xFF00, 0xFFF0))

# family, source file, output name, style, axis limits (the old Google Fonts request), which characters
FACES = [
    ("Instrument Serif", "instrumentserif/InstrumentSerif-Regular.ttf", "instrument-serif", "normal", {}, "latin"),
    ("Instrument Serif", "instrumentserif/InstrumentSerif-Italic.ttf", "instrument-serif-italic", "italic", {}, "latin"),
    ("Cormorant Garamond", "cormorantgaramond/CormorantGaramond[wght].ttf", "cormorant-garamond", "normal", {"wght": (400, 600)}, "latin"),
    ("Cormorant Garamond", "cormorantgaramond/CormorantGaramond-Italic[wght].ttf", "cormorant-garamond-italic", "italic", {"wght": (400, 600)}, "latin"),
    ("Bodoni Moda", "bodonimoda/BodoniModa[opsz,wght].ttf", "bodoni-moda", "normal", {"opsz": (6, 96), "wght": (400, 700)}, "latin"),
    ("Bodoni Moda", "bodonimoda/BodoniModa-Italic[opsz,wght].ttf", "bodoni-moda-italic", "italic", {"opsz": (6, 96), "wght": (400, 600)}, "latin"),
    ("Newsreader", "newsreader/Newsreader[opsz,wght].ttf", "newsreader", "normal", {"opsz": (6, 72), "wght": (300, 600)}, "latin"),
    ("Newsreader", "newsreader/Newsreader-Italic[opsz,wght].ttf", "newsreader-italic", "italic", {"opsz": (6, 72), "wght": (300, 500)}, "latin"),
    ("Geist", "geist/Geist[wght].ttf", "geist", "normal", {"wght": (300, 600)}, "latin"),
    ("Geist Mono", "geistmono/GeistMono[wght].ttf", "geist-mono", "normal", {"wght": (400, 500)}, "latin"),
    ("Noto Serif SC", "notoserifsc/NotoSerifSC[wght].ttf", "noto-serif-sc", "normal", {"wght": (400, 700)}, "all"),
    ("Noto Sans SC", "notosanssc/NotoSansSC[wght].ttf", "noto-sans-sc", "normal", {"wght": (400, 500)}, "all"),
]


def site_text() -> str:
    """Every character a published page can show: the pages, and the scripts that build markup."""
    text = []
    for path in sorted(glob.glob(os.path.join(PROTO, "**", "*"), recursive=True)):
        rel = os.path.relpath(path, PROTO).replace(os.sep, "/")
        if not rel.endswith((".html", ".js", ".css")) or rel.split("/")[0] in ("render", "tools"):
            continue
        if rel == "journal-sample.html":
            continue
        source = open(path, encoding="utf8").read()
        text.append(html.unescape(source))
        text.extend(chr(int(code, 16)) for code in re.findall(r"\\u([0-9a-fA-F]{4})", source))
    return "".join(text)


def source(path: str) -> str:
    local = os.path.join(CACHE, COMMIT[:12], path)
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        url = RAW + path.replace("[", "%5B").replace("]", "%5D")
        print("download", url, file=sys.stderr)
        urllib.request.urlretrieve(url, local + ".part")
        os.replace(local + ".part", local)
    return local


def ranges(codepoints) -> str:
    """unicode-range value for a set of code points"""
    out, run = [], None
    for cp in sorted(codepoints):
        if run and cp == run[1] + 1:
            run[1] = cp
        else:
            if run:
                out.append(run)
            run = [cp, cp]
    if run:
        out.append(run)
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in out)


def build_face(src: str, axes: dict, unicodes: set, dest: str) -> set:
    font = TTFont(src)
    options = subset.Options()
    options.layout_features = ["*"]  # keep ligatures, figures, small caps and the rest
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.drop_tables = []
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(unicodes))
    subsetter.subset(font)
    if axes:
        font = instancer.instantiateVariableFont(font, axes)
    font.flavor = "woff2"
    font.save(dest)
    return set(font.getBestCmap().keys())


def main() -> None:
    used = {ord(c) for c in site_text() if ord(c) >= 0x20}
    cjk = {cp for cp in used if cp >= CJK_START}
    os.makedirs(OUT, exist_ok=True)
    rules = [
        "/* Generated by tools/build-fonts.py: the site's own copies of its web fonts (SIL OFL 1.1,",
        "   see assets/fonts/OFL.txt), cut to the characters the pages use. Do not edit by hand. */",
    ]
    for family, path, name, style, axes, chars in FACES:
        wanted = (LATIN | {cp for cp in used if cp < CJK_START}) if chars == "latin" else (used | LATIN)
        dest = os.path.join(OUT, name + ".woff2")
        covered = build_face(source(path), axes, wanted, dest)
        if chars == "all":
            missing = cjk - covered
            if missing:
                print(f"{family} has no glyph for: {''.join(chr(c) for c in sorted(missing))}", file=sys.stderr)
        weight = axes.get("wght")
        weights = f"{weight[0]} {weight[1]}" if weight else "400"
        # the Chinese faces claim the whole CJK blocks, so a character added later without a rebuild
        # falls back to the reader's system font in place instead of skipping the face
        claimed = covered if chars == "latin" else {cp for cp in covered if cp < CJK_START} | CJK_BLOCKS
        rules.append(
            "@font-face { font-family: \"%s\"; font-style: %s; font-weight: %s; font-display: swap;\n"
            "  src: url(assets/fonts/%s.woff2) format(\"woff2\");\n  unicode-range: %s; }"
            % (family, style, weights, name, ranges(claimed))
        )
        print(f"{name}.woff2  {os.path.getsize(dest) // 1024} KiB", file=sys.stderr)
    with open(os.path.join(PROTO, "fonts.css"), "w", encoding="utf8") as handle:
        handle.write("\n".join(rules) + "\n")
    # the Chinese characters the faces cover: tests/spectrum-site.test.ts checks every page against it
    with open(os.path.join(OUT, "cjk-coverage.txt"), "w", encoding="utf8") as handle:
        handle.write("".join(chr(c) for c in sorted(cjk)) + "\n")
    licences = []
    for family, path, *_ in FACES:
        folder = path.split("/")[0]
        if any(folder == entry[0] for entry in licences):
            continue
        with open(source(folder + "/OFL.txt"), encoding="utf8") as handle:
            licences.append((folder, family, handle.read().strip()))
    with open(os.path.join(OUT, "OFL.txt"), "w", encoding="utf8") as handle:
        handle.write("\n\n".join(f"===== {family} =====\n\n{text}" for _, family, text in licences) + "\n")


if __name__ == "__main__":
    main()
