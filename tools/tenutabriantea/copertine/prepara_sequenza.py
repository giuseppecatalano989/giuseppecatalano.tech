#!/usr/bin/env python3
"""Prepara la copertina della home (motore "sequenza", js/cover-worker.js) da un video.

Dal video produce, in tenutabriantea/video/copertina/:
- seq.h264 + seq.json        computer: 1600x900
- seq-m.h264 + seq-m.json    schermi piccoli in orizzontale e flusso leggero dei computer: 960x540
- seq-v.h264 + seq-v.json    telefoni in verticale: ritaglio centrale 608x1080
- m_####.webp                gli stessi fotogrammi in WebP 960x540, per i browser senza WebCodecs
- poster.webp, poster-m.webp il primo fotogramma (1920 e 960 px), mostrato subito

I flussi sono H.264 Annex B con un fotogramma chiave ogni GOP fotogrammi, niente B-frame e le
intestazioni (SPS/PPS) ripetute a ogni chiave: il worker scarica e decodifica un gruppo alla volta.
Il JSON elenca la posizione in byte di ogni fotogramma (offsets) e i fotogrammi chiave (keys).

Uso: python3 prepara_sequenza.py video.mp4
Dopo: aggiornare data-count e aumentare ?v= in index.html (vedi il commento sulla copertina).
"""
import json
import subprocess
import sys
from pathlib import Path

DEST = Path(__file__).resolve().parents[3] / "tenutabriantea" / "video" / "copertina"
GOP = 6
VARIANTI = [
    ("seq", "scale=1600:900:flags=lanczos", 23, "4.0"),
    ("seq-m", "scale=960:540:flags=lanczos", 25, "3.1"),
    ("seq-v", "crop=608:1080:(iw-608)/2:0", 24, "4.0"),
]


def codifica(src, nome, filtro, crf, livello):
    out = DEST / f"{nome}.h264"
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf", f"{filtro},format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-level:v", livello, "-preset", "veryslow", "-crf", str(crf),
        "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0", "-bf", "0",
        "-x264-params", "repeat-headers=1:aud=1", "-f", "h264", str(out)], check=True)
    b = out.read_bytes()
    # Ogni fotogramma comincia con un delimitatore (NAL 9)
    offsets, i = [], 0
    while True:
        j = b.find(b"\x00\x00\x00\x01\x09", i)
        if j < 0:
            break
        offsets.append(j)
        i = j + 5
    count = len(offsets)
    offsets.append(len(b))
    sps = b.find(b"\x00\x00\x00\x01\x67")
    codec = "avc1." + b[sps + 5:sps + 8].hex()
    w, h = map(int, subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip().split(","))
    info = {"codec": codec, "count": count, "offsets": offsets, "keys": list(range(0, count, GOP)),
            "width": w, "height": h, "gop": GOP, "fps": 24, "crf": crf}
    (DEST / f"{nome}.json").write_text(json.dumps(info, separators=(",", ":")))
    print(f"{nome}: {count} fotogrammi, {w}x{h}, {codec}, {len(b) / 1e6:.1f} MB")
    return count


def main():
    src = sys.argv[1]
    counts = {codifica(src, *v) for v in VARIANTI}
    assert len(counts) == 1, counts
    for vecchio in DEST.glob("m_*.webp"):
        vecchio.unlink()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=960:540:flags=lanczos",
                    "-c:v", "libwebp", "-quality", "78", "-start_number", "1",
                    str(DEST / "m_%04d.webp")], check=True)
    for nome, w in (("poster", 1920), ("poster-m", 960)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-frames:v", "1",
                        "-vf", f"scale={w}:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "82",
                        str(DEST / f"{nome}.webp")], check=True)
    print(f"Fatto: {counts.pop()} fotogrammi. Aggiornare data-count e ?v= in index.html.")


if __name__ == "__main__":
    main()
