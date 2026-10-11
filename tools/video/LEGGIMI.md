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
- Musica usata per Nocchiero: «cruise» di SpringySpringo, OpenGameArt (https://opengameart.org/content/cruise-0), licenza CC0; sfumata negli ultimi 4 secondi.
