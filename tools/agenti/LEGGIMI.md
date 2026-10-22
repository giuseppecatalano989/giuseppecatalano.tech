# Agenti AI dimostrativi

Agenti costruiti sulle API di Claude (tool use): l'agente ragiona e sceglie gli strumenti, gli strumenti
vengono eseguiti davvero. Ogni agente ha un'interfaccia web locale che mostra il suo lavoro in tempo reale.

## Struttura

- `core/agente.js` — il ciclo dell'agente: messaggi, strumenti, approvazioni, registrazione e riproduzione.
- `core/server.js` — server locale: interfaccia, eventi in streaming (SSE), approvazioni.
- `core/ui/agente-client.js` — collegamento comune tra interfaccia e server.
- `<agente>/agente.config.js` — istruzioni (prompt di sistema), compito, strumenti e loro implementazione.
- `<agente>/dati/` — dati di prova, **inventati** (aziende, persone, progetti).
- `<agente>/scenario.json` — decisioni dell'agente usate dalla modalità demo.
- `<agente>/app/` — interfaccia dell'agente.

## Avvio

```
npm install
node core/server.js metis            # modalità demo (predefinita), http://localhost:4300
node core/server.js metis --live     # decisioni dalle API di Claude
node core/server.js metis --registra # come --live, e salva la sessione in scenario.json
```

Per `--live` e `--registra` serve la variabile `ANTHROPIC_API_KEY` (e facoltativamente `AGENT_MODEL`,
predefinito `claude-sonnet-5-5`). Su Windows: `set ANTHROPIC_API_KEY=...` prima del comando.

### Modalità demo

Riproduce le decisioni salvate in `scenario.json` con tempi naturali, ma esegue comunque gli strumenti sui
dati: risultati, calcoli e report sono veri. Le azioni con approvazione aspettano il clic sull'interfaccia.
Lo scenario incluso è scritto a mano nello stesso formato della registrazione: per sostituirlo con una
sessione reale di Claude basta una corsa con `--registra`.

Se si registra una nuova sessione, controllare che le frasi dell'agente restino coerenti con i dati e,
per il video, rifare la ripresa (vedi `tools/video/LEGGIMI.md`).

## Agenti

- **Metis** — pianificazione per il project manager: legge brief, offerte dei fornitori e attività del team;
  costruisce il piano a step con dipendenze e calendario reale (festivi, chiusure, vincoli «non prima del»,
  trasloco nel fine settimana) e trova il percorso critico; simula varianti; genera chi fa cosa, schema dei SAL
  e report; prepara le email ai fornitori, che partono solo dopo l'approvazione. Le date le calcola sempre il
  motore deterministico in `agente.config.js`, mai il modello. Vetrina: `/metis/`.
- **Quadra** — ciclo passivo: legge le fatture elettroniche arrivate dallo SDI, fa il controllo a tre vie
  (ordine, bolle di consegna, fattura) più doppioni, IBAN e conti; registra in autonomia le fatture conformi;
  propone blocchi di pagamento ed email di contestazione, con approvazione. Vetrina: `/quadra/`.
- **Comitas** — clienti e social per un e-commerce o un'attività di servizi: legge email, chat, DM e commenti
  pubblici su Instagram e Facebook; recupera ordini, tracciamento, storico (anche tra canali diversi) e base di
  conoscenza; risponde da solo alle richieste informative, in privato o in pubblico; nasconde lo spam; propone
  sostituzioni, modifiche agli ordini e risposte pubbliche ai reclami (con approvazione); passa a una persona i
  casi delicati con tutti i messaggi collegati. Vetrina: `/comitas/`.
- **Minerva** — service desk su knowledge base: legge la coda di ticket ed email, lo stato dei servizi e le pagine
  di Confluence e Notion (simulate); scrive una nota privata con le fonti e assegna il ticket secondo la matrice di
  chi fa cosa; risponde in automatico solo con procedura verificata, altrimenti prepara una bozza da approvare.
  Il blocco è nello strumento `invia_risposta`: rifiuta l'invio su ticket legati a un incidente, di sicurezza o
  senza una fonte con confidenza alta. Vetrina: `/minerva/`.

Ogni agente ha un livello di autonomia deciso strumento per strumento: gli strumenti con `approvazione: true`
fermano il ciclo finché qualcuno non approva dall'interfaccia.
