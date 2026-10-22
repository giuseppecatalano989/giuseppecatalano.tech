// Metis — agente di pianificazione per il project manager.
// Legge il brief del progetto, le offerte dei fornitori, le attività del team, le email del progetto e le call
// registrate (Granola, Notion); costruisce il piano a step
// con dipendenze e calendario (festivi, chiusure), trova il percorso critico, simula varianti per
// rispettare la data, genera la matrice di chi fa cosa, lo schema dei SAL e il report per il cliente,
// e prepara le richieste ai fornitori, che partono solo dopo l'approvazione.
// I dati di prova (azienda, fornitori, importi) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

const GIORNO = 86400000;
const d = (s) => new Date(s + 'T12:00:00Z');
const iso = (x) => x.toISOString().slice(0, 10);
const breve = (s) => d(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const euro = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: 'always' }) + ' €';

// Calendario: lunedì–venerdì, esclusi festivi e chiusura natalizia
const FESTIVI = new Set(['2026-12-08', '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06']);
const CHIUSURA = ['2026-12-24', '2027-01-06'];
const lavorativo = (s) => { const g = d(s).getUTCDay(); return g !== 0 && g !== 6 && !FESTIVI.has(s) && !(s >= CHIUSURA[0] && s <= CHIUSURA[1]); };
const piu = (s, n) => iso(new Date(d(s).getTime() + n * GIORNO));
const prossimoLavorativo = (s) => { let x = s; while (!lavorativo(x)) x = piu(x, 1); return x; };
const dopo = (s) => prossimoLavorativo(piu(s, 1));
function fineDopo(inizio, durata) { let x = inizio, n = 1; while (n < durata) { x = dopo(x); n++; } return x; }
const lavorativiTra = (a, b) => { let n = 0, x = a; while (x < b) { x = piu(x, 1); if (lavorativo(x)) n++; } return n; };

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => { db = { brief: leggi('brief.json'), fornitori: leggi('fornitori.json'), team: leggi('team.json'), posta: leggi('email.json'), call: leggi('call.json').call, piano: null, base: null, uscita: [] }; };
  reimposta();
  const nomeDi = (chi) => db.brief.parti.find((p) => p.chi === chi)?.nome || chi;

  // Pianificazione in avanti sul calendario; per ogni attività si ricorda il predecessore che ne fissa l'inizio
  function pianifica(attivita) {
    const per = new Map(attivita.map((a) => [a.id, { ...a }]));
    const fatti = new Map();
    const visita = (id, pila = []) => {
      if (fatti.has(id)) return fatti.get(id);
      if (pila.includes(id)) throw new Error(`Dipendenza circolare: ${[...pila, id].join(' → ')}`);
      const a = per.get(id);
      if (!a) throw new Error(`Attività sconosciuta: ${id}`);
      let inizio = a.non_prima_del || db.brief.oggi, guida = null;
      for (const p of a.dipende_da || []) {
        const r = visita(p, [...pila, id]);
        const candidato = r.milestone ? r.fine : r.tipo === 'weekend' ? piu(r.fine, 1) : piu(r.fine, 1);
        if (candidato > inizio || (candidato === inizio && !guida)) { inizio = candidato; guida = p; }
      }
      let r;
      if (a.milestone) {
        const g = a.dipende_da?.length ? prossimoLavorativo(inizio) : inizio;
        r = { ...a, inizio: g, fine: g, guida };
      } else if (a.tipo === 'weekend') {
        let s = inizio; while (d(s).getUTCDay() !== 6) s = piu(s, 1);
        r = { ...a, inizio: s, fine: piu(s, 1), guida };
      } else {
        const s = prossimoLavorativo(inizio);
        r = { ...a, inizio: s, fine: fineDopo(s, a.durata), guida };
      }
      r.attraversa_chiusura = !a.milestone && r.inizio < CHIUSURA[0] && r.fine > CHIUSURA[1];
      fatti.set(id, r);
      return r;
    };
    attivita.forEach((a) => visita(a.id));
    const righe = attivita.map((a) => fatti.get(a.id));
    const ultima = righe.reduce((m, r) => (r.fine > m.fine ? r : m), righe[0]);
    // Percorso critico: dalla fine, di predecessore guida in predecessore guida
    const critico = [];
    for (let x = ultima; x; x = x.guida ? fatti.get(x.guida) : null) critico.unshift(x.id);
    righe.forEach((r) => { r.critica = critico.includes(r.id); });
    const target = db.brief.apertura.data;
    const apertura = righe.find((r) => /apertura/i.test(r.nome)) || ultima;
    const ritardo = apertura.fine > target ? Math.round((d(apertura.fine) - d(target)) / GIORNO) : 0;
    const margine = apertura.fine <= target ? lavorativiTra(apertura.fine, target) : 0;
    return { attivita: righe, critico, apertura: apertura.fine, target, in_tempo: apertura.fine <= target, ritardo_giorni: ritardo, margine_giorni_lavorativi: margine,
      nella_chiusura: righe.filter((r) => r.attraversa_chiusura).map((r) => r.id) };
  }
  const sintesiPiano = (p) => p.in_tempo
    ? `Apertura ${breve(p.apertura)} · in tempo, margine ${p.margine_giorni_lavorativi} gg`
    : `Apertura ${breve(p.apertura)} · ${p.ritardo_giorni} giorni dopo il ${breve(p.target)}`;
  const perModello = (p) => ({ ...p, attivita: p.attivita.map(({ id, nome, chi, inizio, fine, critica, guida, attraversa_chiusura }) => ({ id, nome, chi, inizio, fine, critica, guida_da: guida, attraversa_chiusura })) });

  const strumenti = [
    {
      name: 'leggi_brief',
      description: 'Legge il brief del progetto: obiettivo, data di apertura, vincoli, parti coinvolte.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Brief del progetto',
      latenza: 700,
      esegui: async () => ({ risultato: db.brief, sintesi: `Apertura vincolante il ${breve(db.brief.apertura.data)} · ${db.brief.vincoli.length} vincoli`, vista: { fonte: 'brief' } }),
    },
    {
      name: 'leggi_offerte_fornitori',
      description: 'Legge le offerte dei fornitori: lavorazioni, durate, prerequisiti, disponibilità, valore del contratto e tappe di pagamento (SAL).',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Offerte dei fornitori',
      latenza: 900,
      esegui: async () => ({ risultato: db.fornitori, sintesi: `${db.fornitori.length} fornitori · ${db.fornitori.reduce((n, f) => n + f.lavorazioni.length, 0)} lavorazioni`, vista: { fonte: 'fornitori' } }),
    },
    {
      name: 'leggi_attivita_team',
      description: 'Legge le attività del team IT interno, con durate, prerequisiti e disponibilità delle persone.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Attività del team',
      latenza: 700,
      esegui: async () => ({ risultato: db.team, sintesi: `${db.team.attivita.length} attività · team libero dal 16 nov`, vista: { fonte: 'team' } }),
    },
    {
      name: 'leggi_email_progetto',
      description: 'Legge le email della cartella del progetto (cliente e fornitori): conferme, richieste, scadenze, variazioni.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Email del progetto',
      latenza: 900,
      esegui: async () => {
        const e = db.posta.email;
        return { risultato: db.posta, sintesi: `${e.length} email · ${new Set(e.map((m) => m.azienda)).size} mittenti`, vista: { fonte: 'email', email: e, casella: db.posta.casella } };
      },
    },
    {
      name: 'leggi_call_registrate',
      description: 'Legge le call registrate del progetto da Granola e le note di riunione di Notion: sintesi, decisioni, azioni, rischi ed estratti della trascrizione.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Call registrate',
      latenza: 1000,
      esegui: async () => ({ risultato: db.call, sintesi: `${db.call.length} call · ${[...new Set(db.call.map((c) => c.fonte))].join(' e ')}`, vista: { fonte: 'call', call: db.call } }),
    },
    {
      name: 'calcola_piano',
      description: 'Costruisce il piano a step: date di inizio e fine di ogni attività sul calendario lavorativo (festivi, chiusura natalizia 24/12–6/1), rispettando dipendenze e vincoli «non prima del». Trova il percorso critico e confronta l\'apertura con la data vincolante. Usalo sempre invece di calcolare le date a mano.',
      input_schema: { type: 'object', properties: {
        attivita: { type: 'array', items: { type: 'object', properties: {
          id: { type: 'string' }, nome: { type: 'string' }, chi: { type: 'string', description: 'Chiave della parte: edil, cablanet, fibrauno, arredi, vigilanza, traslochi, team, proprietario, cliente' },
          durata: { type: 'integer', description: 'Giorni lavorativi' }, dipende_da: { type: 'array', items: { type: 'string' } },
          non_prima_del: { type: 'string' }, milestone: { type: 'boolean' }, tipo: { type: 'string', enum: ['lavoro', 'weekend'] } }, required: ['id', 'nome', 'chi'] } },
      }, required: ['attivita'] },
      etichetta: (i) => `Piano a step · ${i.attivita.length} attività`,
      latenza: 1300,
      esegui: async ({ attivita }) => {
        const p = pianifica(attivita);
        db.base = { attivita, piano: p }; db.piano = { nome: 'Piano iniziale', attivita, ...p };
        return { risultato: perModello(p), sintesi: sintesiPiano(p), vista: { tipo: 'gantt', nome: 'Piano iniziale', ...p } };
      },
    },
    {
      name: 'simula_variante',
      description: 'Simula una variante del piano corrente: modifica attività esistenti (dipendenze, durata, nome, vincoli), ne aggiunge di nuove o ne rimuove. Ricalcola date e percorso critico. Con adotta=true la variante diventa il piano corrente.',
      input_schema: { type: 'object', properties: {
        nome: { type: 'string' },
        modifiche: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nome: { type: 'string' }, durata: { type: 'integer' }, dipende_da: { type: 'array', items: { type: 'string' } }, non_prima_del: { type: 'string' } }, required: ['id'] } },
        nuove: { type: 'array', items: { type: 'object' } },
        rimuovi: { type: 'array', items: { type: 'string' } },
        adotta: { type: 'boolean' },
      }, required: ['nome'] },
      etichetta: (i) => `Variante: ${i.nome}`,
      latenza: 1300,
      esegui: async ({ nome, modifiche = [], nuove = [], rimuovi = [], adotta }) => {
        if (!db.piano) throw new Error('Prima calcola il piano');
        let att = db.piano.attivita.filter((a) => !rimuovi.includes(a.id)).map((a) => ({ ...a }));
        for (const m of modifiche) { const a = att.find((x) => x.id === m.id); if (!a) throw new Error(`Attività ${m.id} inesistente`); Object.assign(a, m); }
        att = [...att, ...nuove];
        const p = pianifica(att);
        const prima = db.piano;
        if (adotta) db.piano = { nome, attivita: att, ...p };
        return { risultato: { ...perModello(p), adottata: !!adotta, rispetto_a: { apertura: prima.apertura, in_tempo: prima.in_tempo } }, sintesi: sintesiPiano(p),
          vista: { tipo: 'gantt', nome, ...p, prima: Object.fromEntries(prima.attivita.map((a) => [a.id, { inizio: a.inizio, fine: a.fine }])) } };
      },
    },
    {
      name: 'genera_registro_decisioni',
      description: 'Pubblica il registro di progetto con decisioni, azioni (responsabile e scadenza) e rischi emersi da email e call. Ogni voce deve citare la fonte (id dell\'email o della call).',
      input_schema: { type: 'object', properties: {
        voci: { type: 'array', items: { type: 'object', properties: {
          tipo: { type: 'string', enum: ['decisione', 'azione', 'rischio'] }, testo: { type: 'string' }, chi: { type: 'string' }, entro: { type: 'string' },
          stato: { type: 'string' }, livello: { type: 'string', enum: ['alto', 'medio', 'basso'] }, fonti: { type: 'array', items: { type: 'string' } } }, required: ['tipo', 'testo', 'fonti'] } },
      }, required: ['voci'] },
      etichetta: () => 'Registro decisioni e azioni',
      latenza: 1000,
      esegui: async ({ voci }) => {
        const tutte = [...db.posta.email.map((m) => ({ id: m.id, tipo: 'email', titolo: m.oggetto, data: m.data, da: m.azienda })), ...db.call.map((c) => ({ id: c.id, tipo: c.fonte, titolo: c.titolo, data: c.data }))];
        const righe = voci.map((v) => {
          const f = v.fonti.map((id) => { const x = tutte.find((t) => t.id === id); if (!x) throw new Error(`Fonte ${id} inesistente`); return x; });
          return { ...v, fonti: f };
        });
        const conta = (t) => righe.filter((r) => r.tipo === t).length;
        return { risultato: { pubblicato: true, voci: righe.length }, sintesi: `${conta('decisione')} decisioni · ${conta('azione')} azioni · ${conta('rischio')} rischi`, output: { tipo: 'registro', contenuto: { voci: righe } } };
      },
    },
    {
      name: 'genera_chi_fa_cosa',
      description: 'Genera dal piano corrente la matrice delle responsabilità (chi esegue, chi approva, chi va consultato, chi va informato) per ogni attività.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Matrice chi fa cosa',
      latenza: 900,
      esegui: async () => {
        const p = db.piano;
        const parti = ['team', 'edil', 'cablanet', 'fibrauno', 'arredi', 'vigilanza', 'traslochi', 'cliente'];
        const righe = p.attivita.filter((a) => !a.milestone).sort((a, b) => a.id.localeCompare(b.id, 'it', { numeric: true })).map((a) => {
          const ruoli = Object.fromEntries(parti.map((c) => [c, '']));
          ruoli[a.chi] = 'Esegue';
          // Chi lavora subito dopo va consultato; il cliente è informato delle attività critiche
          p.attivita.filter((b) => (b.dipende_da || []).includes(a.id) && b.chi !== a.chi && parti.includes(b.chi)).forEach((b) => { if (!ruoli[b.chi]) ruoli[b.chi] = 'Consultato'; });
          if (a.critica && !ruoli.cliente) ruoli.cliente = 'Informato';
          return { id: a.id, nome: a.nome, approva: 'PM', ruoli };
        });
        return { risultato: { colonne: parti.map(nomeDi), righe }, sintesi: `${righe.length} attività · ${parti.length} parti`, output: { tipo: 'raci', contenuto: { parti: parti.map((c) => ({ chi: c, nome: nomeDi(c) })), righe } } };
      },
    },
    {
      name: 'genera_schema_sal',
      description: 'Genera dal piano corrente lo schema dei SAL: per ogni fornitore le tappe di pagamento con percentuale, importo e data prevista, più i totali per mese.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Schema dei SAL',
      latenza: 1000,
      esegui: async () => {
        const p = db.piano;
        const righe = [];
        for (const f of db.fornitori) for (const s of f.sal) {
          const att = s.legata_a ? p.attivita.filter((a) => a.nome.startsWith(s.legata_a)) : [];
          const data = s.data || (att.length ? att.reduce((m, a) => (a.fine > m ? a.fine : m), '') : null);
          righe.push({ fornitore: f.nome, tappa: s.tappa, percentuale: s.percentuale, importo: Math.round(f.valore_contratto * s.percentuale / 100), data, verifica: 'PM' });
        }
        righe.sort((a, b) => (a.data < b.data ? -1 : 1));
        const mesi = {};
        righe.forEach((r) => { const k = r.data.slice(0, 7); mesi[k] = (mesi[k] || 0) + r.importo; });
        const totale = righe.reduce((s, r) => s + r.importo, 0);
        return { risultato: { righe, mesi, totale }, sintesi: `${righe.length} tappe · ${euro(totale)}`, output: { tipo: 'sal', contenuto: { righe, mesi, totale } } };
      },
    },
    {
      name: 'scrivi_report',
      description: 'Pubblica il report di pianificazione per il cliente. Le date le prende dal piano corrente: tu scrivi sintesi, rischi e decisioni.',
      input_schema: { type: 'object', properties: {
        titolo: { type: 'string' }, sintesi: { type: 'string' },
        rischi: { type: 'array', items: { type: 'object', properties: { livello: { type: 'string', enum: ['alto', 'medio', 'basso'] }, titolo: { type: 'string' }, azione: { type: 'string' } } } },
        decisioni: { type: 'array', items: { type: 'string' } },
      }, required: ['titolo', 'sintesi'] },
      etichetta: () => 'Report per il cliente',
      latenza: 1100,
      esegui: async (r) => {
        const p = db.piano;
        const chiave = p.attivita.filter((a) => a.critica && !a.milestone).map((a) => ({ nome: a.nome, chi: nomeDi(a.chi), inizio: a.inizio, fine: a.fine }));
        const report = { ...r, apertura: p.apertura, target: p.target, margine: p.margine_giorni_lavorativi, in_tempo: p.in_tempo, date_chiave: chiave };
        const out = path.join(dir, 'output'); fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
        return { risultato: { pubblicato: true }, sintesi: 'Report pubblicato', output: { tipo: 'report', contenuto: report } };
      },
    },
    {
      name: 'prepara_email',
      description: 'Prepara un\'email a un fornitore o al cliente (conferma date, richiesta di variazione, prenotazione). Viene inviata solo dopo l\'approvazione del PM.',
      input_schema: { type: 'object', properties: { a: { type: 'string' }, oggetto: { type: 'string' }, testo: { type: 'string' } }, required: ['a', 'oggetto', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Email a ${i.a.split(' (')[0]}`,
      anteprima: (i) => ({ tipo: 'email', ...i }),
      latenza: 600,
      esegui: async (m) => { db.uscita.push(m); return { risultato: { stato: 'in posta in uscita' }, sintesi: 'Approvata · in uscita' }; },
    },
  ];

  return {
    info: { nome: 'Metis', ruolo: 'Agente di pianificazione per il project manager', progetto: db.brief.progetto, cliente: db.brief.cliente, oggi: db.brief.oggi, apertura: db.brief.apertura.data, chiusura: CHIUSURA, festivi: [...FESTIVI] },
    compito: 'Pianifica l\'apertura della nuova sede di Monza: costruisci il piano a step con tutti i fornitori e il team, tenendo conto anche delle email del progetto e delle call registrate; verifica la data di apertura, aggiorna il registro di decisioni e azioni, prepara chi fa cosa, lo schema dei SAL, il report per il cliente e le richieste ai fornitori.',
    sistema: [
      'Sei Metis, un agente che affianca un project manager italiano nella pianificazione. Scrivi in italiano, in modo conciso e professionale.',
      'Regole:',
      '1. Prima di pianificare leggi brief, offerte dei fornitori, attività del team, email del progetto e call registrate (Granola, Notion). Puoi chiamare più strumenti nello stesso turno.',
      '   Email e call contano quanto le offerte: conferme, scadenze, proposte dei fornitori e decisioni prese in riunione vanno nel piano e nel registro.',
      '2. Costruisci le attività con le dipendenze che risultano dalle fonti (prerequisiti, «a pareti chiuse», «a impianti finiti», disponibilità). Non calcolare mai le date a mano: usa calcola_piano e simula_variante.',
      '3. Se l\'apertura non rispetta la data vincolante, cerca nelle fonti margini reali (lavorazioni in parallelo, consegne per zone, alternative tecniche indicate) e simula le varianti. Adotta solo una variante che rispetta la data.',
      '4. Distingui i fatti dalle ipotesi: una variante che cambia il lavoro di un fornitore va confermata da lui.',
      '5. Pubblica il registro di decisioni, azioni e rischi citando l\'email o la call di origine; poi genera chi fa cosa, lo schema dei SAL e il report per il cliente.',
      '6. Le email ai fornitori e al cliente passano dall\'approvazione del PM: proponile con prepara_email.',
      '7. Mentre lavori scrivi frasi brevi su cosa stai facendo e perché.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: { brief: () => db.brief, fornitori: () => db.fornitori, team: () => db.team, email: () => db.posta, call: () => db.call },
  };
}
