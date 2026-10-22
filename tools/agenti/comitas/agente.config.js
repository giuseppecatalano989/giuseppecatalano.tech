// Comitas — agente per clienti e social di un negozio online o di un'attività di servizi.
// Legge email, chat, DM e commenti pubblici su Instagram e Facebook; recupera ordini, spedizioni, storico
// (anche tra canali diversi) e base di conoscenza; risponde da solo alle richieste informative e ai
// commenti semplici, nasconde lo spam evidente, propone sostituzioni, modifiche agli ordini e risposte
// pubbliche ai reclami (con approvazione) e passa a una persona i casi delicati.
// I dati di prova (negozio, clienti, ordini, profili) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

const CANALI = { email: 'email', chat: 'chat', instagram: 'commento Instagram', instagram_dm: 'DM Instagram', facebook: 'commento Facebook' };

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    db = { messaggi: leggi('messaggi.json'), ...leggi('negozio.json'), stato: {}, risposte: [], operatore: [], azioni: [], conta: { autonomia: 0, approvate: 0, nascosti: 0 } };
  };
  reimposta();
  const ordine = (n) => {
    const o = db.ordini.find((x) => x.numero === n);
    if (!o) throw new Error(`Ordine ${n} non trovato`);
    return o;
  };
  const msg = (id) => {
    const m = db.messaggi.find((x) => x.id === id);
    if (!m) throw new Error(`Messaggio ${id} inesistente`);
    return m;
  };
  const msgDi = (num) => db.messaggi.find((m) => m.testo.includes(num))?.id;
  const nomeDi = (email) => db.messaggi.find((m) => m.email === email)?.cliente || email;

  const strumenti = [
    {
      name: 'leggi_messaggi',
      description: 'Legge i messaggi ancora senza risposta da tutti i canali: email, chat, DM di Instagram, commenti pubblici su Instagram e Facebook (con il post a cui si riferiscono).',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Messaggi e commenti in arrivo',
      latenza: 900,
      esegui: async () => {
        const pub = db.messaggi.filter((m) => m.pubblico).length;
        return { risultato: db.messaggi, sintesi: `${db.messaggi.length} da gestire · ${pub} commenti pubblici`, vista: { tipo: 'arrivo' } };
      },
    },
    {
      name: 'cerca_ordine',
      description: 'Cerca un ordine per numero, oppure gli ordini di un cliente per email.',
      input_schema: { type: 'object', properties: { numero: { type: 'string' }, email: { type: 'string' } } },
      etichetta: (i) => `Ordine ${i.numero || 'di ' + nomeDi(i.email)}`,
      latenza: 650,
      esegui: async ({ numero, email }) => {
        const r = numero ? [ordine(numero)] : db.ordini.filter((o) => o.cliente === email);
        const o = r[0];
        const sintesi = o ? `${o.numero} · ${o.stato}${o.consegnato_il ? ' il ' + o.consegnato_il.slice(8, 10) + '/' + o.consegnato_il.slice(5, 7) : ''}` : 'Nessun ordine';
        const m = o && (msgDi(o.numero) || db.messaggi.find((x) => x.email === o.cliente)?.id);
        return { risultato: r, sintesi, vista: m ? { tipo: 'contesto', messaggio: m, voce: 'ordine', dati: o } : null };
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
      description: 'Cerca nella base di conoscenza del negozio (politiche, misure, resi, consegne, regole per i social). Restituisce gli articoli più pertinenti.',
      input_schema: { type: 'object', properties: { domanda: { type: 'string' }, messaggio: { type: 'string', description: 'Id del messaggio a cui si riferisce la ricerca (facoltativo)' } }, required: ['domanda'] },
      etichetta: (i) => `Conoscenza: «${i.domanda.length > 30 ? i.domanda.slice(0, 28) + '…' : i.domanda}»`,
      latenza: 800,
      esegui: async ({ domanda, messaggio }) => {
        const parole = domanda.toLowerCase().split(/[^a-zà-ù0-9x]+/).filter(Boolean);
        const r = db.conoscenza.map((a) => ({ ...a, punteggio: a.parole.filter((p) => parole.some((q) => q.startsWith(p) || p.startsWith(q))).length }))
          .filter((a) => a.punteggio > 0).sort((a, b) => b.punteggio - a.punteggio).slice(0, 2)
          .map(({ id, titolo, testo }) => ({ id, titolo, testo }));
        let m = messaggio;
        if (!m && r.length) {
          const kb = db.conoscenza.find((a) => a.id === r[0].id);
          m = db.messaggi.map((x) => ({ id: x.id, p: kb.parole.filter((w) => x.testo.toLowerCase().includes(w)).length })).sort((a, b) => b.p - a.p)[0].id;
        }
        return { risultato: r, sintesi: r.length ? `${r[0].id} · ${r[0].titolo}` : 'Nessun articolo', vista: r.length && m ? { tipo: 'contesto', messaggio: m, voce: 'conoscenza', dati: r[0] } : null };
      },
    },
    {
      name: 'storico_cliente',
      description: 'Storico di un cliente per email o per profilo social: contatti precedenti e loro esito, profili collegati, numero di ordini, spesa totale.',
      input_schema: { type: 'object', properties: { email: { type: 'string' }, profilo: { type: 'string' } } },
      etichetta: (i) => `Storico di ${i.email ? nomeDi(i.email) : i.profilo}`,
      latenza: 700,
      esegui: async ({ email, profilo }) => {
        let em = email;
        if (!em && profilo) em = Object.entries(db.storico).find(([, s]) => Object.values(s.social || {}).includes(profilo))?.[0];
        const s = em ? db.storico[em] : null;
        if (!s) return { risultato: { trovato: false }, sintesi: 'Profilo non collegato a clienti' };
        const senza = s.contatti.filter((c) => c.esito === 'nessuna risposta').length;
        const collegati = db.messaggi.filter((m) => m.email === em || (m.profilo && Object.values(s.social || {}).includes(m.profilo))).map((m) => m.id);
        return { risultato: { email: em, cliente: nomeDi(em), ...s, messaggi_collegati: collegati },
          sintesi: `${s.contatti.length} contatti precedenti${senza ? ` · ${senza} senza risposta` : ''}${collegati.length > 1 ? ` · ${collegati.length} messaggi collegati` : ''}`,
          vista: { tipo: 'contesto', messaggio: collegati[0], voce: 'storico', dati: { ...s, collegati: collegati.map((id) => ({ id, canale: CANALI[msg(id).canale] })) } } };
      },
    },
    {
      name: 'invia_risposta',
      description: 'Risponde in privato sullo stesso canale (email, chat, DM). Da usare in autonomia solo per risposte informative basate su dati verificati o per confermare azioni già approvate.',
      input_schema: { type: 'object', properties: { messaggio: { type: 'string' }, testo: { type: 'string' } }, required: ['messaggio', 'testo'] },
      etichetta: (i) => `Risposta a ${db.messaggi.find((m) => m.id === i.messaggio)?.cliente || i.messaggio}`,
      latenza: 900,
      esegui: async ({ messaggio, testo }) => {
        const m = msg(messaggio);
        if (m.pubblico) throw new Error('È un commento pubblico: usa rispondi_commento o proponi_risposta_pubblica');
        db.risposte.push({ messaggio, testo });
        if (db.stato[messaggio] === 'approvato') db.stato[messaggio] = 'risolto';
        else { db.stato[messaggio] = 'risposto'; db.conta.autonomia++; }
        // Ambiente dimostrativo: nessun invio reale
        return { risultato: { inviato: true }, sintesi: `Inviata via ${CANALI[m.canale]}`, vista: { tipo: 'risposta', messaggio, testo, stato: db.stato[messaggio] } };
      },
    },
    {
      name: 'rispondi_commento',
      description: 'Risponde in pubblico sotto un commento social. In autonomia solo per domande semplici con dati verificati e per ringraziamenti; mai per reclami.',
      input_schema: { type: 'object', properties: { messaggio: { type: 'string' }, testo: { type: 'string' } }, required: ['messaggio', 'testo'] },
      etichetta: (i) => `Risposta pubblica a ${db.messaggi.find((m) => m.id === i.messaggio)?.profilo || i.messaggio}`,
      latenza: 800,
      esegui: async ({ messaggio, testo }) => {
        const m = msg(messaggio);
        if (!m.pubblico) throw new Error('Non è un commento pubblico');
        db.risposte.push({ messaggio, testo, pubblica: true });
        db.stato[messaggio] = 'risposto'; db.conta.autonomia++;
        return { risultato: { pubblicata: true }, sintesi: `Pubblicata su ${m.canale === 'facebook' ? 'Facebook' : 'Instagram'}`, vista: { tipo: 'risposta', messaggio, testo, stato: 'risposto', pubblica: true } };
      },
    },
    {
      name: 'nascondi_commento',
      description: 'Nasconde un commento di spam evidente (link, offerte di guadagno, profili falsi). Il commento resta visibile solo al suo autore.',
      input_schema: { type: 'object', properties: { messaggio: { type: 'string' }, motivo: { type: 'string' } }, required: ['messaggio', 'motivo'] },
      etichetta: (i) => `Nascondi ${db.messaggi.find((m) => m.id === i.messaggio)?.profilo || i.messaggio}`,
      latenza: 600,
      esegui: async ({ messaggio, motivo }) => {
        msg(messaggio);
        db.stato[messaggio] = 'nascosto'; db.conta.nascosti++;
        return { risultato: { nascosto: true }, sintesi: 'Spam nascosto', vista: { tipo: 'stato', messaggio, stato: 'nascosto', motivo } };
      },
    },
    {
      name: 'proponi_risposta_pubblica',
      description: 'Propone la risposta pubblica a un commento negativo o a un reclamo. Viene pubblicata solo dopo l\'approvazione di un operatore.',
      input_schema: { type: 'object', properties: { messaggio: { type: 'string' }, testo: { type: 'string' } }, required: ['messaggio', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Risposta pubblica a ${db.messaggi.find((m) => m.id === i.messaggio)?.profilo || i.messaggio}`,
      anteprima: (i) => { const m = msg(i.messaggio); return { tipo: 'pubblica', ...i, canale: m.canale, profilo: m.profilo, commento: m.testo, post: m.post }; },
      latenza: 600,
      esegui: async ({ messaggio, testo }) => {
        db.risposte.push({ messaggio, testo, pubblica: true });
        db.conta.approvate++;
        return { risultato: { pubblicata: true }, sintesi: 'Pubblicata dopo l\'approvazione', vista: { tipo: 'risposta', messaggio, testo, stato: 'risposto', pubblica: true } };
      },
    },
    {
      name: 'avvia_sostituzione',
      description: 'Avvia la sostituzione o il rimborso di un articolo difettoso, con ritiro gratuito. Richiede l\'approvazione di un operatore.',
      input_schema: { type: 'object', properties: {
        ordine: { type: 'string' }, tipo: { type: 'string', enum: ['sostituzione', 'rimborso'] }, motivo: { type: 'string' } }, required: ['ordine', 'tipo', 'motivo'] },
      approvazione: true,
      etichetta: (i) => `${i.tipo === 'rimborso' ? 'Rimborso' : 'Sostituzione'} ${i.ordine}`,
      anteprima: (i) => { const o = ordine(i.ordine); return { tipo: 'sostituzione', ...i, articolo: o.articoli[0].nome, importo: o.articoli[0].prezzo, cliente: nomeDi(o.cliente) }; },
      latenza: 700,
      esegui: async ({ ordine: n, tipo }) => {
        const o = ordine(n);
        const m = msgDi(n);
        db.azioni.push({ tipo, ordine: n }); db.conta.approvate++;
        db.stato[m] = 'approvato';
        return { risultato: { avviata: tipo, ritiro: 'prenotato con il corriere', valore: o.articoli[0].prezzo }, sintesi: `${tipo === 'rimborso' ? 'Rimborso' : 'Sostituzione'} avviata · ritiro prenotato`, vista: { tipo: 'stato', messaggio: m, stato: 'approvato' } };
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
        const m = msgDi(n);
        db.azioni.push({ tipo: 'indirizzo', ordine: n }); db.conta.approvate++;
        db.stato[m] = 'approvato';
        return { risultato: { aggiornato: true, indirizzo }, sintesi: 'Indirizzo corretto', vista: { tipo: 'stato', messaggio: m, stato: 'approvato' } };
      },
    },
    {
      name: 'passa_a_operatore',
      description: 'Passa un caso a un operatore umano con riepilogo e proposta di soluzione. Per clienti molto insoddisfatti, solleciti ripetuti, reclami pubblici, richieste fuori dalle politiche. Può includere più messaggi dello stesso cliente su canali diversi.',
      input_schema: { type: 'object', properties: {
        messaggi: { type: 'array', items: { type: 'string' } }, operatore: { type: 'string' }, riepilogo: { type: 'string' }, proposta: { type: 'string' }, priorita: { type: 'string', enum: ['alta', 'normale'] } },
        required: ['messaggi', 'operatore', 'riepilogo', 'proposta'] },
      etichetta: (i) => `A ${i.operatore}${i.messaggi.length > 1 ? ` · ${i.messaggi.length} canali` : ''}`,
      latenza: 800,
      esegui: async (x) => {
        x.messaggi.forEach((id) => { msg(id); if (!db.stato[id]) db.stato[id] = 'operatore'; });
        db.operatore.push(x);
        return { risultato: { assegnato: x.operatore }, sintesi: `Assegnato a ${x.operatore}${x.priorita === 'alta' ? ' · priorità alta' : ''}`, vista: { tipo: 'operatore', ...x, messaggio: x.messaggi[0] } };
      },
    },
    {
      name: 'scrivi_riepilogo',
      description: 'Pubblica il riepilogo del turno per il team. I conteggi li calcola lo strumento dallo stato reale; tu scrivi la sintesi.',
      input_schema: { type: 'object', properties: { sintesi: { type: 'string' } }, required: ['sintesi'] },
      etichetta: () => 'Riepilogo per il team',
      latenza: 900,
      esegui: async ({ sintesi }) => {
        const r = { sintesi, negozio: db.negozio, data: db.oggi, messaggi: db.messaggi.length,
          risposti_in_autonomia: db.conta.autonomia, con_approvazione: db.conta.approvate, nascosti: db.conta.nascosti, a_operatore: db.operatore.length,
          aperti: db.messaggi.length - Object.keys(db.stato).length,
          operatore: db.operatore.map(({ messaggi, operatore, proposta }) => ({ messaggi, operatore, proposta, cliente: msg(messaggi[0]).cliente })) };
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'riepilogo.json'), JSON.stringify(r, null, 1));
        return { risultato: r, sintesi: `${r.messaggi - r.aperti} su ${r.messaggi} gestiti`, output: { tipo: 'riepilogo', contenuto: r } };
      },
    },
  ];

  return {
    info: { nome: 'Comitas', ruolo: 'Agente per clienti e social', negozio: db.negozio, oggi: db.oggi, operatori: db.operatori },
    compito: 'Gestisci messaggi e commenti arrivati stamattina su tutti i canali: rispondi, modera, risolvi o passa a un operatore, e chiudi con il riepilogo per il team.',
    sistema: [
      'Sei Comitas, l\'agente che segue clienti e social di Casa Ortensia, negozio online di tessili e arredo per la casa. Scrivi in italiano, con tono cordiale e diretto: del tu in chat, DM e commenti, del lei via email.',
      'Regole:',
      '1. Prima di rispondere recupera i dati: ordine, tracciamento, storico del cliente (anche tra canali), base di conoscenza. Non inventare date, misure o politiche.',
      '2. Alle richieste informative rispondi da solo: in privato con invia_risposta, in pubblico con rispondi_commento. Ai complimenti rispondi in pubblico con un ringraziamento breve.',
      '3. Lo spam evidente si nasconde con nascondi_commento.',
      '4. Sostituzioni, rimborsi, modifiche agli ordini e risposte pubbliche ai reclami passano dagli strumenti che richiedono approvazione. Dopo l\'approvazione conferma al cliente.',
      '5. Clienti molto insoddisfatti, solleciti ripetuti o reclami su più canali vanno a un operatore con passa_a_operatore, collegando tutti i messaggi della stessa persona. In pubblico non discutere il caso: invita a proseguire in privato.',
      '6. Chiudi con scrivi_riepilogo. Mentre lavori scrivi frasi brevi su cosa stai facendo.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: { messaggi: () => db.messaggi },
  };
}
