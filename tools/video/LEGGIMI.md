# Video di presentazione (motion graphic)

- `comp.html`: la composizione animata (GSAP). Si apre con `?fmt=16` (1920×1080) o `?fmt=45` (1080×1350).
- `render.js`: la rende fotogramma per fotogramma con Microsoft Edge (puppeteer-core).

Preparazione: `npm install` in questa cartella; copiare i font Selawik e mettere in `frames/<scena>/` i fotogrammi
estratti dalle registrazioni dell'app (vedi `COUNT` e `SCENES` in `comp.html`).

Rendering: `node render.js 16 out16`, poi unire i fotogrammi e la musica con ffmpeg.
Musica usata per Filo: «Chill (Loopable)» di Pro Sensory (Alex McCulloch), OpenGameArt, licenza CC0.

## Nocchiero (`nocchiero/`)
- `scenes.json`: per ogni scena la ripresa di partenza, i tagli `[inizio, fine, velocità]` e la durata voluta.
- `extract.js`: estrae i fotogrammi delle scene in `frames/<scena>/` e scrive `counts.js` (le riprese stanno fuori dal repository).
- `comp.html` + `render.js`: come per Filo (`node render.js 16 out16`, `node render.js 45 out45`), palette e logo della vetrina Nocchiero.
- Durante le riprese della plancia il selettore del cliente (solo per l'amministratore) e i dati personali reali sono nascosti.
- Musica usata per Nocchiero: «cruise» di SpringySpringo, OpenGameArt (https://opengameart.org/content/cruise-0), licenza CC0; rallentata del 2% (atempo 0,981) perché il suo finale coincida con la chiusura del video.

## Family Hub (`familyhub/`)
- Riprese tutte su telefono (390×844) da un'istanza **locale e dimostrativa** dell'app: nessun dato reale della famiglia.
  - `demo/server.mjs` avvia l'app (repository `family-hub`) con un fornitore bancario e un consulente simulati: conti, movimenti e report sono inventati, le schermate sono quelle vere.
  - `demo/seed.mjs` crea la famiglia Bianchi (Giulia e Marco) con entrate, spese, scadenze, obiettivi, spesa, menu, rifiuti e lavagna; le password di prova generate restano in `demo/credenziali.json`, fuori dal repository.
- `extract.js`: velocità "intelligente": scorrimenti e interazioni quasi a velocità reale, pause tenute un attimo e poi accelerate (`move`, `keep`, `hold` in `scenes.json`).
- `comp.html` + `render.js`: come per Nocchiero (`node render.js 16 out16`, `node render.js 45 out45`), con palette, logo e caratteri (Inter, Fraunces) della vetrina Family Hub.
- Musica: «Happy Clappy Loop» di OwlishMedia, OpenGameArt (https://opengameart.org/content/happy-clappy-loop), licenza CC0; ripetuta per tutta la durata, con dissolvenza finale.
