#!/usr/bin/env python3
"""Rallenta l'inizio di una clip senza toccare il resto.

Parte da una versione della clip interpolata a fps alto (es. 96 fps con ffmpeg minterpolate) e
ne preleva i fotogrammi a velocità variabile: all'inizio la velocità è VELOCITA_INIZIO volte quella
originale e risale con una curva morbida fino a 1 in RAMPA secondi; da lì la clip resta identica.

Uso: python3 rallenta_inizio.py clip_96fps.mp4 fps_sorgente uscita.mp4 [velocita_inizio] [rampa_s]
"""
import subprocess
import sys

FPS_OUT = 24


def main():
    src, fps_src, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    v0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.4
    rampa = float(sys.argv[5]) if len(sys.argv) > 5 else 3.0
    n = int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                            "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", src],
                           capture_output=True, text=True).stdout.strip())
    durata_src = n / fps_src
    # Integra la velocità: per ogni fotogramma d'uscita, il tempo corrispondente nella sorgente
    scelti, s, t = [], 0.0, 0.0
    while s < durata_src - 1 / fps_src:
        scelti.append(min(n - 1.0, s * fps_src))
        u = min(1.0, t / rampa)
        v = v0 + (1 - v0) * u * u * (3 - 2 * u)
        s += v / FPS_OUT
        t += 1 / FPS_OUT
    # I fotogrammi scelti sono in ordine crescente: si legge la sorgente una volta sola
    w, h = 1920, 1080
    leggi = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo",
                              "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-"], stdout=subprocess.PIPE)
    scrivi = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                               "-s", f"{w}x{h}", "-r", str(FPS_OUT), "-i", "-", "-an",
                               "-c:v", "libx264", "-crf", "16", "-preset", "slow",
                               "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                              stdin=subprocess.PIPE)
    # Posizioni frazionarie: si fondono i due fotogrammi vicini, così il passo resta regolare
    import numpy as np
    prec = corr = None
    letti = -1
    for pos in scelti:
        while letti < int(pos) + 1 and letti < n - 1:
            b = leggi.stdout.read(w * h * 3)
            if len(b) < w * h * 3:
                break
            prec, corr = corr, np.frombuffer(b, np.uint8).reshape(h, w, 3)
            letti += 1
        i = int(pos)
        frac = pos - i
        a_ = prec if letti == i + 1 else corr
        b_ = corr
        if a_ is None or frac < 1e-3 or letti == i:
            fr = (corr if letti == i else a_)
        else:
            fr = (a_.astype(np.float32) * (1 - frac) + b_.astype(np.float32) * frac + 0.5).astype(np.uint8)
        scrivi.stdin.write(np.ascontiguousarray(fr).tobytes())
    leggi.stdout.close()
    scrivi.stdin.close()
    scrivi.wait()
    print(f"{len(scelti)} fotogrammi ({len(scelti) / FPS_OUT:.1f} s) da {durata_src:.1f} s di sorgente")


if __name__ == "__main__":
    main()
