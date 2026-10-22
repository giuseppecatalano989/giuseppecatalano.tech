# Video di presentazione (motion graphic)

- `comp.html`: la composizione animata (GSAP). Si apre con `?fmt=16` (1920×1080) o `?fmt=45` (1080×1350).
- `render.js`: la rende fotogramma per fotogramma con Microsoft Edge (puppeteer-core).

Preparazione: `npm install` in questa cartella; copiare i font Selawik e mettere in `frames/<scena>/` i fotogrammi
estratti dalle registrazioni dell'app (vedi `COUNT` e `SCENES` in `comp.html`).

Rendering: `node render.js 16 out16`, poi unire i fotogrammi e la musica con ffmpeg.
Concept di Filo: "il filo che cuce". Un filo luminoso sottile, con l'ago in punta, attraversa lo schermo da sinistra a destra con curve ampie e regolari, sottolinea la seconda riga del titolo e passa dietro al telefono frontale; lettere che cadono al loro posto, etichette con il bordo a punti.
Musica usata per Filo: «Chill (Loopable)» di Pro Sensory (Alex McCulloch), OpenGameArt, licenza CC0.

## Nocchiero (`nocchiero/`)
- Concept "plancia": copertine a tendina, titoli che salgono nelle righe, telefono e plancia in prospettiva, rotta tratteggiata, contatori.
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
- `comp.html` + `render.js`: concept "porta del frigo", come nella vetrina. Biglietti e post-it attaccati con le calamite che si staccano a ogni scena, frasi scritte a mano (Caveat), lista con le spunte, numeri sul post-it, telefono dritto fissato con il nastro (`node render.js 16 out16`, `node render.js 45 out45`).
- Musica: «Happy Clappy Loop» di OwlishMedia, OpenGameArt (https://opengameart.org/content/happy-clappy-loop), licenza CC0; ripetuta per tutta la durata, con dissolvenza finale.

## Agenti (`agenti/`, `vedetta/`, …)
Gli agenti AI (codice in `tools/agenti`) hanno una pipeline comune, che funziona sia su Windows con Edge sia su Linux con Chromium
(variabili facoltative `BROWSER` e `FFMPEG`).
1. `node agenti/registra.js <agente>`: avvia l'agente in modalità demo, preme il pulsante, approva le azioni con un cursore visibile,
   scorre il report. Salva `captures/<agente>/ripresa.mp4` (fotogrammi presi da Chrome con il loro istante, quindi a tempi reali)
   e `marks.json` con il momento di ogni evento dell'agente.
2. `node agenti/extract.js <agente>`: taglia le scene secondo `<agente>/scenes.json`. I tagli si possono indicare con i segni della
   ripresa (es. `"risultato:calcola_impatto#2+1.9"`), così restano giusti anche se si rifà la ripresa.
3. `python agenti/musica.py <agente> <durata> <agente>/musica.wav`: musica originale generata da zero (nessuna licenza da citare).
   In alternativa si può usare un brano CC0, come per gli altri video.
4. `node agenti/render.js <agente> 16 out16` e `node agenti/render.js <agente> 45 out45`.
5. `node agenti/monta.js <agente> ../../<vetrina> [secondo-locandina]`: video finali e locandine nella cartella della vetrina.

### Vedetta (`vedetta/`)
- Concept "la vedetta": crepuscolo color petrolio, un fascio di luce che spazza lentamente la scena, cerchi di radar dietro la finestra,
  copertine a sipario che sale, zoom sul punto chiave di ogni scena (cascata dei ritardi, report, approvazioni).
- Dati del progetto dimostrativo inventati (Ottavia Logistica, Portale Clienti 2.0, PayBridge e le persone del team).

### Quadra (`quadra/`)
- Concept "il registro": carta a quadretti chiara, inchiostro blu notte, il tratto di evidenziatore giallo sotto la seconda riga dei titoli,
  copertine che scorrono come una passata di evidenziatore.
- Dati dimostrativi inventati (Lariana Componenti, i fornitori, gli IBAN).

### Sportello (`sportello/`)
- Concept "la conversazione": fondo glicine, fumetti che salgono lentamente sullo sfondo, copertine che si aprono a cerchio come un messaggio.
- Dati dimostrativi inventati (Casa Ortensia, i clienti, gli ordini).
