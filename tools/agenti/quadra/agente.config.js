// Quadra — agente per il controllo delle fatture fornitori (ciclo passivo).
// Legge le fatture elettroniche arrivate, le confronta con ordini, bolle di consegna e anagrafica
// (controllo a tre vie), registra quelle conformi e propone sospensioni ed email per le anomalie.
// Le fatture conformi si registrano in autonomia; pagamenti ed email richiedono approvazione.
// I dati di prova (aziende, persone, IBAN) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

const euro = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    const a = leggi('archivio.json');
    db = { fatture: leggi('fatture.json'), ...a, esiti: {}, registrate: [], sospese: [], contestate: [], uscita: [] };
  };
  reimposta();
  const fattura = (id) => {
    const f = db.fatture.find((x) => x.id === id);
    if (!f) throw new Error(`Fattura ${id} non trovata`);
    return f;
  };

  // Controllo a tre vie: fattura ↔ ordine (prezzi, quantità) ↔ bolle di consegna (quantità ricevute),
  // più doppioni nel registro, IBAN rispetto all'anagrafica e coerenza dei conti.
  function verifica(f) {
    const anomalie = [];
    const confronto = [];
    const forn = db.fornitori.find((x) => x.piva === f.piva);
    const ordine = db.ordini.find((o) => o.numero === f.ordine);
    const bolle = db.ddt.filter((d) => d.ordine === f.ordine);
    if (!ordine) anomalie.push({ tipo: 'ordine_mancante', gravita: 'alta', descrizione: `Nessun ordine ${f.ordine}`, importo: euro(f.imponibile) });
    for (const r of f.righe) {
      const ro = ordine?.righe.find((x) => x.codice === r.codice);
      const ricevuti = ordine?.servizio ? null : bolle.reduce((s, b) => s + (b.righe.find((x) => x.codice === r.codice)?.quantita || 0), 0);
      confronto.push({ codice: r.codice, descrizione: r.descrizione,
        ordine: ro ? { quantita: ro.quantita, prezzo: ro.prezzo } : null,
        consegnati: ricevuti, fattura: { quantita: r.quantita, prezzo: r.prezzo } });
      if (ro && Math.abs(ro.prezzo - r.prezzo) > 0.001) {
        const diff = euro((r.prezzo - ro.prezzo) * r.quantita);
        anomalie.push({ tipo: 'prezzo', gravita: 'media', codice: r.codice,
          descrizione: `Prezzo ${fmt(r.prezzo)} invece di ${fmt(ro.prezzo)} dell'ordine, su ${r.quantita} pezzi`, importo: diff });
      }
      if (ricevuti != null && r.quantita > ricevuti) {
        const diff = euro((r.quantita - ricevuti) * r.prezzo);
        anomalie.push({ tipo: 'quantita', gravita: 'media', codice: r.codice,
          descrizione: `Fatturati ${r.quantita} pezzi, consegnati ${ricevuti}`, importo: diff });
      }
    }
    const doppione = db.registro.find((x) => x.fornitore === f.fornitore && x.numero === f.numero);
    if (doppione) anomalie.push({ tipo: 'doppione', gravita: 'alta', descrizione: `Già registrata il ${doppione.data_registrazione.split('-').reverse().join('/')}, stesso importo`, importo: euro(f.imponibile) });
    if (forn && forn.iban !== f.iban) anomalie.push({ tipo: 'iban', gravita: 'alta', descrizione: `IBAN in fattura diverso da quello in anagrafica`, iban_fattura: f.iban, iban_anagrafica: forn.iban, importo: euro(f.imponibile) });
    if (Math.abs(euro(f.imponibile * f.aliquota_iva / 100) - f.iva) > 0.01 || Math.abs(euro(f.imponibile + f.iva) - f.totale) > 0.01)
      anomalie.push({ tipo: 'importi', gravita: 'alta', descrizione: 'Imponibile, IVA e totale non tornano' });
    // Importo a rischio (IVA compresa): per i doppioni e gli IBAN sospetti è l'intera fattura
    const aRischio = anomalie.some((a) => a.tipo === 'doppione' || a.tipo === 'iban')
      ? f.totale
      : euro(anomalie.reduce((s, a) => s + (a.importo || 0), 0) * (1 + f.aliquota_iva / 100));
    const esito = anomalie.length === 0 ? 'conforme' : anomalie.some((a) => a.gravita === 'alta') ? 'bloccare' : 'contestare';
    return { id: f.id, fornitore: f.fornitore, numero: f.numero, totale: f.totale, esito, anomalie, importo_a_rischio: anomalie.length ? euro(aRischio) : 0, confronto, bolle: bolle.map((b) => b.numero) };
  }

  const strumenti = [
    {
      name: 'leggi_fatture_in_arrivo',
      description: 'Elenca le fatture elettroniche arrivate dallo SDI e non ancora registrate.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Fatture in arrivo dallo SDI',
      latenza: 900,
      esegui: async () => {
        const r = db.fatture.map(({ id, fornitore, numero, data, totale, ordine }) => ({ id, fornitore, numero, data, totale, ordine }));
        const tot = euro(r.reduce((s, x) => s + x.totale, 0));
        return { risultato: { fatture: r, totale: tot }, sintesi: `${r.length} fatture · ${fmt(tot)}`, vista: { tipo: 'arrivo', fatture: r } };
      },
    },
    {
      name: 'verifica_fattura',
      description: 'Controllo a tre vie di una fattura: confronta righe, prezzi e quantità con l\'ordine e con le bolle di consegna, cerca doppioni nel registro, confronta l\'IBAN con l\'anagrafica, verifica imponibile, IVA e totale. Restituisce esito (conforme, contestare, bloccare), anomalie e importo a rischio.',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      etichetta: (i) => `Verifica ${i.id}`,
      // In demo, dopo una fattura con anomalie si lascia il tempo di leggerla
      latenza: () => (Object.values(db.esiti).at(-1)?.esito ?? 'conforme') === 'conforme' ? 750 : 2100,
      esegui: async ({ id }) => {
        const v = verifica(fattura(id));
        db.esiti[id] = v;
        const sintesi = v.esito === 'conforme' ? 'Conforme' : `${v.anomalie.map((a) => ({ prezzo: 'Prezzo', quantita: 'Quantità', doppione: 'Doppione', iban: 'IBAN diverso', importi: 'Importi', ordine_mancante: 'Senza ordine' }[a.tipo])).join(', ')} · ${fmt(v.importo_a_rischio)}`;
        return { risultato: v, sintesi, vista: { tipo: 'verifica', ...v } };
      },
    },
    {
      name: 'storico_fornitore',
      description: 'Storico dei pagamenti a un fornitore: numero di pagamenti, IBAN usati, comunicazioni di variazione dell\'IBAN ricevute.',
      input_schema: { type: 'object', properties: { fornitore: { type: 'string' } }, required: ['fornitore'] },
      etichetta: (i) => `Storico ${i.fornitore.split(' ')[0]} ${i.fornitore.split(' ')[1] || ''}`.trim(),
      latenza: 800,
      esegui: async ({ fornitore }) => {
        const s = db.storico_pagamenti[fornitore] || { pagamenti: 0, iban_usati: [], comunicazioni_variazione_iban: 0 };
        return { risultato: { fornitore, ...s }, sintesi: `${s.pagamenti} pagamenti · ${s.iban_usati.length} IBAN · ${s.comunicazioni_variazione_iban} variazioni comunicate` };
      },
    },
    {
      name: 'registra_fattura',
      description: 'Registra in contabilità e nello scadenzario una fattura risultata conforme alla verifica. Rifiuta le fatture non conformi.',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      etichetta: (i) => `Registra ${i.id}`,
      latenza: 700,
      esegui: async ({ id }) => {
        const f = fattura(id);
        if (db.esiti[id]?.esito !== 'conforme') throw new Error('Si registrano solo fatture verificate e conformi');
        db.registrate.push(id);
        db.registro.push({ fornitore: f.fornitore, numero: f.numero, data_registrazione: db.oggi, totale: f.totale });
        return { risultato: { registrata: true, scadenza: f.scadenza }, sintesi: `Registrata · scade il ${f.scadenza.split('-').reverse().slice(0, 2).join('/')}`, vista: { tipo: 'stato', id, stato: 'registrata' } };
      },
    },
    {
      name: 'sospendi_pagamento',
      description: 'Blocca il pagamento di una o più fatture, con il motivo per ciascuna. Richiede l\'approvazione della persona.',
      input_schema: { type: 'object', properties: {
        fatture: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, motivo: { type: 'string' } }, required: ['id', 'motivo'] } },
      }, required: ['fatture'] },
      approvazione: true,
      etichetta: (i) => `Blocca ${i.fatture.length} pagamenti`,
      anteprima: (i) => ({ tipo: 'blocco', fatture: i.fatture.map((x) => ({ ...x, fornitore: fattura(x.id).fornitore, totale: fattura(x.id).totale })) }),
      latenza: 600,
      esegui: async ({ fatture }) => {
        fatture.forEach((x) => { fattura(x.id); db.sospese.push(x.id); });
        return { risultato: { bloccate: fatture.map((x) => x.id) }, sintesi: `${fatture.length} pagamenti bloccati`, vista: { tipo: 'stati', ids: fatture.map((x) => x.id), stato: 'bloccata' } };
      },
    },
    {
      name: 'prepara_email',
      description: 'Prepara un\'email a un fornitore (contestazione, richiesta di nota di credito, verifica). Viene inviata solo dopo l\'approvazione della persona.',
      input_schema: { type: 'object', properties: {
        fattura: { type: 'string', description: 'Id della fattura a cui si riferisce' }, a: { type: 'string' }, oggetto: { type: 'string' }, testo: { type: 'string' },
      }, required: ['a', 'oggetto', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Email a ${i.a.split(' (')[0]}`,
      anteprima: (i) => ({ tipo: 'email', ...i }),
      latenza: 600,
      esegui: async (mail) => {
        db.uscita.push(mail);
        if (mail.fattura && !db.contestate.includes(mail.fattura)) db.contestate.push(mail.fattura);
        // Ambiente dimostrativo: l'email resta nella posta in uscita locale, nessun invio reale
        return { risultato: { stato: 'in posta in uscita' }, sintesi: 'Approvata · in uscita', vista: mail.fattura ? { tipo: 'stato', id: mail.fattura, stato: 'contestata' } : null };
      },
    },
    {
      name: 'scrivi_riepilogo',
      description: 'Pubblica il riepilogo del controllo per l\'amministrazione. I totali (registrato, bloccato, contestato, importo a rischio) li calcola lo strumento dallo stato reale: tu scrivi la sintesi e le note.',
      input_schema: { type: 'object', properties: {
        sintesi: { type: 'string' },
        note: { type: 'array', items: { type: 'object', properties: { fattura: { type: 'string' }, testo: { type: 'string' } } } },
      }, required: ['sintesi'] },
      etichetta: () => 'Riepilogo per l\'amministrazione',
      latenza: 1100,
      esegui: async ({ sintesi, note = [] }) => {
        const somma = (ids) => euro(ids.reduce((s, id) => s + fattura(id).totale, 0));
        const verificate = Object.values(db.esiti);
        const r = {
          sintesi, note, azienda: db.azienda, data: db.oggi,
          fatture: db.fatture.length,
          totale_ricevuto: euro(db.fatture.reduce((s, f) => s + f.totale, 0)),
          registrato: { n: db.registrate.length, importo: somma(db.registrate) },
          bloccato: { n: db.sospese.length, importo: somma(db.sospese) },
          contestato: { n: db.contestate.length, importo: somma(db.contestate) },
          importo_a_rischio: euro(verificate.reduce((s, v) => s + v.importo_a_rischio, 0)),
          righe: db.fatture.map((f) => ({ id: f.id, fornitore: f.fornitore, totale: f.totale,
            stato: db.registrate.includes(f.id) ? 'registrata' : db.sospese.includes(f.id) ? 'bloccata' : db.contestate.includes(f.id) ? 'contestata' : 'da verificare',
            a_rischio: db.esiti[f.id]?.importo_a_rischio || 0 })),
        };
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'riepilogo.json'), JSON.stringify(r, null, 1));
        return { risultato: r, sintesi: `Protetti ${fmt(r.importo_a_rischio)}`, output: { tipo: 'riepilogo', contenuto: r } };
      },
    },
  ];

  return {
    info: { nome: 'Quadra', ruolo: 'Agente per il controllo delle fatture fornitori', azienda: db.azienda, oggi: db.oggi },
    compito: 'Controlla le fatture fornitori arrivate dallo SDI: registra quelle conformi, gestisci le anomalie e prepara il riepilogo per l\'amministrazione.',
    sistema: [
      'Sei Quadra, un agente che affianca l\'ufficio amministrativo di un\'azienda italiana nel ciclo passivo. Rispondi sempre in italiano, in modo conciso.',
      'Regole:',
      '1. Ogni fattura passa da verifica_fattura prima di qualunque decisione. Puoi verificare più fatture nello stesso turno.',
      '2. Non fare mai conti a mano: differenze, totali e importi a rischio vengono dagli strumenti.',
      '3. Le fatture conformi le registri in autonomia con registra_fattura.',
      '4. Un IBAN diverso dall\'anagrafica è un possibile tentativo di frode: controlla lo storico del fornitore, blocca il pagamento e chiedi una verifica telefonica al numero già in anagrafica, mai ai contatti indicati in fattura.',
      '5. I doppioni si bloccano. Le differenze di prezzo o di quantità si contestano al fornitore chiedendo una nota di credito o la consegna mancante.',
      '6. Blocchi di pagamento ed email passano dalla persona: proponili con gli strumenti che richiedono approvazione.',
      '7. Chiudi con scrivi_riepilogo. Mentre lavori scrivi frasi brevi su cosa stai facendo e perché.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: {
      fatture: () => db.fatture,
      archivio: () => ({ azienda: db.azienda, fornitori: db.fornitori.length, ordini: db.ordini.length, ddt: db.ddt.length }),
    },
  };
}
