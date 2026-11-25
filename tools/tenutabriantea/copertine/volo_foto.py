#!/usr/bin/env python3
"""Volo della home costruito con le foto fisse (niente generazione video, niente sfarfallio).

Ogni foto si avvicina lentamente verso il punto in cui "entra" la foto successiva; nei tratti di
sovrapposizione la foto in uscita accelera lo zoom e sfuma nella successiva (zoom-dissolvenza).
Lo zoom è interpolato in scala logaritmica, così la velocità percepita è costante; il primo tratto
parte da fermo e l'ultimo si posa sull'inquadratura finale.

Uso: python3 volo_foto.py cartella_foto uscita.mp4 [--larghezza 1920] [--fps 24]
La cartella deve contenere i file elencati in INQUADRATURE.
"""
import argparse
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

# file, inizio, fine (secondi), vista iniziale e finale: (zoom, centro x, centro y) in pixel della foto
INQUADRATURE = [
    ("home-K1.jpg",                0.0,  5.0, (1.00, 1000, 558), (1.35, 1005, 820)),
    ("riferimento.jpg",            4.5,  9.5, (1.00, 1000, 558), (1.35, 1050, 600)),
    ("home-K3-sera.jpg",           9.0, 14.0, (1.00, 1000, 558), (1.40, 1000, 545)),
    ("home-K4-sera-corretto.png", 13.5, 18.5, (1.00, 1000, 560), (1.40, 1000, 545)),
    ("home-K5.jpg",               18.0, 23.5, (1.00, 1000, 558), (1.08, 1060, 560)),
]


def liscio(u):
    return u * u * (3 - 2 * u)


def vista(inq, t, n, totale):
    nome, t0, t1, (z0, x0, y0), (z1, x1, y1) = inq
    u = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    if n == 0:                       # il primo parte da fermo
        u = u ** 1.6
    elif n == totale - 1:            # l'ultimo si posa
        u = 1 - (1 - u) ** 2.2
    z = math.exp(math.log(z0) + u * (math.log(z1) - math.log(z0)))
    return z, x0 + u * (x1 - x0), y0 + u * (y1 - y0)


def ritaglio(img, z, cx, cy, w, h):
    W, H = img.size
    ch = min(W / z * h / w, H / z)    # la foto può essere un filo più larga o più alta di 16:9
    cw = ch * w / h
    l = min(max(cx - cw / 2, 0), W - cw)
    t = min(max(cy - ch / 2, 0), H - ch)
    return img.resize((w, h), Image.LANCZOS, box=(l, t, l + cw, t + ch))


def main():
    a = argparse.ArgumentParser()
    a.add_argument("cartella")
    a.add_argument("uscita")
    a.add_argument("--larghezza", type=int, default=1920)
    a.add_argument("--fps", type=int, default=24)
    o = a.parse_args()
    w = o.larghezza
    h = round(w * 9 / 16 / 2) * 2
    foto = [Image.open(Path(o.cartella) / i[0]).convert("RGB") for i in INQUADRATURE]
    durata = INQUADRATURE[-1][2]
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", str(o.fps), "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", o.uscita],
        stdin=subprocess.PIPE)
    n_tot = len(INQUADRATURE)
    for f in range(round(durata * o.fps)):
        t = f / o.fps
        attivi = [(n, i) for n, i in enumerate(INQUADRATURE) if i[1] <= t <= i[2]]
        out = None
        for n, inq in attivi:
            img = np.asarray(ritaglio(foto[n], *vista(inq, t, n, n_tot), w, h), np.float32)
            if out is None:
                out = img
            else:                     # sovrapposizione: la nuova foto entra in dissolvenza
                t0 = inq[1]
                fine_prec = INQUADRATURE[n - 1][2]
                alfa = liscio(min(1.0, (t - t0) / (fine_prec - t0)))
                out = out * (1 - alfa) + img * alfa
        enc.stdin.write(np.clip(out + 0.5, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
