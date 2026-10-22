// Minerva — agente di supporto basato sulla knowledge base aziendale.
// Legge la coda del service desk (ticket dal portale e richieste via email), cerca le risposte nella
// knowledge base esterna (uno spazio Confluence e un manuale Notion), controlla lo stato dei servizi,
// scrive per ogni ticket una nota privata con le fonti e lo assegna al tecnico giusto secondo la matrice
// del team; risponde in automatico solo quando la procedura è verificata, altrimenti prepara una bozza
// da approvare. Le regole di autonomia sono applicate anche dagli strumenti, non solo dalle istruzioni.
// I dati di prova (aziende, persone, pagine) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    const k = leggi('conoscenza.json');
    db = { coda: leggi('coda.json'), ...k, ticket: {}, ricerche: {}, risposte: [], bozze: [] };
    db.coda.forEach((t) => { db.ticket[t.id] = { stato: 'nuovo' }; });
  };
  reimposta();
  const ticket = (id) => {
    const t = db.coda.find((x) => x.id === id);
    if (!t) throw new Error(`Ticket ${id} inesistente`);
    return t;
  };
  const pagina = (id) => {
    const p = db.pagine.find((x) => x.id === id);
    if (!p) throw new Error(`Pagina ${id} inesistente`);
    return p;
  };
  const parole = (s) => s.toLowerCase().split(/[^a-zà-ù0-9]+/).filter((w) => w.length > 1);

  const strumenti = [
    {
      name: 'leggi_coda',
      description: 'Legge la coda del service desk: ticket aperti dal portale e richieste arrivate via email, con richiedente, priorità e testo.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Coda del service desk',
      latenza: 900,
      esegui: async () => ({ risultato: db.coda, sintesi: `${db.coda.length} richieste · ${db.coda.filter((t) => t.priorita === 'alta').length} ad alta priorità`, vista: { tipo: 'coda' } }),
    },
    {
      name: 'cerca_knowledge_base',
      description: 'Cerca nella knowledge base (Confluence, spazi Help Desk e Sicurezza; Notion, Manuale del team). Restituisce le pagine più pertinenti con un livello di confidenza (alta, media, bassa).',
      input_schema: { type: 'object', properties: { domanda: { type: 'string' }, ticket: { type: 'string' } }, required: ['domanda'] },
      etichetta: (i) => `Knowledge base${i.ticket ? ' · ' + i.ticket : ''}`,
      latenza: 750,
      esegui: async ({ domanda, ticket: tid }) => {
        const q = parole(domanda);
        const r = db.pagine.filter((p) => !p.matrice).map((p) => {
          const punti = p.parole.filter((w) => q.some((x) => x.startsWith(w) || w.startsWith(x))).length;
          return { id: p.id, fonte: p.fonte, spazio: p.spazio, titolo: p.titolo, aggiornata: p.aggiornata, punti,
            confidenza: punti >= 4 ? 'alta' : punti === 3 ? 'media' : 'bassa' };
        }).filter((p) => p.punti > 0).sort((a, b) => b.punti - a.punti).slice(0, 2);
        if (tid) db.ricerche[tid] = r;
        const top = r[0];
        return { risultato: r, sintesi: top ? `${top.id} · confidenza ${top.confidenza}` : 'Nessuna pagina pertinente',
          vista: tid ? { tipo: 'fonti', ticket: tid, risultati: r } : null };
      },
    },
    {
      name: 'leggi_pagina',
      description: 'Legge per intero una pagina della knowledge base: testo, passi della procedura, autore, ultimo aggiornamento, eventuale matrice di assegnazione.',
      input_schema: { type: 'object', properties: { id: { type: 'string' }, ticket: { type: 'string' } }, required: ['id'] },
      etichetta: (i) => `Pagina ${i.id}`,
      latenza: 700,
      esegui: async ({ id, ticket: tid }) => {
        const p = pagina(id);
        const { parole: _, ...resto } = p;
        return { risultato: resto, sintesi: `${p.fonte} · ${p.titolo}`, vista: tid ? { tipo: 'pagina', ticket: tid, pagina: resto } : (p.matrice ? { tipo: 'matrice', pagina: resto } : null) };
      },
    },
    {
      name: 'stato_servizi',
      description: 'Stato dei servizi e incidenti aperti (Microsoft 365, rete, VPN).',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Stato dei servizi',
      latenza: 700,
      esegui: async () => {
        const inc = db.stato_servizi.filter((s) => s.stato !== 'Operativo');
        return { risultato: db.stato_servizi, sintesi: inc.length ? `${inc.length} incidente aperto · ${inc[0].servizio}` : 'Tutto operativo', vista: { tipo: 'servizi', incidenti: inc } };
      },
    },
    {
      name: 'nota_privata_e_assegna',
      description: 'Nel software di ticketing: scrive una nota privata per i tecnici (non visibile al richiedente) con analisi e fonti, imposta la categoria e assegna il ticket al tecnico indicato dalla matrice «Chi fa cosa nel supporto». Può collegare un incidente aperto.',
      input_schema: { type: 'object', properties: {
        ticket: { type: 'string' }, assegnatario: { type: 'string' }, categoria: { type: 'string' },
        nota: { type: 'string' }, fonti: { type: 'array', items: { type: 'string' } }, incidente: { type: 'string' } },
        required: ['ticket', 'assegnatario', 'categoria', 'nota'] },
      etichetta: (i) => `${i.ticket} → ${i.assegnatario}`,
      latenza: 750,
      esegui: async ({ ticket: tid, assegnatario, categoria, nota, fonti = [], incidente }) => {
        ticket(tid);
        const matrice = pagina('NT-12').matrice;
        if (!matrice.some((m) => m.tecnico === assegnatario)) throw new Error(`${assegnatario} non è nella matrice del team`);
        Object.assign(db.ticket[tid], { assegnatario, categoria, nota, fonti, incidente, stato: 'assegnato' });
        return { risultato: { aggiornato: true }, sintesi: `Nota privata · ${categoria}`, vista: { tipo: 'nota', ticket: tid, assegnatario, categoria, nota, fonti, incidente } };
      },
    },
    {
      name: 'invia_risposta',
      description: 'Invia subito la risposta al richiedente. Lo strumento accetta solo ticket con una fonte ad alta confidenza su una procedura self-service, e rifiuta quelli legati a incidenti aperti o alla sicurezza: in quei casi usa prepara_bozza.',
      input_schema: { type: 'object', properties: { ticket: { type: 'string' }, testo: { type: 'string' }, fonti: { type: 'array', items: { type: 'string' } } }, required: ['ticket', 'testo', 'fonti'] },
      etichetta: (i) => `Risposta automatica ${i.ticket}`,
      latenza: 850,
      esegui: async ({ ticket: tid, testo, fonti }) => {
        const t = ticket(tid), st = db.ticket[tid];
        // Regole applicate dallo strumento, a prescindere da cosa decide il modello
        if (st.incidente) throw new Error('Ticket legato a un incidente aperto: serve una bozza da approvare');
        if (/sicurezza/i.test(st.categoria || '')) throw new Error('Ticket di sicurezza: serve una bozza da approvare');
        const buona = (db.ricerche[tid] || []).find((r) => fonti.includes(r.id) && r.confidenza === 'alta' && pagina(r.id).self_service);
        if (!buona) throw new Error('Nessuna fonte ad alta confidenza su una procedura self-service: serve una bozza da approvare');
        db.risposte.push({ ticket: tid, testo, fonti });
        st.stato = 'risolto_auto';
        return { risultato: { inviata: true, canale: t.canale }, sintesi: `Inviata via ${t.canale} · in attesa di conferma`, vista: { tipo: 'risposta', ticket: tid, testo, fonti, auto: true } };
      },
    },
    {
      name: 'prepara_bozza',
      description: 'Prepara la risposta al richiedente come bozza: viene inviata solo dopo l\'approvazione di una persona.',
      input_schema: { type: 'object', properties: { ticket: { type: 'string' }, testo: { type: 'string' }, fonti: { type: 'array', items: { type: 'string' } } }, required: ['ticket', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Bozza ${i.ticket}`,
      anteprima: (i) => { const t = ticket(i.ticket); return { tipo: 'bozza', ...i, richiedente: t.richiedente, azienda: t.azienda, oggetto: t.oggetto, motivo: db.ticket[i.ticket].incidente ? `Collegato a ${db.ticket[i.ticket].incidente}` : db.ticket[i.ticket].categoria }; },
      latenza: 600,
      esegui: async ({ ticket: tid, testo, fonti = [] }) => {
        ticket(tid);
        db.bozze.push({ ticket: tid, testo, fonti });
        db.ticket[tid].stato = 'risolto_bozza';
        return { risultato: { inviata: true }, sintesi: 'Approvata e inviata', vista: { tipo: 'risposta', ticket: tid, testo, fonti, auto: false } };
      },
    },
    {
      name: 'scrivi_riepilogo',
      description: 'Pubblica il riepilogo per il responsabile del service desk. I conteggi li calcola lo strumento; tu scrivi la sintesi.',
      input_schema: { type: 'object', properties: { sintesi: { type: 'string' } }, required: ['sintesi'] },
      etichetta: () => 'Riepilogo per il responsabile',
      latenza: 900,
      esegui: async ({ sintesi }) => {
        const st = Object.entries(db.ticket);
        const fonti = new Set(st.flatMap(([, s]) => s.fonti || []));
        const r = { sintesi, azienda: db.azienda, data: db.oggi, richieste: db.coda.length,
          risposte_automatiche: st.filter(([, s]) => s.stato === 'risolto_auto').length,
          bozze_approvate: st.filter(([, s]) => s.stato === 'risolto_bozza').length,
          a_un_tecnico: st.filter(([, s]) => s.stato === 'assegnato').length,
          assegnati: st.filter(([, s]) => s.assegnatario).length,
          pagine_citate: [...fonti],
          tecnici: st.map(([id, s]) => ({ ticket: id, assegnatario: s.assegnatario, stato: s.stato })) };
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'riepilogo.json'), JSON.stringify(r, null, 1));
        return { risultato: r, sintesi: `${r.assegnati} su ${r.richieste} assegnati · ${r.pagine_citate.length} pagine citate`, output: { tipo: 'riepilogo', contenuto: r } };
      },
    },
  ];

  return {
    info: { nome: 'Minerva', ruolo: 'Agente di supporto sulla knowledge base', azienda: db.azienda, oggi: db.oggi,
      fonti: [{ nome: 'Confluence', spazi: ['Help Desk', 'Sicurezza'] }, { nome: 'Notion', spazi: ['Manuale del team'] }, { nome: 'Service desk', spazi: ['Coda di supporto'] }] },
    compito: 'Gestisci la coda del service desk: per ogni richiesta trova la soluzione nella knowledge base, scrivi la nota privata con le fonti, assegna il ticket al tecnico giusto e rispondi al richiedente in automatico o con una bozza da approvare.',
    sistema: [
      'Sei Minerva, l\'agente di supporto di un fornitore di servizi IT italiano. Scrivi in italiano: del lei ai clienti, del tu ai colleghi.',
      'Regole:',
      '1. Ogni risposta nasce dalla knowledge base: cerca, leggi la pagina e cita le fonti. Non inventare procedure.',
      '2. Controlla lo stato dei servizi: se una richiesta coincide con un incidente aperto, collegalo.',
      '3. Per ogni ticket scrivi una nota privata con analisi e fonti e assegnalo secondo la pagina «Chi fa cosa nel supporto».',
      '4. Rispondi in automatico solo con una procedura self-service trovata con confidenza alta. Incidenti, sicurezza e casi incerti vanno in bozza da approvare.',
      '5. Le credenziali non si comunicano mai via ticket o email.',
      '6. Se nella knowledge base non c\'è una soluzione adatta, non rispondere: passa il caso al tecnico con una nota utile.',
      '7. Chiudi con scrivi_riepilogo. Mentre lavori scrivi frasi brevi su cosa stai facendo.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: { coda: () => db.coda },
  };
}
