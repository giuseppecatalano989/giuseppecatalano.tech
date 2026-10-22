// Quadra — agente per il ciclo passivo e il ciclo attivo delle fatture.
// Passivo: legge le fatture elettroniche arrivate, le confronta con ordini, bolle di consegna e anagrafica
// (controllo a tre vie), registra quelle conformi e propone sospensioni ed email per le anomalie.
// Attivo: prepara le fatture ai clienti dalle consegne (DDT) con i prezzi degli ordini, controlla anagrafica e
// codice destinatario SDI, abbina gli incassi della banca alle fatture aperte e individua lo scaduto.
// In autonomia: verifiche, registrazioni, bozze e abbinamenti. Con approvazione: blocchi, email, invio allo SDI, solleciti.
// I dati di prova (aziende, persone, IBAN) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

const euro = (n) => Math.round(n * 100) / 100;
const iso = (x) => x.toISOString().slice(0, 10);
const piu = (s, n) => iso(new Date(Date.parse(s + 'T12:00:00Z') + n * 86400000));
const fineMese = (s) => { const x = new Date(s + 'T12:00:00Z'); return iso(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0, 12))); };
const scadenza = (data, t) => (t.fine_mese ? fineMese(piu(fineMese(data), t.giorni)) : piu(data, t.giorni));
const giorniTra = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    const a = leggi('archivio.json');
    db = { fatture: leggi('fatture.json'), ...a, esiti: {}, registrate: [], sospese: [], contestate: [], uscita: [],
      attivo: leggi('ciclo_attivo.json'), bozze: {}, emesse: [], incassi: null, solleciti: [] };
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
      name: 'leggi_ciclo_attivo',
      description: 'Ciclo attivo: elenca le consegne ai clienti (DDT) ancora da fatturare, le fatture emesse non ancora incassate e i movimenti in entrata della banca da riconciliare.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Ciclo attivo',
      latenza: 900,
      esegui: async () => {
        const A = db.attivo;
        const ddt = A.ddt_da_fatturare.map((d) => ({ ...d, cliente: A.ordini_cliente.find((o) => o.numero === d.ordine)?.cliente }));
        return { risultato: { da_fatturare: ddt, fatture_aperte: A.fatture_emesse_aperte, movimenti: A.movimenti_banca },
          sintesi: `${ddt.length} consegne da fatturare · ${A.fatture_emesse_aperte.length} fatture aperte · ${A.movimenti_banca.length} movimenti`,
          vista: { tipo: 'attivo', ddt, aperte: A.fatture_emesse_aperte, movimenti: A.movimenti_banca } };
      },
    },
    {
      name: 'prepara_fattura_attiva',
      description: 'Prepara la bozza della fattura al cliente per un DDT: quantità dal documento di trasporto, prezzi dall\'ordine cliente, IVA, totale e scadenza dai termini di pagamento. Controlla che il DDT non sia già fatturato e che l\'anagrafica abbia codice destinatario SDI o PEC. Restituisce la bozza con esito pronta o da completare.',
      input_schema: { type: 'object', properties: { ddt: { type: 'string', description: 'Numero del DDT, es. DDT V-5512' } }, required: ['ddt'] },
      etichetta: (i) => `Fattura ${i.ddt.replace('DDT ', '')}`,
      latenza: 1100,
      esegui: async ({ ddt }) => {
        const A = db.attivo;
        const d = A.ddt_da_fatturare.find((x) => x.numero === ddt);
        if (!d) throw new Error(`${ddt} non è tra le consegne da fatturare`);
        if (Object.values(db.bozze).some((b) => b.ddt === ddt)) throw new Error(`${ddt} è già in una fattura`);
        const ordine = A.ordini_cliente.find((o) => o.numero === d.ordine);
        const cliente = A.clienti.find((c) => c.nome === ordine.cliente);
        const righe = d.righe.map((r) => {
          const ro = ordine.righe.find((x) => x.codice === r.codice);
          if (!ro) throw new Error(`Articolo ${r.codice} non presente nell'ordine ${ordine.numero}`);
          return { codice: r.codice, descrizione: ro.descrizione, quantita: r.quantita, prezzo: ro.prezzo, importo: euro(r.quantita * ro.prezzo) };
        });
        const imponibile = euro(righe.reduce((s, r) => s + r.importo, 0));
        const iva = euro(imponibile * 0.22), totale = euro(imponibile + iva);
        const mancanti = [];
        if (!cliente.codice_destinatario && !cliente.pec) mancanti.push('codice destinatario SDI o PEC');
        const controlli = [
          { nome: 'Prezzi dall’ordine cliente', ok: true }, { nome: 'Quantità dal DDT', ok: true }, { nome: 'DDT non già fatturato', ok: true },
          { nome: 'Codice destinatario SDI', ok: !mancanti.length }, { nome: 'IVA e totale', ok: true },
        ];
        const pronta = !mancanti.length;
        const numero = pronta ? `FV-2026/${String(A.prossimo_numero++).padStart(4, '0')}` : null;
        const b = { id: numero || `BOZZA-${ddt.split(' ').pop()}`, numero, ddt, ordine: ordine.numero, cliente: cliente.nome, nuovo_cliente: !!cliente.nuovo, data: db.oggi,
          righe, imponibile, iva, totale, pagamento: cliente.pagamento.testo, scadenza: scadenza(db.oggi, cliente.pagamento), esito: pronta ? 'pronta' : 'da_completare', mancanti, controlli };
        db.bozze[b.id] = b;
        return { risultato: b, sintesi: pronta ? `${numero} · ${fmt(totale)} · scade il ${b.scadenza.split('-').reverse().slice(0, 2).join('/')}` : `Da completare · manca il ${mancanti.join(', ')}`,
          vista: { tipo: 'bozza', ...b } };
      },
    },
    {
      name: 'emetti_fatture',
      description: 'Invia allo SDI le fatture attive pronte. Richiede l\'approvazione della persona.',
      input_schema: { type: 'object', properties: { fatture: { type: 'array', items: { type: 'string' } } }, required: ['fatture'] },
      approvazione: true,
      etichetta: (i) => `Invio allo SDI · ${i.fatture.length} fatture`,
      anteprima: (i) => ({ tipo: 'sdi', fatture: i.fatture.map((n) => { const b = db.bozze[n]; if (!b) throw new Error(`Bozza ${n} inesistente`); return { numero: n, cliente: b.cliente, totale: b.totale, scadenza: b.scadenza }; }) }),
      latenza: 700,
      esegui: async ({ fatture }) => {
        for (const n of fatture) { const b = db.bozze[n]; if (b?.esito !== 'pronta') throw new Error(`La fattura ${n} non è pronta per l'invio`); b.esito = 'inviata'; db.emesse.push(n); }
        return { risultato: { inviate: fatture }, sintesi: `${fatture.length} fatture inviate allo SDI`, vista: { tipo: 'emesse', numeri: fatture } };
      },
    },
    {
      name: 'riconcilia_incassi',
      description: 'Abbina i movimenti in entrata della banca alle fatture emesse aperte: prima per numero di fattura nella causale, poi per cliente e importo esatto. Segna le fatture incassate e restituisce le fatture scadute non pagate, con i giorni di ritardo.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Riconciliazione incassi',
      latenza: 1300,
      esegui: async () => {
        const A = db.attivo;
        const aperte = A.fatture_emesse_aperte.map((f) => ({ ...f }));
        const abbinati = [], non_abbinati = [];
        for (const m of A.movimenti_banca) {
          const numeri = (m.causale.match(/\d+/g) || []).map(Number);
          let f = aperte.find((x) => !x.incassata && x.cliente === m.ordinante && numeri.includes(Number(x.numero.split('/')[1])) && Math.abs(x.totale - m.importo) < 0.01);
          let metodo = 'riferimento in causale';
          if (!f) {
            const c = aperte.filter((x) => !x.incassata && x.cliente === m.ordinante && Math.abs(x.totale - m.importo) < 0.01);
            if (c.length === 1) { f = c[0]; metodo = 'cliente e importo'; }
          }
          if (f) { f.incassata = m.data; abbinati.push({ movimento: m.id, data: m.data, cliente: m.ordinante, fattura: f.numero, importo: m.importo, metodo }); }
          else non_abbinati.push({ ...m, motivo: A.clienti.some((c) => c.nome === m.ordinante) ? 'nessuna fattura con questo importo' : 'ordinante non presente tra i clienti' });
        }
        const scadute = aperte.filter((f) => !f.incassata && f.scadenza < db.oggi).map((f) => ({ ...f, giorni_ritardo: giorniTra(f.scadenza, db.oggi) }));
        db.incassi = { abbinati, non_abbinati, scadute, aperte };
        const tot = euro(abbinati.reduce((s, a) => s + a.importo, 0));
        return { risultato: db.incassi, sintesi: `${abbinati.length} incassi abbinati · ${scadute.length === 1 ? '1 fattura scaduta' : `${scadute.length} fatture scadute`}`,
          vista: { tipo: 'incassi', abbinati, non_abbinati, scadute, aperte, totale: tot } };
      },
    },
    {
      name: 'prepara_sollecito',
      description: 'Prepara un sollecito di pagamento al cliente per le fatture scadute. Viene inviato solo dopo l\'approvazione della persona.',
      input_schema: { type: 'object', properties: {
        cliente: { type: 'string' }, fatture: { type: 'array', items: { type: 'string' } }, a: { type: 'string' }, oggetto: { type: 'string' }, testo: { type: 'string' },
      }, required: ['cliente', 'fatture', 'a', 'oggetto', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Sollecito a ${i.cliente.split(' ').slice(0, 2).join(' ')}`,
      anteprima: (i) => ({ tipo: 'sollecito', ...i }),
      latenza: 600,
      esegui: async (m) => {
        const sc = db.incassi?.scadute.map((f) => f.numero) || [];
        m.fatture.forEach((n) => { if (!sc.includes(n)) throw new Error(`La fattura ${n} non risulta scaduta`); });
        db.solleciti.push(m); db.uscita.push(m);
        return { risultato: { stato: 'in posta in uscita' }, sintesi: 'Approvato · in uscita', vista: { tipo: 'sollecitate', numeri: m.fatture } };
      },
    },
    {
      name: 'scrivi_riepilogo',
      description: 'Pubblica il riepilogo per l\'amministrazione, ciclo passivo e ciclo attivo. I totali (registrato, bloccato, contestato, importo a rischio, fatture emesse, incassi abbinati, scaduto) li calcola lo strumento dallo stato reale: tu scrivi la sintesi e le note.',
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
        const bozze = Object.values(db.bozze);
        if (bozze.length || db.incassi) {
          const inc = db.incassi || { abbinati: [], non_abbinati: [], scadute: [] };
          r.attivo = {
            emesse: { n: db.emesse.length, importo: euro(db.emesse.reduce((s, n) => s + db.bozze[n].totale, 0)) },
            da_completare: bozze.filter((b) => b.esito === 'da_completare').map((b) => ({ cliente: b.cliente, ddt: b.ddt, manca: b.mancanti.join(', '), totale: b.totale })),
            incassato: { n: inc.abbinati.length, importo: euro(inc.abbinati.reduce((s, a) => s + a.importo, 0)) },
            scaduto: { n: inc.scadute.length, importo: euro(inc.scadute.reduce((s, f) => s + f.totale, 0)) },
            solleciti: db.solleciti.length, movimenti_da_verificare: inc.non_abbinati.length,
          };
        }
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'riepilogo.json'), JSON.stringify(r, null, 1));
        return { risultato: r, sintesi: r.attivo ? `Protetti ${fmt(r.importo_a_rischio)} · incassati ${fmt(r.attivo.incassato.importo)}` : `Protetti ${fmt(r.importo_a_rischio)}`, output: { tipo: 'riepilogo', contenuto: r } };
      },
    },
  ];

  return {
    info: { nome: 'Quadra', ruolo: 'Agente per il ciclo passivo e attivo delle fatture', azienda: db.azienda, oggi: db.oggi },
    compito: 'Controlla le fatture fornitori arrivate dallo SDI: registra quelle conformi e gestisci le anomalie. Poi il ciclo attivo: prepara le fatture ai clienti dalle consegne da fatturare, riconcilia gli incassi e gestisci lo scaduto. Chiudi con il riepilogo per l\'amministrazione.',
    sistema: [
      'Sei Quadra, un agente che affianca l\'ufficio amministrativo di un\'azienda italiana nel ciclo passivo e nel ciclo attivo. Rispondi sempre in italiano, in modo conciso.',
      'Regole:',
      '1. Ogni fattura passa da verifica_fattura prima di qualunque decisione. Puoi verificare più fatture nello stesso turno.',
      '2. Non fare mai conti a mano: differenze, totali e importi a rischio vengono dagli strumenti.',
      '3. Le fatture conformi le registri in autonomia con registra_fattura.',
      '4. Un IBAN diverso dall\'anagrafica è un possibile tentativo di frode: controlla lo storico del fornitore, blocca il pagamento e chiedi una verifica telefonica al numero già in anagrafica, mai ai contatti indicati in fattura.',
      '5. I doppioni si bloccano. Le differenze di prezzo o di quantità si contestano al fornitore chiedendo una nota di credito o la consegna mancante.',
      '6. Blocchi di pagamento ed email passano dalla persona: proponili con gli strumenti che richiedono approvazione.',
      '7. Ciclo attivo: prepara ogni fattura ai clienti con prepara_fattura_attiva, mai a mano. Una bozza da completare (per esempio senza codice destinatario SDI) non si invia: segnala cosa manca.',
      '8. L\'invio allo SDI e i solleciti ai clienti passano dalla persona. Abbina gli incassi con riconcilia_incassi; i movimenti non abbinati restano all\'amministrazione. I solleciti sono cortesi e citano numero, data, importo e scadenza.',
      '9. Chiudi con scrivi_riepilogo. Mentre lavori scrivi frasi brevi su cosa stai facendo e perché.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: {
      fatture: () => db.fatture,
      archivio: () => ({ azienda: db.azienda, fornitori: db.fornitori.length, ordini: db.ordini.length, ddt: db.ddt.length }),
      attivo: () => db.attivo,
    },
  };
}
