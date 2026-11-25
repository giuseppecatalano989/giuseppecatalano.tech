# giuseppecatalano.tech

Valgono le regole globali del Kit Qualità (~/.claude/CLAUDE.md). Qui solo ciò che è
specifico di questo repository.

## Progetto

- Cliente / prodotto: portfolio di Giuseppe Catalano, con i progetti dimostrativi in sottocartelle
  (`tenutabriantea/`, `nocchiero/`, `filo/`, `comitas/`, `metis/`, `minerva/`, `quadra/`, `family-hub/`).
- Cosa deve ottenere chi visita: capire cosa sa fare l'autore e aprire i progetti dimostrativi.
- Stack: HTML, CSS e JavaScript statici, senza build. Pubblicazione su Vercel (`vercel.json`).
- URL produzione: https://giuseppecatalano.tech/

## Tenuta Briantea (`tenutabriantea/`)

- Sito **dimostrativo** di una tenuta immaginaria in Brianza: resta `noindex`, e prenotazioni e
  richieste di contatto non partono davvero (il form mostra la conferma, WhatsApp usa un numero finto).
- **I file HTML sono i sorgenti.** Il vecchio `build.py` con la cartella `src/` non esiste più:
  si modificano direttamente le otto pagine. Intestazione, menu, piè di pagina e barra di
  prenotazione sono ripetuti in ogni pagina: una modifica a uno di questi blocchi va fatta in tutte.
- Dopo ogni modifica a `css/style.css` o ai file in `js/`: `npm run versioni`. CSS e JS hanno una
  cache di un anno e il browser li riscarica solo se cambia il `?v=`; un test lo verifica.
- Stile: vedi `tenutabriantea/DESIGN.md`.
- Immagini e video: contenuti generati con modelli AI. Le copertine e i loop sono in
  `img/copertine/` e `video/`; la copertina della home è una sequenza scrubbata allo scorrimento
  (`video/copertina/`, motore in `js/cover-worker.js`).

## Identità (Tenuta Briantea)

- Idea distintiva: il "registro della cascina": capitoli numerati in romano, archi del portico,
  dialetto brianzolo, il Lunario con meteo, luna e piatto del giorno.
- Tono dei testi: caldo, breve, seconda persona plurale ("Scriveteci", "Indicateci").
- Cosa evitare: la parola in corsivo miele su ogni titolo e il maiuscoletto spaziato ovunque
  (tic segnalati dall'audit), altri colori d'accento oltre al miele.

## Movimento

- Libreria: CSS (transizioni e View Transitions); JS solo per le copertine e le comparse allo scorrimento.
- Curva di casa: `--ease: cubic-bezier(.2, .7, .2, 1)`. Durate e curve da ridurre a pochi token
  (oggi sono disperse, vedi audit).

## Comandi

- Avvio in locale: `npm run dev` (http://localhost:4173/)
- Test: `npm test` (Playwright: pagine, menu, prenotazione, versioni, accessibilità axe-core)
- Versioni di CSS e JS: `npm run versioni` (`-- --controlla` per la sola verifica)
- Build: nessuna.
