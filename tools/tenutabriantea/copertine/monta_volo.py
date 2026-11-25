#!/usr/bin/env python3
"""Monta le clip del volo della home in un unico video, senza salti di colore sulle giunzioni.

Ogni clip parte dall'ultimo fotogramma della precedente, ma nei primi 2-4 fotogrammi Veo lo
"ridipinge" con un'altra taratura: saturazione e tinta cambiano in 2-3 fotogrammi e i coppi
passano dal rosato al bruno, come se il tetto cambiasse colore. Qui, a ogni giunzione, si stima un
trasferimento di colore (Monge-Kantorovich: media e covarianza dei tre canali, quindi insensibile
al movimento della camera) dall'ultimo fotogramma prima del taglio al terzo dopo, stimato e
applicato solo sui pixel caldi (coppi, mattoni, intonaco: prato e cielo restano intatti); la clip
successiva viene riportata sui colori della precedente e la correzione si esaurisce in
DISSOLVENZA fotogrammi: il cambio di taratura diventa una deriva di 2 secondi.

Il video esce con le stesse etichette di colore delle clip di Veo (matrice BT.601, primari BT.709,
curva sRGB), così il browser non sposta i toni.

Uso: python3 monta_volo.py uscita.mp4 clip1.mp4 clip2.mp4 [clip3.mp4 ...]
"""
import subprocess
import sys

import numpy as np

W, H = 1920, 1080
DISSOLVENZA = 48          # fotogrammi (2 s a 24 fps) in cui la correzione si esaurisce
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def leggi(percorso, w=W, h=H):
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", percorso, "-vf", f"scale={w}:{h}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


def volo(clip, w=W, h=H):
    """(fotogramma, indice della clip). Dalla seconda clip si salta il primo fotogramma, che
    ripete l'ultimo della precedente."""
    for n, percorso in enumerate(clip):
        for i, fr in enumerate(leggi(percorso, w, h)):
            if n > 0 and i == 0:
                continue
            yield fr, n


def caldi(x):
    """Peso (0-1) dei pixel caldi: coppi, mattoni, intonaco ocra. Prato e cielo restano fuori."""
    return np.clip((x[:, 0] - x[:, 2] - 6) / 18, 0, 1)


def mkl(a, b):
    """Trasferimento di colore Monge-Kantorovich: matrice M tale che (x - mu_b) M + mu_a
    porta la distribuzione dei colori caldi di `b` (media e covarianza) su quella di `a`."""
    def stat(fr):
        x = fr[::2, ::2].reshape(-1, 3).astype(np.float64)
        x = x[caldi(x) > 0.5]
        return x.mean(0), np.cov(x.T) + np.eye(3) * 1e-3
    ma, ca = stat(a)
    mb, cb = stat(b)
    def radice(c):
        w, v = np.linalg.eigh(c)
        return v @ np.diag(np.sqrt(np.maximum(w, 1e-9))) @ v.T
    rb = radice(cb)
    irb = np.linalg.inv(rb)
    m = irb @ radice(rb @ ca @ rb) @ irb
    return mb, m.T, ma


def saturazione(fr):
    x = fr.astype(np.float32)
    mx, mn = x.max(2), x.min(2)
    y = x @ LUMA
    ok = (y > 25) & (y < 200)
    return float(((mx - mn) / (mx + 1e-3))[ok].mean())


def main():
    uscita, clip = sys.argv[1], sys.argv[2:]
    # 1. A ogni taglio: trasferimento di colore dall'ultimo fotogramma prima del taglio al
    #    terzo dopo (Veo ha finito di ridipingere), poi peso che si esaurisce in DISSOLVENZA
    fotogrammi = list(volo(clip, 480, 270))
    quale = np.array([n for _, n in fotogrammi])
    tagli = [int(np.argmax(quale == n)) for n in range(1, len(clip))]
    correzioni = {}
    for t in tagli:
        mb, m, ma = mkl(fotogrammi[t - 1][0], fotogrammi[t + 2][0])
        scarto = np.abs(m - np.eye(3)).max() + np.abs(ma - mb).max() / 255
        print(f"taglio al fotogramma {t}: scarto di colore {scarto:.3f}", flush=True)
        for i in range(t, min(len(fotogrammi), t + 3 + DISSOLVENZA)):
            u = max(0.0, (i - t - 2) / DISSOLVENZA)
            peso = 1 - u * u * (3 - 2 * u)
            correzioni[i] = (mb, m, ma, peso)
    del fotogrammi
    # 2. Correzione a piena risoluzione: la saturazione cambia, la luminanza no
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", "24", "-i", "-",
         "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p",
         "-colorspace", "smpte170m", "-color_primaries", "bt709",
         "-color_trc", "iec61966-2-1", "-color_range", "tv", uscita],
        stdin=subprocess.PIPE)
    for i, (fr, _) in enumerate(volo(clip)):
        if i in correzioni:
            mb, m, ma, peso = correzioni[i]
            x = fr.reshape(-1, 3).astype(np.float32)
            y = (x - mb.astype(np.float32)) @ m.astype(np.float32) + ma.astype(np.float32)
            x = x + (peso * caldi(x))[:, None] * (y - x)
            fr = np.clip(x + 0.5, 0, 255).astype(np.uint8).reshape(H, W, 3)
        enc.stdin.write(np.ascontiguousarray(fr).tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
