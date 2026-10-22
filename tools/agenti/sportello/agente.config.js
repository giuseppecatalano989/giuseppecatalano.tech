// Sportello — agente per l'assistenza clienti di un negozio online.
// Legge i messaggi in arrivo (email e chat), recupera ordini, spedizioni, storico e base di conoscenza,
// risponde da solo alle richieste informative con dati verificati, propone sostituzioni e modifiche agli
// ordini (con approvazione) e passa a una persona i casi delicati, con un riepilogo pronto.
// I dati di prova (negozio, clienti, ordini) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    db = { messaggi: leggi('messaggi.json'), ...leggi('negozio.json'), stato: {}, risposte: [], operatore: [], azioni: [] };
  };
  reimposta();
  const ordine = (n) => {
    const o = db.ordini.find((x) => x.numero === n);
    if (!o) throw new Error(`Ordine ${n} non trovato`);
    return o;
  };
  const msgDi = (num) => db.messaggi.find((m) => m.testo.includes(num))?.id;

  const strumenti = [
    {
      name: 'leggi_messaggi',
      description: 'Legge i messaggi dei clienti arrivati e ancora senza risposta (email e chat).',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Messaggi in arrivo',
      latenza: 800,
      esegui: async () => ({ risultato: db.messaggi, sintesi: `${db.messaggi.length} messaggi da gestire`, vista: { tipo: 'arrivo' } }),
    },
    {
      name: 'cerca_ordine',
      description: 'Cerca un ordine per numero, oppure gli ordini di un cliente per email.',
      input_schema: { type: 'object', properties: { numero: { type: 'string' }, email: { type: 'string' } } },
      etichetta: (i) => `Ordine ${i.numero || 'di ' + (db.messaggi.find((m) => m.email === i.email)?.cliente || i.email)}`,
      latenza: 650,
      esegui: async ({ numero, email }) => {
        const r = numero ? [ordine(numero)] : db.ordini.filter((o) => o.cliente === email);
        const o = r[0];
        const sintesi = o ? `${o.numero} · ${o.stato}${o.consegnato_il ? ' il ' + o.consegnato_il.slice(8, 10) + '/' + o.consegnato_il.slice(5, 7) : ''}` : 'Nessun ordine';
        const msg = o && (msgDi(o.numero) || db.messaggi.find((m) => m.email === o.cliente)?.id);
        return { risultato: r, sintesi, vista: msg ? { tipo: 'contesto', messaggio: msg, voce: 'ordine', dati: o } : null };
      },
    },
    {
      name: 'traccia_spedizione',
      description: 'Eventi di tracciamento di una spedizione dal corriere.',
      input_schema: { type: 'object', properties: { tracking: { type: 'string' } }, required: ['tracking'] },
      etichetta: (i) => `Tracciamento ${i.tracking}`,
      latenza: 900,
      esegui: async ({ tracking }) => {
        const s = db.spedizioni[tracking];
        if (!s) throw new Error('Tracking sconosciuto');
        const ultimo = s.eventi.at(-1);
        const o = db.ordini.find((x) => x.tracking === tracking);
        return { risultato: s, sintesi: `${ultimo.luogo} · ${ultimo.evento}`, vista: { tipo: 'contesto', messaggio: msgDi(o.numero), voce: 'spedizione', dati: s } };
      },
    },
    {
      name: 'cerca_conoscenza',
      description: 'Cerca nella base di conoscenza del negozio (politiche, misure, resi, consegne). Restituisce gli articoli più pertinenti.',
      input_schema: { type: 'object', properties: { domanda: { type: 'string' } }, required: ['domanda'] },
      etichetta: (i) => `Conoscenza: «${i.domanda.length > 34 ? i.domanda.slice(0, 32) + '…' : i.domanda}»`,
      latenza: 800,
      esegui: async ({ domanda }) => {
        const parole = domanda.toLowerCase().split(/[^a-zà-ù0-9x]+/).filter(Boolean);
        const r = db.conoscenza.map((a) => ({ ...a, punteggio: a.parole.filter((p) => parole.some((q) => q.startsWith(p) || p.startsWith(q))).length }))
          .filter((a) => a.punteggio > 0).sort((a, b) => b.punteggio - a.punteggio).slice(0, 2)
          .map(({ id, titolo, testo }) => ({ id, titolo, testo }));
        // Per l'interfaccia: il messaggio a cui si riferisce più probabilmente la ricerca
        const kb = r.length ? db.conoscenza.find((a) => a.id === r[0].id) : null;
        const msg = kb && db.messaggi.map((m) => ({ id: m.id, p: kb.parole.filter((w) => m.testo.toLowerCase().includes(w)).length })).sort((a, b) => b.p - a.p)[0].id;
        return { risultato: r, sintesi: r.length ? `${r[0].id} · ${r[0].titolo}` : 'Nessun articolo', vista: r.length ? { tipo: 'contesto', messaggio: msg, voce: 'conoscenza', dati: r[0] } : null };
      },
    },
    {
      name: 'storico_cliente',
      description: 'Storico di un cliente: contatti precedenti con l\'assistenza e loro esito, numero di ordini, spesa totale.',
      input_schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      etichetta: (i) => `Storico di ${db.messaggi.find((m) => m.email === i.email)?.cliente || i.email}`,
      latenza: 700,
      esegui: async ({ email }) => {
        const s = db.storico[email] || { contatti: [], ordini_totali: 0, spesa_totale: 0 };
        const senza = s.contatti.filter((c) => c.esito === 'nessuna risposta').length;
        return { risultato: s, sintesi: `${s.contatti.length} contatti precedenti${senza ? ` · ${senza} senza risposta` : ''} · ${s.ordini_totali} ordini`,
          vista: { tipo: 'contesto', messaggio: db.messaggi.find((m) => m.email === email)?.id, voce: 'storico', dati: s } };
      },
    },
    {
      name: 'invia_risposta',
      description: 'Invia la risposta al cliente sullo stesso canale del messaggio. Da usare in autonomia solo per risposte informative basate su dati verificati (ordini, tracciamento, base di conoscenza) o per confermare azioni già approvate.',
      input_schema: { type: 'object', properties: { messaggio: { type: 'string' }, testo: { type: 'string' } }, required: ['messaggio', 'testo'] },
      etichetta: (i) => `Risposta a ${db.messaggi.find((m) => m.id === i.messaggio)?.cliente || i.messaggio}`,
      latenza: 900,
      esegui: async ({ messaggio, testo }) => {
        const m = db.messaggi.find((x) => x.id === messaggio);
        if (!m) throw new Error('Messaggio inesistente');
        db.risposte.push({ messaggio, testo });
        db.stato[messaggio] = db.stato[messaggio] === 'approvato' ? 'risolto' : 'risposto';
        // Ambiente dimostrativo: nessun invio reale
        return { risultato: { inviato: true }, sintesi: `Inviata via ${m.canale}`, vista: { tipo: 'risposta', messaggio, testo, stato: db.stato[messaggio] } };
      },
    },
    {
      name: 'avvia_sostituzione',
      description: 'Avvia la sostituzione o il rimborso di un articolo difettoso, con ritiro gratuito. Richiede l\'approvazione di un operatore.',
      input_schema: { type: 'object', properties: {
        ordine: { type: 'string' }, tipo: { type: 'string', enum: ['sostituzione', 'rimborso'] }, motivo: { type: 'string' } }, required: ['ordine', 'tipo', 'motivo'] },
      approvazione: true,
      etichetta: (i) => `${i.tipo === 'rimborso' ? 'Rimborso' : 'Sostituzione'} ${i.ordine}`,
      anteprima: (i) => { const o = ordine(i.ordine); return { tipo: 'sostituzione', ...i, articolo: o.articoli[0].nome, importo: o.articoli[0].prezzo, cliente: db.messaggi.find((m) => m.email === o.cliente)?.cliente }; },
      latenza: 700,
      esegui: async ({ ordine: n, tipo }) => {
        const o = ordine(n);
        const msg = msgDi(n);
        db.azioni.push({ tipo, ordine: n });
        db.stato[msg] = 'approvato';
        return { risultato: { avviata: tipo, ritiro: 'prenotato con il corriere', valore: o.articoli[0].prezzo }, sintesi: `${tipo === 'rimborso' ? 'Rimborso' : 'Sostituzione'} avviata · ritiro prenotato`, vista: { tipo: 'stato', messaggio: msg, stato: 'approvato' } };
      },
    },
    {
      name: 'aggiorna_indirizzo',
      description: 'Corregge l\'indirizzo di consegna di un ordine non ancora spedito. Richiede l\'approvazione di un operatore.',
      input_schema: { type: 'object', properties: { ordine: { type: 'string' }, indirizzo: { type: 'string' } }, required: ['ordine', 'indirizzo'] },
      approvazione: true,
      etichetta: (i) => `Indirizzo ${i.ordine}`,
      anteprima: (i) => { const o = ordine(i.ordine); return { tipo: 'indirizzo', ...i, prima: o.indirizzo, stato_ordine: o.stato }; },
      latenza: 600,
      esegui: async ({ ordine: n, indirizzo }) => {
        const o = ordine(n);
        if (o.stato !== 'in preparazione') throw new Error('L\'ordine è già partito: va contattato il corriere');
        o.indirizzo = indirizzo;
        const msg = msgDi(n);
        db.azioni.push({ tipo: 'indirizzo', ordine: n });
        db.stato[msg] = 'approvato';
        return { risultato: { aggiornato: true, indirizzo }, sintesi: 'Indirizzo corretto', vista: { tipo: 'stato', messaggio: msg, stato: 'approvato' } };
      },
    },
    {
      name: 'passa_a_operatore',
      description: 'Passa una conversazione a un operatore umano con un riepilogo del caso e una proposta di soluzione. Da usare per clienti molto insoddisfatti, solleciti ripetuti, richieste fuori dalle politiche.',
      input_schema: { type: 'object', properties: {
        messaggio: { type: 'string' }, operatore: { type: 'string' }, riepilogo: { type: 'string' }, proposta: { type: 'string' }, priorita: { type: 'string', enum: ['alta', 'normale'] } },
        required: ['messaggio', 'operatore', 'riepilogo', 'proposta'] },
      etichetta: (i) => `A ${i.operatore}`,
      latenza: 800,
      esegui: async (x) => {
        db.operatore.push(x);
        db.stato[x.messaggio] = 'operatore';
        return { risultato: { assegnato: x.operatore }, sintesi: `Assegnato a ${x.operatore}${x.priorita === 'alta' ? ' · priorità alta' : ''}`, vista: { tipo: 'operatore', ...x } };
      },
    },
    {
      name: 'scrivi_riepilogo',
      description: 'Pubblica il riepilogo del turno per il team di assistenza. I conteggi li calcola lo strumento dallo stato reale; tu scrivi la sintesi.',
      input_schema: { type: 'object', properties: { sintesi: { type: 'string' } }, required: ['sintesi'] },
      etichetta: () => 'Riepilogo per il team',
      latenza: 900,
      esegui: async ({ sintesi }) => {
        const conta = (s) => Object.values(db.stato).filter((x) => x === s).length;
        const r = { sintesi, negozio: db.negozio, data: db.oggi, messaggi: db.messaggi.length,
          risposti_in_autonomia: conta('risposto'), risolti_con_approvazione: conta('risolto'), a_operatore: conta('operatore'),
          aperti: db.messaggi.length - Object.keys(db.stato).length,
          operatore: db.operatore.map(({ messaggio, operatore, proposta }) => ({ messaggio, operatore, proposta, cliente: db.messaggi.find((m) => m.id === messaggio)?.cliente })) };
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'riepilogo.json'), JSON.stringify(r, null, 1));
        return { risultato: r, sintesi: `${r.messaggi - r.aperti} su ${r.messaggi} gestiti`, output: { tipo: 'riepilogo', contenuto: r } };
      },
    },
  ];

  return {
    info: { nome: 'Sportello', ruolo: 'Agente per l\'assistenza clienti', negozio: db.negozio, oggi: db.oggi, operatori: db.operatori },
    compito: 'Gestisci i messaggi dei clienti arrivati stamattina: rispondi, risolvi o passa a un operatore, e chiudi con il riepilogo per il team.',
    sistema: [
      'Sei Sportello, l\'agente di assistenza clienti di Casa Ortensia, negozio online di tessili e arredo per la casa. Scrivi in italiano, con tono cordiale e diretto; dai del tu ai clienti in chat e del lei via email.',
      'Regole:',
      '1. Prima di rispondere recupera i dati: ordine, tracciamento, storico del cliente, base di conoscenza. Non inventare date, misure o politiche.',
      '2. Alle richieste informative rispondi da solo con invia_risposta, citando i dati verificati.',
      '3. Sostituzioni, rimborsi e modifiche agli ordini passano dagli strumenti che richiedono approvazione. Dopo l\'approvazione conferma al cliente.',
      '4. Clienti molto insoddisfatti, solleciti ripetuti o richieste fuori dalle politiche vanno a un operatore con passa_a_operatore: riepilogo del caso e proposta concreta. In quei casi non rispondere tu al cliente.',
      '5. Chiudi con scrivi_riepilogo. Mentre lavori scrivi frasi brevi su cosa stai facendo.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: { messaggi: () => db.messaggi },
  };
}
