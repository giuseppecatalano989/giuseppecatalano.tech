# Tenuta Briantea · passaggio di consegne (26 novembre 2026)

Brief per riprendere il lavoro in una sessione nuova. Leggerlo insieme a `CLAUDE.md` (radice),
`tenutabriantea/DESIGN.md` e `tools/tenutabriantea/copertine/BRIEF.md`.

## 1. Il progetto in breve

- Repository `giuseppecatalano989/giuseppecatalano.tech`: portfolio statico (HTML, CSS, JS, senza build) pubblicato su Vercel. Produzione: https://giuseppecatalano.tech/tenutabriantea/
- Tenuta Briantea è un **sito dimostrativo**: resta `noindex`, prenotazioni e contatti non partono davvero (il form mostra la conferma, WhatsApp ha un numero finto). Non va trasformato in un sito vero.
- **Le otto pagine HTML sono i sorgenti.** `build.py` e `src/` non esistono più. Intestazione, menu, piè di pagina e barra di prenotazione sono ripetuti in ogni pagina: si modificano in tutte.
- Dopo ogni modifica a `css/style.css` o `js/*`: `npm run versioni` (aggiorna `?v=` con i primi 8 caratteri dell'MD5; CSS e JS hanno una cache di un anno). Un test lo verifica.
- Comandi: `npm run dev` (http://localhost:4173/), `npm test` (Playwright), `npm run versioni` (`-- --controlla` per la sola verifica).
- Ramo di lavoro: `claude/blissful-wright-2usflv`. Commit e push solo lì, salvo permesso esplicito. Nessun identificativo del modello nei commit.
- L'utente scrive in italiano; risposte e testi in italiano naturale.

## 2. Cosa è stato fatto

### Kit Qualità applicato
- `applica-kit.sh`: workflow `.github/workflows/qualita.yml` (gitleaks, semgrep, trivy, Playwright, Unlighthouse), `CLAUDE.md`, `.gitignore`, agenti Playwright in `.claude/agents`, `.mcp.json`.
- `package.json` con `@playwright/test@1.63.0` e `@axe-core/playwright`; `playwright.config.ts` (progetti desktop e mobile Pixel 7, server `npm run dev`).
- `tests/tenutabriantea.spec.ts`: 8 pagine (200, titolo, un solo h1, niente errori JS o 4xx), menu che si apre e si chiude con Esc (viewport 390x844), prenotazione completa e incompleta, versioni `?v=`. **24 test verdi.**
- `tests/accessibilita.spec.ts`: axe WCAG 2.2 AA su `/` e sulle 8 pagine. **Ancora rosso** (contrasti, `label-content-name-mismatch`, `button-name`, `scrollable-region-focusable`), quindi il controllo "Qualità" su GitHub è rosso.
- `tenutabriantea/DESIGN.md` ricavato con `/impeccable extract`: carta #F2ECE0, miele #B07D2A, miele chiaro #D3A24D, noce #2F2219, muschio #3E4530, inchiostro #2B241D e #6B5F50; Fraunces ed EB Garamond; cornici ad arco; `--ease: cubic-bezier(.2,.7,.2,1)`; incoerenze elencate.
- `.vercelignore` esclude i file di sviluppo (DESIGN.md, .impeccable/, test, package*.json, CLAUDE.md, .github/, .mcp.json…): in produzione rispondono 404, verificato.
- `tools/tenutabriantea/versiona.py` aggiorna le versioni di CSS e JS.
- Corretto un bug del menu in `js/main.js` (si riapriva nel callback rAF).

### Audit fatto con il kit (impeccable critique, seo-audit, vibe-check, obblighi-siti-italia, avoid-ai-design, improve-animations)
Problemi ancora aperti, in ordine indicativo:
1. accessibilità e contrasti (test rossi);
2. header di sicurezza in `vercel.json` (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy);
3. tipografia e dimensione delle etichette; tic da evitare: parola in corsivo miele su ogni titolo, maiuscoletto spaziato ovunque;
4. UX di Matrimoni e Prenota;
5. pagine legali: privacy e cookie puntano a `#`, dati aziendali segnaposto (va chiarito che è una demo);
6. SEO (resta noindex, ma metadati, dati strutturati e CLS);
7. pulizia dei token di movimento (durate e curve disperse);
8. immagini: srcset e AVIF;
9. ripiego quando il meteo del Lunario non risponde;
10. Google Fonts caricati da esterno.

### Copertina della home: FATTA e pubblicata
- PR [giuseppecatalano989/giuseppecatalano.tech#1](https://github.com/giuseppecatalano989/giuseppecatalano.tech/pull/1) unita in `main`.
- È **una sola clip Veo continua** (da `riferimento` fino in camera), generata dall'utente in Flow; l'inizio l'ho rallentato io con `rallenta_inizio.py` (interpolazione a 96 fps, velocità da 0,35 a 1 in 3 s, fusione dei fotogrammi frazionari).
- 196 fotogrammi, 8,2 s. `index.html`: `data-seq="video/copertina/seq?v=4"`, `data-scrub-frames="video/copertina/m_####.webp?v=9"`, `data-count="196"`, poster `?v=2`, didascalie 0–0,2 / 0,22–0,5 / 0,84–1,01. `.cover { height: 400vh; }`.
- Peso dopo uno scorrimento completo: desktop 6,1 MB (prima 27), telefono 2,1 MB (prima 8,5).
- Difetto noto e accettato dall'utente: l'architettura deriva un po' nella clip (l'ala est guadagna archi, il balcone cambia).
- Motore: `js/cover-worker.js` (OffscreenCanvas + WebCodecs), flussi H.264 Annex B con GOP 6, tre varianti (seq 1600x900, seq-m 960x540, seq-v 608x1080), fotogrammi WebP di riserva. Si rigenera con `python3 tools/tenutabriantea/copertine/prepara_sequenza.py <video>`, poi si aggiornano `data-count` e `?v=` in `index.html`.

### Lezioni sulle clip (non ripetere gli errori)
- **Mai clip unite**: alle giunzioni Veo cambia tinta e colore dei coppi, nessuna correzione (guadagno, istogramma, deflicker, trasferimento MKL in `monta_volo.py`) l'ha resa invisibile. L'utente le ha rifiutate. **Una sola clip per copertina.**
- Veo accelera verso il fotogramma finale; Quality non è risultato migliore di Fast sulle misure di sfarfallio (4,00 contro 3,73).
- Flow genera a 720p; l'upscale a 1080p è gratuito.
- Script superati ma conservati: `monta_volo.py` (clip unite), `volo_foto.py` (volo con zoom sulle foto fisse).

## 3. Lavoro in corso: le copertine delle pagine interne

Procedura completa e tabella dei prompt in `tools/tenutabriantea/copertine/BRIEF.md`, **sezione 4** (commit 9a18242, sul ramo ma **non ancora in `main`**: servirà una nuova PR).

Per ogni pagina:
1. **Foto** in Flow, modalità immagini (Nano Banana), 16:9, con l'allegato indicato. Prompt che inizia con `Same estate as the reference image, identical architecture.` e finisce con la riga di stile `Shot on a full-frame camera, 35 mm, natural light only, fine sensor noise, muted natural colours, weathered and lived-in, not a 3D render, no HDR, no glow, no people, no text, no watermark.`
2. **Clip**: Video → Fotogrammi, Veo 3.1 Fast, 16:9, 8 s, x2, **Inizio = Fine = la stessa foto** (loop senza stacco, la foto fa da poster). Prompt che inizia con `Locked-off tripod shot, the camera does not move at all. The first and the last frame are identical to the reference image. The architecture, furniture and objects never change; nothing appears or disappears; no people, no animals.` più il movimento della tabella.

| Pagina | Allegato | Movimento |
|---|---|---|
| I · Tenuta (`tenuta.html`) | `riferimento.png` | ombre di nuvole e foglie |
| II · Residenze | `home-K5.png` | candela e lampada |
| III · Osteria | `home-K5.png` | fuoco e candele |
| IV · Piscina | `riferimento.png` | increspature e prato |
| V · Matrimoni | `home-K3-sera.png` | candele e lucine |
| VI · Prenota | `home-K3-sera.png` | solo foto, nessuna clip |
| VII · Contatti | `riferimento.png` | nebbia |

**Prossimo passo: Tenuta.** Aspettiamo 2–3 foto candidate dall'utente, scegliamo insieme (stessa architettura e orientamento di `riferimento`, nessun segno di AI, risoluzione), poi l'utente fa la clip, la controllo con la lista di scarto (BRIEF sezione 5) e la monto:
- loop `tenutabriantea/video/loop/<pagina>-1280.mp4` e `-1920.mp4`, attributo `data-loop="video/loop/<pagina>?v=N"` (seguire il formato già presente nella pagina);
- poster `tenutabriantea/img/copertine/<pagina>-1200.webp` e `-2400.webp`;
- aumentare `?v=`, `npm test`, commit sul ramo.

Poi Residenze, Osteria, Piscina, Matrimoni, Prenota, Contatti, una alla volta.

## 4. Come lavorare con l'utente

- L'utente genera foto e video da solo in Google Flow (abbonamento Gemini Pro). Io guido, controllo ogni candidato e scelgo.
- **Nomi dei file esatti, sempre.** Non vedo i nomi originali dei caricamenti: indico le immagini per posizione ("la seconda") e chiedo all'utente di rinominare i candidati e scrivere i nomi nel messaggio.
- I nomi degli allegati sono quelli che l'utente ha in Flow (`riferimento.png`, `home-K5.png`, `home-K3-sera.png`).
- Analisi delle clip: fotogrammi estratti con ffmpeg e guardati, metrica di sfarfallio a flusso ottico (OpenCV Farneback, `pip install opencv-python-headless`), al rallentatore.
- La mail dell'utente è privata: non va mai inviata a servizi esterni.
- In sospeso, facoltativo: l'utente aveva chiesto di analizzare il video YouTube "Antigravity + Claude Code = Sito Animato da 3.000€" (https://www.youtube.com/watch?v=SN-tCrgCEII); ho potuto leggere solo il titolo e ho chiesto descrizione o link della demo. Nessuna risposta.

## 5. Attenzione: i file sorgente non sono nel repository

`tools/tenutabriantea/copertine/sorgenti/` è in `.gitignore` e il contenitore della vecchia sessione verrà cancellato. Nella sessione nuova **non ci saranno** `riferimento.jpg`, `home-K1.jpg`, `home-K3-sera.jpg`, `home-K4-sera-corretto.png`, `home-K5.jpg`, le clip della home e `volo-unico*.mp4`.
Per le copertine interne servono solo per confronto: se occorre, chiedere all'utente di ricaricare `riferimento.png`, `home-K3-sera.png` e `home-K5.png`. La home pubblicata non ne ha bisogno (i file del sito sono nel repository).
