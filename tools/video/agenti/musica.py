"""Musica originale per i video degli agenti, generata da zero (nessun campione, nessuna licenza da citare).

Pad morbido, arpeggio a pizzico, basso e una ritmica leggera che entra dopo l'apertura e lascia
spazio alla chiusura. Ogni agente ha la sua variante (tonalità, tempo, giro di accordi).

Uso: python agenti/musica.py <agente> <durata-in-secondi> <uscita.wav>
"""
import sys
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from scipy.io import wavfile

SR = 44100
VARIANTI = {
    # bpm, nota base (MIDI), giro di accordi (gradi in semitoni dalla base: triadi minori/maggiori)
    'vedetta':  dict(bpm=100, base=57, giro=[(0, 'm'), (-4, 'M'), (3, 'M'), (-2, 'M')], seme=7),    # La minore: Am F C G
    'quadra':   dict(bpm=104, base=60, giro=[(0, 'M'), (-3, 'm'), (5, 'M'), (7, 'M')], seme=11),   # Do maggiore: C Am F G
    'sportello': dict(bpm=96, base=62, giro=[(0, 'M'), (7, 'M'), (-3, 'm'), (5, 'M')], seme=23),   # Re maggiore: D A Bm G
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x, f, ordine=2):
    b, a = butter(ordine, min(f, SR / 2 - 100) / (SR / 2), 'low')
    return lfilter(b, a, x)


def highpass(x, f):
    b, a = butter(2, f / (SR / 2), 'high')
    return lfilter(b, a, x)


def inviluppo(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(1, min(na, n)); e[:na] = np.linspace(0, 1, na)
    if na < n:
        nd = max(1, min(nd, n - na)); e[na:na + nd] = np.linspace(1, s, nd)
    nr = max(1, min(nr, n)); e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, n, fase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + fase) % 1.0) - 1


def pad(note, n, rng):
    x = np.zeros(n)
    for m in note:
        for det in (-0.09, 0.0, 0.11):
            x += saw(hz(m + det), n, rng.random()) * 0.33
    x = lowpass(x, 1400)
    return x * inviluppo(n, 0.9, 0.5, 0.85, 1.2)


def pizzico(m, n):
    t = np.arange(n) / SR
    f = hz(m)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t))
    return x * np.exp(-t * 7.5) * inviluppo(n, 0.004, 0.05, 1, 0.05)


def basso(m, n):
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(m) * t) + 0.25 * np.sin(2 * np.pi * 2 * hz(m) * t)
    return x * inviluppo(n, 0.01, 0.2, 0.7, 0.12)


def cassa(n):
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def charleston(n, rng):
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * 60)


def triade(radice, tipo):
    return [radice, radice + (3 if tipo == 'm' else 4), radice + 7]


def componi(agente, durata):
    v = VARIANTI[agente]
    rng = np.random.default_rng(v['seme'])
    beat = 60 / v['bpm']
    battuta = beat * 4
    N = int((durata + 3) * SR)
    L = {k: np.zeros(N) for k in ('pad', 'arp', 'basso', 'cassa', 'hat')}

    def metti(traccia, inizio, x):
        i = int(inizio * SR)
        if i >= N:
            return
        j = min(N, i + len(x))
        L[traccia][i:j] += x[:j - i]

    ingresso_ritmo = battuta * 2.4        # dopo il logo e le tre parole
    fine_ritmo = durata - 6.5             # la chiusura resta sospesa
    nb = int(np.ceil(durata / battuta))
    for b in range(nb):
        t0 = b * battuta
        rad, tipo = v['giro'][b % len(v['giro'])]
        acc = triade(v['base'] + rad, tipo)
        metti('pad', t0, pad(acc + [acc[0] + 12], int(battuta * 1.15 * SR), rng))
        metti('basso', t0, basso(acc[0] - 24, int(beat * 1.8 * SR)))
        metti('basso', t0 + beat * 2.5, basso(acc[0] - 24, int(beat * 1.2 * SR)))
        # Arpeggio in sedicesimi a pizzico, con un disegno che cambia ogni due battute
        disegno = [0, 2, 1, 3, 2, 1, 3, 2] if b % 2 == 0 else [0, 1, 2, 3, 1, 2, 3, 1]
        scala = acc + [acc[0] + 12]
        for k in range(8):
            metti('arp', t0 + k * beat / 2, pizzico(scala[disegno[k]] + 12, int(beat * 0.9 * SR)) * (0.9 if k % 2 == 0 else 0.6))
        if ingresso_ritmo <= t0 < fine_ritmo:
            for k in range(4):
                metti('cassa', t0 + k * beat, cassa(int(0.45 * SR)))
                metti('hat', t0 + k * beat + beat / 2, charleston(int(0.08 * SR), rng))

    mix = (L['pad'] * 0.16 + L['arp'] * 0.11 + L['basso'] * 0.20 + L['cassa'] * 0.42 + L['hat'] * 0.05)
    # Riverbero: risposta all'impulso di rumore che decade
    ir_n = int(2.6 * SR)
    ir = lowpass(rng.standard_normal(ir_n), 5000) * np.exp(-np.arange(ir_n) / SR * 2.6)
    ir /= np.sqrt(np.sum(ir ** 2))
    verb = fftconvolve(L['pad'] * 0.16 + L['arp'] * 0.11, ir)[:N]
    sx = mix + verb * 0.35
    dx = mix + np.roll(verb, int(0.013 * SR)) * 0.35
    st = np.stack([sx, dx], axis=1)[: int(durata * SR)]
    # Entrata e uscita morbide
    fi, fo = int(0.8 * SR), int(4.5 * SR)
    st[:fi] *= np.linspace(0, 1, fi)[:, None]
    st[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.6
    st = np.tanh(st * 1.4) / np.tanh(1.4)
    st *= 0.89 / np.max(np.abs(st))
    return st


if __name__ == '__main__':
    agente, durata, uscita = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    wavfile.write(uscita, SR, (componi(agente, durata) * 32767).astype(np.int16))
    print(f'{uscita}: {durata:.1f} s')
