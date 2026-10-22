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
node core/server.js vedetta            # modalità demo (predefinita), http://localhost:4300
node core/server.js vedetta --live     # decisioni dalle API di Claude
node core/server.js vedetta --registra # come --live, e salva la sessione in scenario.json
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

- **Vedetta** — project management: legge email, ticket, note delle riunioni e piano; calcola l'effetto
  a cascata dei ritardi; scrive lo stato avanzamento; propone aggiornamenti ai ticket ed email, che esegue
  solo dopo l'approvazione. Vetrina: `/vedetta/`.
- **Quadra** — ciclo passivo: legge le fatture elettroniche arrivate dallo SDI, fa il controllo a tre vie
  (ordine, bolle di consegna, fattura) più doppioni, IBAN e conti; registra in autonomia le fatture conformi;
  propone blocchi di pagamento ed email di contestazione, con approvazione. Vetrina: `/quadra/`.
- **Sportello** — assistenza clienti di un negozio online: legge email e chat, recupera ordini, tracciamento,
  storico e base di conoscenza; risponde da solo alle richieste informative; propone sostituzioni e modifiche
  agli ordini (con approvazione); passa a una persona i casi delicati con riepilogo e proposta. Vetrina: `/sportello/`.

Ogni agente ha un livello di autonomia deciso strumento per strumento: gli strumenti con `approvazione: true`
fermano il ciclo finché qualcuno non approva dall'interfaccia.
