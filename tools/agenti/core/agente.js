// Ciclo dell'agente: il modello AI ragiona e decide quali strumenti usare, gli strumenti vengono eseguiti davvero.
//
// Tre modalità:
//  - "live":     ogni decisione arriva dalle API del modello AI (serve la chiave API nell'ambiente).
//  - "registra": come live, e in più salva le decisioni del modello in scenario.json.
//  - "demo":     riproduce le decisioni salvate in scenario.json, ma esegue comunque gli strumenti
//                sui dati: risultati, calcoli e report sono veri. Serve per riprese sempre identiche.
//
// Gli strumenti con `approvazione: true` si fermano finché una persona non approva dall'interfaccia.

import fs from 'node:fs';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export async function eseguiAgente({ config, modalita, emetti, attendiApprovazione, ritmo = 1 }) {
  const t0 = Date.now();
  const strumenti = Object.fromEntries(config.strumenti.map((s) => [s.name, s]));
  const definizioni = config.strumenti.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const messaggi = [{ role: 'user', content: config.compito }];
  const turniRegistrati = [];
  const stat = { strumenti: 0, approvazioni: 0, turni: 0, token: 0 };

  let client = null;
  let scenario = null;
  if (modalita === 'demo') {
    scenario = JSON.parse(fs.readFileSync(config.scenario, 'utf8'));
  } else {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic(); // legge ANTHROPIC_API_KEY dall'ambiente
  }

  emetti({ type: 'avvio', compito: config.compito, modalita });
  config.reimposta?.();

  for (let turno = 0; turno < (config.maxTurni || 20); turno++) {
    stat.turni++;
    let contenuto;
    let stop;

    if (modalita === 'demo') {
      const t = scenario.turni[turno];
      if (!t) break;
      contenuto = t.content;
      stop = contenuto.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
      await pausa(650 / ritmo); // il tempo di "pensare"
      for (const b of contenuto) {
        if (b.type !== 'text') continue;
        // Il testo arriva a pezzetti, come dallo streaming reale
        const pezzi = b.text.match(/\S+\s*/g) || [];
        for (const p of pezzi) { emetti({ type: 'testo', delta: p }); await pausa((18 + p.length * 9) / ritmo); }
        emetti({ type: 'testo_fine' });
      }
    } else {
      const stream = client.messages.stream({
        model: config.modello || process.env.AGENT_MODEL || 'claude-sonnet-5-5',
        max_tokens: 4096,
        system: config.sistema,
        tools: definizioni,
        messages: messaggi,
      });
      let inTesto = false;
      stream.on('text', (delta) => { inTesto = true; emetti({ type: 'testo', delta }); });
      stream.on('contentBlock', (b) => { if (b.type === 'text' && inTesto) { emetti({ type: 'testo_fine' }); inTesto = false; } });
      const finale = await stream.finalMessage();
      contenuto = finale.content;
      stop = finale.stop_reason;
      stat.token += (finale.usage?.input_tokens || 0) + (finale.usage?.output_tokens || 0);
      turniRegistrati.push({ content: contenuto.filter((b) => b.type === 'text' || b.type === 'tool_use') });
    }

    messaggi.push({ role: 'assistant', content: contenuto });
    if (stop !== 'tool_use') break;

    // Strumenti richiesti in questo turno: annunciati tutti, poi eseguiti in ordine
    const chiamate = contenuto.filter((b) => b.type === 'tool_use');
    for (const c of chiamate) {
      const s = strumenti[c.name];
      emetti({ type: 'strumento', id: c.id, nome: c.name, input: c.input, etichetta: s?.etichetta?.(c.input) || c.name, approvazione: !!s?.approvazione });
    }
    const risultati = [];
    for (const c of chiamate) {
      const s = strumenti[c.name];
      let esito;
      try {
        if (!s) throw new Error(`Strumento sconosciuto: ${c.name}`);
        if (s.approvazione) {
          emetti({ type: 'approvazione', id: c.id, nome: c.name, input: c.input, anteprima: s.anteprima?.(c.input) });
          const ok = await attendiApprovazione(c.id);
          emetti({ type: ok ? 'approvato' : 'rifiutato', id: c.id });
          if (!ok) { esito = { risultato: { esito: 'rifiutato', messaggio: 'La persona ha rifiutato questa azione. Non eseguirla e non riproporla.' }, sintesi: 'Rifiutata' }; }
          else stat.approvazioni++;
        }
        if (!esito) {
          if (modalita === 'demo') await pausa((typeof s.latenza === 'function' ? s.latenza(c.input) : s.latenza ?? 900) / ritmo);
          esito = await s.esegui(c.input);
        }
        stat.strumenti++;
        emetti({ type: 'risultato', id: c.id, nome: c.name, sintesi: esito.sintesi, vista: esito.vista });
        if (esito.output) emetti({ type: 'output', ...esito.output });
      } catch (err) {
        esito = { risultato: { errore: err.message } };
        emetti({ type: 'risultato', id: c.id, nome: c.name, sintesi: 'Errore: ' + err.message, errore: true });
      }
      risultati.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(esito.risultato) });
    }
    messaggi.push({ role: 'user', content: risultati });
  }

  if (modalita === 'registra') {
    fs.writeFileSync(config.scenario, JSON.stringify({ registrato: new Date().toISOString(), compito: config.compito, turni: turniRegistrati }, null, 1));
  }
  emetti({ type: 'fine', secondi: Math.round((Date.now() - t0) / 1000), ...stat });
}
