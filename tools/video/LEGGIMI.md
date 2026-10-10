# Video di presentazione (motion graphic)

- `comp.html`: la composizione animata (GSAP). Si apre con `?fmt=16` (1920×1080) o `?fmt=45` (1080×1350).
- `render.js`: la rende fotogramma per fotogramma con Microsoft Edge (puppeteer-core).

Preparazione: `npm install` in questa cartella; copiare i font Selawik e mettere in `frames/<scena>/` i fotogrammi
estratti dalle registrazioni dell'app (vedi `COUNT` e `SCENES` in `comp.html`).

Rendering: `node render.js 16 out16`, poi unire i fotogrammi e la musica con ffmpeg.
Musica usata per Filo: «Chill (Loopable)» di Pro Sensory (Alex McCulloch), OpenGameArt, licenza CC0.
