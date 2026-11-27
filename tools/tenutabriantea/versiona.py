#!/usr/bin/env python3
"""Aggiorna le versioni (?v=) di CSS e JS nelle pagine di Tenuta Briantea e del portfolio (radice).

CSS e JS sono serviti con una cache di un anno ("immutable", vedi vercel.json): il browser li
riscarica solo se cambia l'indirizzo. La versione è l'inizio dell'MD5 del file, quindi cambia
da sola a ogni modifica, purché si lanci questo script.

Uso (dalla radice del repository):
    npm run versioni              aggiorna le pagine
    npm run versioni -- --controlla   segnala le versioni vecchie senza modificare nulla (esce con 1)
"""
import hashlib
import re
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]
# (cartella, file versionati, pagine che li richiamano)
SITI = [
    (RADICE / "tenutabriantea", ["css/style.css", "js/main.js", "js/video-worker.js", "js/cover-worker.js"], "*.html"),
    (RADICE, ["styles.css", "script.js"], "index.html"),
]


def versione(percorso: Path) -> str:
    return hashlib.md5(percorso.read_bytes()).hexdigest()[:8]


def main() -> int:
    controlla = "--controlla" in sys.argv
    vecchie = []
    for sito, file, pagine in SITI:
        versioni = {f: versione(sito / f) for f in file}
        for pagina in sorted(sito.glob(pagine)):
            testo = pagina.read_text(encoding="utf-8")
            nuovo = testo
            for f, v in versioni.items():
                nuovo = re.sub(rf"((?<![\w/.-]){re.escape(f)}\?v=)[0-9a-f]{{8}}", rf"\g<1>{v}", nuovo)
            if nuovo != testo:
                vecchie.append(str(pagina.relative_to(RADICE)))
                if not controlla:
                    pagina.write_text(nuovo, encoding="utf-8")
    if controlla and vecchie:
        print("Versioni da aggiornare in: " + ", ".join(vecchie) + ". Lanciate: npm run versioni")
        return 1
    print(("Aggiornate: " + ", ".join(vecchie)) if vecchie else "Versioni già aggiornate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
