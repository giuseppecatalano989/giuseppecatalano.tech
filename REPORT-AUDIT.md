# Report audit: giuseppecatalano.tech

Data: 27 novembre 2026 · Ambito: portfolio nella radice (`index.html`, `styles.css`, `script.js`, `vercel.json`).
I progetti dimostrativi sono esaminati solo dove toccano il portfolio, cioè i test e i link.

## Esito delle correzioni (27 novembre 2026)

**Corretti tutti i 51 problemi.** Il tema scuro resta quello di partenza; il chiaro si sceglie con il selettore
"Scuro / Chiaro" e viene ricordato. Il sito non segue l'impostazione del sistema, per scelta.

| Verifica | Prima | Dopo |
|---|---|---|
| `npm test` (desktop + Pixel 7) | 18 falliti, 26 superati su 44 | **67 superati, 3 saltati di proposito, 0 falliti su 70** |
| axe-core WCAG 2.2 AA, home | 2 violazioni | 0 |
| axe-core WCAG 2.2 AA, 8 pagine di Tenuta Briantea | violazioni su tutte | 0, su desktop e su telefono |
| Scorrimento orizzontale (1440 px, Pixel 7), due temi | presente | assente |
| Richieste a terze parti | Google Fonts (2 domini) | nessuna: font in `assets/fonts/` |
| Prima visualizzazione (FCP, locale) | 176 ms | 164 ms · 16 richieste · 296 KB in tutto |

I 3 test saltati girano solo su desktop: Tab, collegamenti interni e pulsante dell'animazione.
Sul telefono non aggiungono nulla.

### Cosa è cambiato

- **Home (`index.html`, `styles.css`, `script.js`):** riscritte.
  - Sezioni: Inizio, Cosa faccio, Come lavoro, Progetti, Chi sono, Contatti.
  - Il menu segna la sezione in lettura (`aria-current`).
  - Collegamento "Salta al contenuto".
  - Filtri dei progetti con conteggio annunciato e scelta ricordata nell'indirizzo (`?f=`).
  - Anteprime dei progetti anche con la tastiera.
  - Pulsante per fermare le animazioni degli schemi. Le animazioni si fermano da sole fuori dallo schermo e spariscono con "riduci movimento".
- **Font:** ospitati sul sito (Archivo, Instrument Serif, JetBrains Mono) e precaricati. Non partono più richieste verso Google, il che risolve anche il punto GDPR.
- **Cache:** `styles.css` e `script.js` hanno una cache di un anno e un `?v=` che cambia con il contenuto.
  - `npm run versioni` aggiorna anche la home (`tools/tenutabriantea/versiona.py`).
  - In `vercel.json` sono aggiunte le intestazioni per `styles.css`, `script.js` e `assets/fonts/`.
  - `REPORT-AUDIT.md` è escluso dalla pubblicazione (`.vercelignore`).
- **Tenuta Briantea:**
  - Nuovo token `--honey-ink: #835A17`, per i testi e i pulsanti miele su carta. Contrasto da 3,07 a 5,19:1. Il miele resta l'unico colore d'accento.
  - Testi della sezione "trio" leggibili sulle fasce scure.
  - Velo scuro dietro l'intestazione trasparente, che prima scompariva sul cielo chiaro delle foto.
  - Etichette di logo e menu corrette nelle 8 pagine.
  - Il calendario "Un anno in tenuta" si scorre anche con la tastiera.
- **Test:** nuovo `tests/portfolio.spec.ts`, 14 test, che sostituisce `seed.spec.ts` (era vuoto). Copre:
  - tema di partenza e persistenza;
  - menu e skip link;
  - filtri e `?f=`;
  - collegamenti 200;
  - pulsante dell'animazione;
  - "riduci movimento";
  - scorrimento orizzontale.

Il resto del report descrive lo stato **prima** delle correzioni e resta come riferimento.

---

## Riepilogo (stato prima delle correzioni)

| Gravità | Numero |
|---|---|
| 🔴 bloccante | 1 |
| 🟠 importante | 16 |
| 🟡 miglioria | 34 |
| **Totale** | **51** |

### Come è stato verificato

- **Test:** `npm test` (Playwright, desktop + Pixel 7, axe-core). **18 falliti, 26 superati su 44.**
  Tutti i fallimenti riguardano l'accessibilità: 2 sulla home, 16 su Tenuta Briantea.
- **Prove reali in Chromium**, sulle 5 tavole e a tre larghezze: 1440 px, Pixel 7 e 320 px.
  - Console e rete pulite: nessun errore e nessuna risposta ≥ 400.
  - Funzionano: tutti gli 8 link ai progetti (200), i filtri, il cambio di tema, il tasto Indietro e gli hash sconosciuti.
  - Screenshot dei due temi e di entrambe le impostazioni di movimento.
  - Rapporti di contrasto calcolati sui token.
  - Ordine del Tab, focus e albero di accessibilità.
- **Prestazioni locali:**
  - FCP 176 ms, DCL 160 ms.
  - Pesi: HTML 30 KB, `styles.css` 36 KB, `script.js` 8 KB.
  - Terze parti: solo `fonts.googleapis.com` e `fonts.gstatic.com`.
- **Limiti:**
  - La critica di design (impeccable) è stata svolta in un solo contesto, senza sotto-agenti.
  - La parte legale è un elenco di punti di attenzione, **non è una consulenza legale**.

### Punti di forza

- **Un'idea riconoscibile:** la tavola tecnica, con cartiglio, quote e "anatomia" del prodotto. È coerente dall'inizio alla fine.
- **Un sito leggero e veloce:** nessun framework, nessun build e nessun errore in console.
- **Il metodo è spiegato:** il ciclo idea → specifiche → costruzione → collaudo chiarisce il ruolo di Giuseppe.
- **Progetti apribili:** 8 progetti, tutti raggiungibili, con filtri per tipo.

---

## 1. Codice

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟠 | `index.html:515` + `tenutabriantea/` | 18 test su 44 sono rossi. Sulla home falla `label-content-name-mismatch` su `#theme`. Su Tenuta falliscono i contrasti del miele (vedi §7) e `.hd-mark` (`tenutabriantea/index.html:46`), con la stessa regola. | Correggere le cause elencate in §7 e tenere la suite verde prima di ogni deploy. |
| 🟡 | `tests/seed.spec.ts` | Nessun test funzionale della home: tavole, filtri, tema e focus. `seed.spec.ts` è vuoto. | Aggiungere `tests/portfolio.spec.ts` con navigazione tra le tavole, filtri, tema, tasto Indietro e assenza di overflow orizzontale. |
| 🟡 | `styles.css:93` e `:111` | `.topbar` è dichiarata due volte. La seconda sovrascrive `justify-content` e `padding`. | Unire le due regole. |
| 🟡 | `styles.css:64` | `.sr-only` non è usata da nessun elemento. | Usarla per il link "Salta al contenuto" e per la regione dei filtri (§7), oppure rimuoverla. |
| 🟡 | `styles.css:166` | `.btn` dichiara una transizione su `transform`, ma nessuno stato applica `transform`. | Togliere `transform` dalla transizione oppure aggiungere un leggero `:active { transform: translateY(1px) }`. |
| 🟡 | `styles.css:30-35`, `script.js:9-11`, `script.js:25` | Il ramo `prefers-color-scheme` è codice morto: lo script in `<head>` imposta sempre `data-theme`, quindi la media query e il listener non agiscono mai. | Decidere tra due strade: rispettare la preferenza del sistema (vedi UX) oppure rimuovere i tre blocchi. |
| 🟡 | `script.js:97` | `allineaElenco` è agganciata a `resize` senza limitazione e misura il DOM a ogni evento. | Avvolgerla in `requestAnimationFrame` oppure usare un `ResizeObserver` sull'elenco. |
| 🟡 | `script.js:131` | `const fine` dentro il conteggio dei numeri oscura la `fine` globale di `script.js:2`, che indica il puntatore fine. Funziona, ma confonde. | Rinominare in `valoreFinale`. |
| 🟡 | `script.js:63-71` | In modalità "a tavole" è visibile una sola tavola, quindi l'`IntersectionObserver` del cartiglio duplica quello che sa già `mostraTavola`. | Aggiornare il cartiglio dentro `mostraTavola` e tenere l'observer solo per la modalità a scorrimento. |

## 2. Funzionalità

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟠 | `styles.css:451`, `:455` | **Overflow orizzontale su mobile nella TAV 05.** Il timbro parte da `scale(1.9)` e sporge oltre `.topics`. La pagina diventa larga 463 px su una viewport di 412 (+51 px, anche a 320 px). Il sito "balla" di lato. `body{overflow-x:hidden}` non basta sui browser mobili. | Aggiungere `html { overflow-x: clip }` oppure `.contact-grid { overflow: clip }`, e ridurre la scala iniziale a circa `1.3`. |
| 🟠 | `script.js:164` (`mostraTavola`) | **Il focus si perde quando cambia tavola.** Dopo il clic su "Vedi i progetti" il focus torna al `BODY`. Da tastiera resta sul link del menu e nessuno annuncia la nuova tavola. | Dare `tabindex="-1"` all'`h2` della tavola e, dopo la transizione, chiamare `h2.focus({ preventScroll: true })`. |
| 🟠 | `script.js:164-177`, `body.paged` | **Il contenuto è nascosto.** Si vede una tavola alla volta, quindi Ctrl+F non trova "LinkedIn" dalla TAV 01. Un selezionatore che scorre in velocità vede solo il titolo. | Due possibilità: rendere la home una pagina che scorre, con le tavole come sezioni e il menu che porta alle ancore (la scelta migliore per chi valuta in 30 secondi), oppure mantenere le tavole ma togliere `paged` a chi scorre o stampa. |
| 🟡 | `script.js:148-163` | Lo stato dei filtri non entra nell'URL e il numero dei risultati non viene annunciato. | Scrivere il filtro nell'URL (`#tav-04?f=software`) e mostrare "3 progetti" in una regione `aria-live="polite"`. |
| 🟡 | `script.js:54-61` | Le anteprime dei progetti compaiono solo con `pointerenter` e solo con il mouse: chi naviga da tastiera o da touch non le vede mai. | Mostrarle anche su `focusin` e, su mobile, inserire una miniatura fissa in ogni riga. |

## 3. UX/UI e grafica

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟠 | `index.html:372-430` | **Mancano le prove che un'azienda cerca.** Ogni progetto ha un nome e una riga di testo, ma nessuno screenshot visibile, nessun problema da risolvere, nessun risultato in numeri, nessun ruolo e nessuno stack. | Per i 3-4 progetti migliori, un mini caso studio: problema, cosa hai fatto, risultato (utenti, tempo risparmiato), screenshot e durata. Basta una scheda per progetto. |
| 🟠 | `index.html:476-507` | **Non si sa chi sei.** Mancano foto, una breve biografia, il CV in PDF, GitHub, la città o il lavoro da remoto e la disponibilità ("Disponibile da gennaio"). | Aggiungere un blocco "Chi sono" nella TAV 01 o 05 con foto, 3 righe, link al CV e a GitHub e lo stato di disponibilità. |
| 🟠 | `index.html:48-49`, `:515` | Due controlli diversi per il tema, il selettore in alto e il cartiglio, entrambi con etichette in inglese ("Light", "Dark"). | Un solo interruttore con etichette in italiano ("Chiaro" e "Scuro") e un'icona. |
| 🟠 | `styles.css:487-537` | Il menu mobile usa testo da 10,7 px su Pixel 7 e da 8,4 px a 320 px. Le aree toccabili sono alte 13-17 px. | Su mobile sostituire il menu con le frecce del pager oppure con un menu a scomparsa. Testo di almeno 14 px e aree di almeno 44×44 px. |
| 🟡 | `styles.css:105-107` | Su desktop i link del menu sono alti 20 px. È accettabile grazie alla spaziatura (WCAG 2.5.8), ma sono piccoli. | `padding-block: 10px` sui link. |
| 🟡 | `styles.css:422` | L'"anatomia" nella TAV 01 su mobile scorre di lato e il disegno resta tagliato ("APP" non si vede). | Su mobile scalarla con `width:100%` sull'SVG oppure semplificarla in verticale. |
| 🟡 | `index.html:163`, `:292`, `:356`; `styles.css:362-365` | Alcune scelte sanno di "estetica AI": griglia di sfondo ovunque, occhiello sopra ogni `h2`, seconda riga del titolo sempre in corsivo `<em>` e il bagliore rosso del plotter. | Tenere il corsivo su un solo titolo-chiave, togliere il bagliore e limitare la griglia alla TAV 01. Il concetto della tavola tecnica regge da solo. |
| 🟡 | `index.html:509` | Non c'è un piè di pagina. | Piè di pagina minimo: nome, email, LinkedIn, GitHub, anno, nota privacy ed eventuale P.IVA. |
| 🟡 | `index.html:481` | LinkedIn si apre in una nuova scheda senza avviso. La freccia ↗ è `aria-hidden`. | Aggiungere `<span class="sr-only">(si apre in una nuova scheda)</span>`. |
| 🟡 | `index.html` `<head>` | Manca `<meta name="theme-color">`: la barra del browser mobile non segue il tema. | Due meta con `media="(prefers-color-scheme: …)"`, oppure aggiornarlo da JS in `setTheme`. |
| 🟡 | `index.html:24` | Il tema scuro è imposto a tutti e ignora la preferenza del sistema. | `t = localStorage.getItem('gc-theme') \|\| (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')`. |

## 4. Testi

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟠 | `index.html:356` | "Progettati da me, **in produzione davvero**." Ma 5 progetti su 8 sono etichettati "Demo". Un recruiter lo nota subito. | Ad esempio "Progettati da me. Tre sono in produzione, cinque sono dimostrazioni." oppure "Dall'idea al prodotto." |
| 🟠 | `index.html:7`, `:186`, `:257`, `:490` | "Vibe coding" compare 4 volte. Per un'azienda suona improvvisato, l'opposto del messaggio "io rispondo del risultato". | "Sviluppo assistito dall'AI" oppure "Software e siti costruiti con l'AI, progettati e collaudati da me". |
| 🟡 | `index.html:478` | "I miei contatti" è un titolo debole e non invita a fare nulla. | "Parliamo del vostro progetto" oppure "Hai un processo da automatizzare? Scrivimi". |
| 🟡 | `index.html:292` | La triade "Io progetto. L'AI costruisce. Io rispondo del risultato." è uno schema da slogan, ripetuto. | Tenere una frase sola, ad esempio "L'AI scrive il codice, io ne rispondo." |
| 🟡 | `index.html:48-49`, `:515` | L'interfaccia mescola etichette in inglese ("Light", "Dark") in un sito in italiano. | Tradurle (vedi UX). |

## 5. Animazioni

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟠 | `index.html:134-136`, `:308` | Quattro `animateMotion` SVG girano all'infinito e **non si fermano con "riduci movimento"**: la media query di `styles.css:339-345` ferma solo le animazioni CSS. Non c'è nemmeno un modo per metterle in pausa (WCAG 2.2.2, livello A). | In `script.js`: `if (reduce) document.querySelectorAll('svg').forEach(s => s.pauseAnimations?.())`. In più fermarle fuori schermo, con un `IntersectionObserver` che chiama `pauseAnimations` e `unpauseAnimations`. |
| 🟡 | `styles.css` (13 `cubic-bezier` diversi, 18 transizioni) | Durate e curve sono sparse e manca la "curva di casa" chiesta dal `CLAUDE.md`. | Token `--ease: cubic-bezier(.2,.7,.2,1)`, `--dur-1: .2s`, `--dur-2: .45s`, `--dur-3: .8s`, da usare ovunque. |
| 🟡 | `styles.css:362-365` | Il bagliore (`box-shadow`) del plotter è un effetto "neon" che stona con la carta tecnica. | Togliere il `box-shadow` e tenere la linea netta. |
| 🟡 | `styles.css:451`, `:455` | Il timbro rimbalza troppo (`scale(1.9)` con curva elastica): sembra un gioco e causa l'overflow (§2). | Partire da `scale(1.25)` con `var(--ease)`. |

## 6. Prestazioni

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🟡 | `index.html:19` | Google Fonts blocca il primo disegno. Archivio viene caricato con tutti gli assi (`ital`, `wdth 62..125`, `wght 100..900`), molto più di quanto serve. | Ospitare i font in locale in `woff2`, solo con i pesi usati, più `preload` del font del titolo e `font-display: swap`. Risolve anche il punto privacy (§7). |
| 🟡 | `styles.css:6` | `Selawik-Bold.ttf` (27 KB, TTF) si carica in home solo per il logo di Filo in un'anteprima nascosta. | Convertirlo in `woff2` e ridurlo ai caratteri di "Filo", oppure sostituire il logo con un SVG. |
| 🟡 | `index.html:435-464` | Le immagini delle anteprime si caricano subito, compresa `nocchiero-icona.png` (20 KB). Solo quella di Tenuta ha `loading="lazy"`. | `loading="lazy" decoding="async"` su tutte. |
| 🟡 | `vercel.json` | `styles.css` e `script.js` della radice non hanno né versione né cache lunga, a differenza di `/assets` e Tenuta. | Aggiungere `?v=` come in Tenuta e un header `Cache-Control: public, max-age=31536000, immutable`. |

## 7. Accessibilità e obblighi di legge

| Gravità | Dove | Problema | Correzione |
|---|---|---|---|
| 🔴 | `index.html:372-428` | **Gli 8 progetti non sono annunciati come link.** `role="listitem"` sull'`<a class="reg-row">` sostituisce il ruolo di link. I lettori di schermo leggono "elemento di elenco" e `getByRole('link', {name: /Nocchiero/})` trova 0 elementi (WCAG 4.1.2). È la sezione più importante del sito. | Mettere ogni `<a>` dentro un `<li>` (`<ul role="list">` o un normale `<ul>`) e togliere `role="listitem"` dal link. |
| 🟠 | `styles.css:13` e usi a `:127`, `:183`, `:196`, `:203`, `:219`, `:227`, `:307`, `:321`, `:381`, `:388` | **Contrasto nel tema chiaro.** `--ink-3 #8b8c8f` sulla carta dà 2,93:1 su etichette da 11-12 px (REV. 2026, detail-tag, spec dt, intestazioni dell'elenco, sign-label). Il rosso `#d63a20` dà 4,07:1 su testo piccolo ("01" dei progetti, "/" del marchio). axe non lo rileva perché lo sfondo a griglia rende il controllo "incompleto". | `--ink-3: #66676b` (4,92:1) e, per il testo piccolo, rosso `#b8301a` (5,26:1). Nel tema scuro `--ink-3` è già a 4,66:1. |
| 🟠 | `styles.css:169` | Nel tema scuro `.btn:hover` mette testo bianco su `#ff7d5e`: 2,52:1. | `color: var(--on-ink)` (6,00:1). |
| 🟠 | `index.html:515` | `#theme` ha `aria-label="Cambia tema: light o dark"`, ma il testo visibile è "Tema Light". Il nome accessibile non contiene il testo visibile (WCAG 2.5.3), e chi usa la voce e dice "clic Tema Light" non lo attiva. È il test rosso della home. | Togliere l'`aria-label` e lasciare il testo visibile, oppure usare un `aria-label` che inizi con "Tema". |
| 🟠 | `index.html:19`, `:509` | **Privacy.** Google Fonts trasmette a Google l'IP di ogni visitatore senza base giuridica (LG München, 20/01/2022) e il sito non ha una nota privacy. | Ospitare i font in locale (§6) e aggiungere una breve informativa: titolare, email e nessun cookie di profilazione. Il tema in `localStorage` è tecnico e non richiede banner. |
| 🟠 | `tenutabriantea/css/style.css:14-15` | Contrasto su Tenuta, che fa fallire 16 test: miele `#B07D2A` su `#f2ece0` 3,07:1 (numeri di capitolo, camere, sentieri, tabelle); testo chiaro sul miele 3,29:1 (`.btn-honey`, `.hd-book`); `em` su `#eee3cc` 2,83:1; `#6b5f50` su `#3e4530` 1,6:1 (trio di Residenze); `#D3A24D` per `aria-current` 1,97:1; `.hd-mark` con nome che non corrisponde al testo. Il caso dell'intestazione `#efe6d4` su `#f2ece0` (1,05:1) è probabilmente un falso positivo, perché l'intestazione è trasparente sopra la copertina: va controllato. | Aggiungere un token più scuro per il testo, ad esempio `--honey-ink: #8a5f1a`, lasciando il miele ai fondi e ai decori. Testo scuro sui bottoni miele. Allineare l'`aria-label` di `.hd-mark` al testo visibile. Poi `npm run versioni`. |
| 🟡 | `index.html:38` | Manca il link "Salta al contenuto". `<main>` esiste già. | `<a class="sr-only" href="#main">Salta al contenuto</a>`, visibile al focus. |
| 🟡 | `script.js:109` | Ogni tavola aggiunge un `<nav aria-label="Tavole">`: ci sono più landmark con lo stesso nome. | `aria-label="Tavola precedente e successiva"`, oppure un solo pager fuori dalle tavole. |
| 🟡 | `script.js:148-163` | Il filtro dei progetti non annuncia il risultato: non c'è nessuna regione `aria-live`. | Vedi §2. |
| 🟡 | `index.html:266-270` | La tabella BOM non ha `<caption>`. | Aggiungere `<caption class="sr-only">Distinta dei componenti</caption>`. |
| 🟡 | `styles.css:321` | Il cartiglio ha testo da 9,5 px. | Almeno 11 px. |
| 🟡 | `index.html:509` | Se Giuseppe ha una partita IVA e offre servizi, il sito deve riportarla (art. 35 DPR 633/72). | Inserirla nel piè di pagina, se c'è. |
| 🟡 | `.vercelignore` | `REPORT-AUDIT.md` verrebbe pubblicato insieme al sito: `.vercelignore` esclude già `CLAUDE.md`, ma non questo file. | Aggiungere `REPORT-AUDIT.md` a `.vercelignore`. |

Nota: l'European Accessibility Act con molta probabilità non si applica a un portfolio personale. La conformità WCAG 2.1 AA resta comunque un segnale di qualità per le aziende.

---

## L'idea del portfolio: "le tavole del progettista" funziona o sembra AI?

**Verdetto: l'idea di fondo è buona, ma andava tolto il costume.**

**Cosa funziona.** La distinzione "tratto rosso = io, tratto blu tratteggiato = l'AI" è il punto forte.
- È vera, perché descrive davvero come lavori.
- Si capisce in un secondo.
- Risponde alla domanda che ogni azienda si fa davanti a chi lavora con l'AI: *"ma tu cosa fai?"*.

È rimasta, ed è il filo che lega tutta la pagina.

**Cosa la faceva sembrare generata.** Erano gli accessori della metafora, ripetuti su ogni schermata:
- numerazioni "TAV. 01 / REV. B";
- cornici con mirini e cartiglio;
- timbro e contatori;
- il corsivo su ogni titolo e gli slogan a effetto.

Sono gli stessi segni che i modelli generativi mettono quando ricevono "stile blueprint". Un visitatore li riconosce come decorazione e smette di leggere. Il tema prendeva il posto della persona.

**Cosa è stato fatto per renderlo più umano:**
- Via numerazioni, cornici, cartiglio, timbro e contatori. Restano gli schemi, che spiegano qualcosa: com'è fatto un agente e le fasi di lavoro.
- Testi in prima persona, con frasi semplici e concrete: cosa fai, per chi, cosa resta a te e cosa lasci all'AI. Niente slogan.
- Nuova sezione **"Chi sono"** e una sezione contatti con un'unica azione chiara.
- Il corsivo compare in un solo titolo della pagina, dove porta un'idea ("Del risultato rispondo io").

**Cosa manca e solo tu puoi dare.** Sono le cose che rendono umano un portfolio più di qualsiasi scelta grafica. Non le ho inventate:
1. **Una tua foto**, anche semplice, in luce naturale.
2. **Una bio di 3 righe** con città, o "da remoto", e un dettaglio vero su di te.
3. **Il CV in PDF**, da scaricare.
4. **Il profilo GitHub** e, se c'è, LinkedIn.
5. **Disponibilità:** da quando e in che forma (dipendente, freelance, progetto).
6. **Numeri e date veri** per Nocchiero, Filo e Family Hub: da quando sono online, quante persone li usano, un risultato misurabile.
7. **Partita IVA**, se lavori come freelance: va nel piè di pagina.
8. **Una frase di un cliente o di un collega**, con nome e ruolo.

---

## Suggerimenti di impostazione per un portfolio "da azienda"

1. **I primi 5 secondi:** nome, ruolo in una riga ("Progetto software e agenti AI per le PMI"), foto, disponibilità e due pulsanti: "Vedi i casi studio" e "Scarica il CV".
2. **Casi studio, non elenchi:** 3 progetti in evidenza, ciascuno con uno screenshot grande, il problema, la soluzione, il risultato in numeri e lo stack. Gli altri 5 restano nell'elenco compatto.
3. **Pagina che scorre:** le tavole funzionano bene come sezioni con il loro cartiglio. Non vanno usate come diapositive che nascondono il resto.
4. **Credibilità:** GitHub, una frase di un cliente o di un collega e, per i tre progetti online, utenti o date di rilascio.
5. **Un'azione sola alla fine:** "Scrivimi" con l'email ben visibile, più un pulsante "Prenota 20 minuti" se usi un calendario.
