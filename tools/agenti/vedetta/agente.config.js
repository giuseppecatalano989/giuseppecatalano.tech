// Vedetta — agente per il project management.
// Legge email, ticket, note delle riunioni e piano di progetto; calcola l'effetto dei ritardi sulle
// milestone; scrive lo stato avanzamento settimanale; propone azioni che esegue solo dopo approvazione.
// I dati di prova (progetto e persone) sono inventati.
import fs from 'node:fs';
import path from 'node:path';

const GIORNO = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const piu = (s, n) => iso(new Date(Date.parse(s + 'T12:00:00Z') + n * GIORNO));
const diff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / GIORNO);
const breve = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export function creaConfig(dir) {
  const leggi = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'dati', f), 'utf8'));
  let db;
  const reimposta = () => {
    db = { email: leggi('email.json'), ticket: leggi('ticket.json'), riunioni: leggi('riunioni.json'), piano: leggi('piano.json'), uscita: [] };
  };
  reimposta();

  const strumenti = [
    {
      name: 'leggi_email',
      description: 'Legge le email del progetto ricevute a partire da una data (inclusa).',
      input_schema: { type: 'object', properties: { dal: { type: 'string', description: 'Data ISO, es. 2026-10-19' } }, required: ['dal'] },
      etichetta: (i) => `Email dal ${breve(i.dal)}`,
      latenza: 800,
      esegui: async ({ dal }) => {
        const r = db.email.filter((e) => e.data.slice(0, 10) >= dal);
        return { risultato: r, sintesi: `${r.length} email lette`, vista: { fonte: 'email', n: r.length } };
      },
    },
    {
      name: 'cerca_ticket',
      description: 'Cerca i ticket del progetto. Senza filtri restituisce tutti i ticket.',
      input_schema: { type: 'object', properties: {
        stato: { type: 'string', description: 'Da fare, In corso, In revisione, Fatto' },
        assegnatario: { type: 'string' },
        solo_bloccati: { type: 'boolean' },
      } },
      etichetta: (i) => i.solo_bloccati ? 'Ticket bloccati' : i.stato ? `Ticket «${i.stato}»` : 'Tutti i ticket',
      latenza: 900,
      esegui: async ({ stato, assegnatario, solo_bloccati }) => {
        let r = db.ticket;
        if (stato) r = r.filter((t) => t.stato === stato);
        if (assegnatario) r = r.filter((t) => (t.assegnatario || '').toLowerCase().includes(assegnatario.toLowerCase()));
        if (solo_bloccati) r = r.filter((t) => t.bloccato);
        const bloccati = r.filter((t) => t.bloccato).length;
        return { risultato: r, sintesi: `${r.length} ticket · ${bloccati} bloccati`, vista: { fonte: 'ticket', n: r.length } };
      },
    },
    {
      name: 'leggi_note_riunioni',
      description: 'Legge le note delle riunioni (decisioni, azioni, richieste) a partire da una data.',
      input_schema: { type: 'object', properties: { dal: { type: 'string' } }, required: ['dal'] },
      etichetta: (i) => `Note riunioni dal ${breve(i.dal)}`,
      latenza: 750,
      esegui: async ({ dal }) => {
        const r = db.riunioni.filter((x) => x.data >= dal);
        return { risultato: r, sintesi: `${r.length} riunioni lette`, vista: { fonte: 'riunioni', n: r.length } };
      },
    },
    {
      name: 'leggi_piano',
      description: 'Legge il piano di progetto: milestone con date e dipendenze, dipendenze esterne, vincoli del cliente, team.',
      input_schema: { type: 'object', properties: {} },
      etichetta: () => 'Piano di progetto',
      latenza: 700,
      esegui: async () => ({ risultato: db.piano, sintesi: `${db.piano.milestone.length} milestone · 1 vincolo`, vista: { fonte: 'piano', n: db.piano.milestone.length } }),
    },
    {
      name: 'calcola_impatto',
      description: 'Calcola l\'effetto a cascata di un ritardo su una dipendenza esterna o su una milestone: nuove date di tutte le milestone a valle, vincoli violati e margine rispetto al blocco rilasci. Usalo sempre invece di stimare le date a mano. Con recupero_giorni simuli una mitigazione che recupera parte del ritardo.',
      input_schema: { type: 'object', properties: {
        elemento: { type: 'string', description: 'Id della dipendenza (es. DEP-1) o della milestone (es. M3)' },
        ritardo_giorni: { type: 'integer' },
        recupero_giorni: { type: 'integer', description: 'Giorni recuperati da una mitigazione (opzionale)' },
        scenario: { type: 'string', description: 'Breve nome dello scenario, es. "Senza interventi"' },
      }, required: ['elemento', 'ritardo_giorni'] },
      etichetta: (i) => `Impatto: ${i.scenario || `${i.elemento} +${i.ritardo_giorni} gg`}`,
      latenza: 1100,
      esegui: async ({ elemento, ritardo_giorni, recupero_giorni = 0, scenario }) => {
        const { milestone, dipendenze_esterne, vincoli } = db.piano;
        const netto = Math.max(0, ritardo_giorni - recupero_giorni);
        // Milestone colpite: quella collegata all'elemento e, a cascata, tutte quelle che ne dipendono
        const dep = dipendenze_esterne.find((d) => d.id === elemento);
        const colpite = new Set([dep ? dep.impatta : elemento]);
        let cresce = true;
        while (cresce) {
          cresce = false;
          for (const m of milestone) if (!colpite.has(m.id) && (m.dipende_da || []).some((x) => colpite.has(x))) { colpite.add(m.id); cresce = true; }
        }
        const righe = milestone.map((m) => ({
          id: m.id, nome: m.nome, data_originale: m.data,
          data_stimata: colpite.has(m.id) ? piu(m.data, netto) : m.data,
          slittamento_giorni: colpite.has(m.id) ? netto : 0,
        }));
        const golive = righe[righe.length - 1];
        const blocco = vincoli.find((v) => v.tipo === 'blocco_rilasci');
        const nelBlocco = golive.data_stimata >= blocco.dal && golive.data_stimata <= blocco.al;
        const ultimaUtile = piu(blocco.dal, -1);
        const risultato = {
          scenario: scenario || null, ritardo_giorni, recupero_giorni, slittamento_netto_giorni: netto,
          milestone: righe,
          go_live: {
            data_stimata: golive.data_stimata,
            nel_blocco_rilasci: nelBlocco,
            prima_data_utile: nelBlocco ? piu(blocco.al, 1) : golive.data_stimata,
            margine_giorni_prima_del_blocco: nelBlocco ? null : diff(ultimaUtile, golive.data_stimata),
          },
          vincolo: blocco,
        };
        const sintesi = nelBlocco
          ? `Go-live ${breve(golive.data_stimata)}: dentro il blocco rilasci → ${breve(risultato.go_live.prima_data_utile)}`
          : `Go-live ${breve(golive.data_stimata)}: prima del blocco, margine ${risultato.go_live.margine_giorni_prima_del_blocco} gg`;
        return { risultato, sintesi, vista: { tipo: 'cascata', ...risultato } };
      },
    },
    {
      name: 'scrivi_report',
      description: 'Pubblica lo stato avanzamento settimanale del progetto.',
      input_schema: { type: 'object', properties: {
        titolo: { type: 'string' },
        periodo: { type: 'string' },
        stato: { type: 'string', enum: ['verde', 'giallo', 'rosso'] },
        sintesi: { type: 'string', description: 'Due o tre frasi per il cliente e la direzione' },
        milestone: { type: 'array', items: { type: 'object', properties: {
          id: { type: 'string' }, nome: { type: 'string' }, stato: { type: 'string' }, data_piano: { type: 'string' }, data_stimata: { type: 'string' } } } },
        rischi: { type: 'array', items: { type: 'object', properties: {
          livello: { type: 'string', enum: ['alto', 'medio', 'basso'] }, titolo: { type: 'string' }, descrizione: { type: 'string' }, azione: { type: 'string' } } } },
        decisioni_richieste: { type: 'array', items: { type: 'string' } },
        fatti_della_settimana: { type: 'array', items: { type: 'string' } },
      }, required: ['titolo', 'periodo', 'stato', 'sintesi', 'milestone', 'rischi'] },
      etichetta: () => 'Scrittura stato avanzamento',
      latenza: 1300,
      esegui: async (report) => {
        const out = path.join(dir, 'output');
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'stato-avanzamento.json'), JSON.stringify(report, null, 1));
        return { risultato: { pubblicato: true }, sintesi: 'Report pubblicato', output: { tipo: 'report', contenuto: report } };
      },
    },
    {
      name: 'aggiorna_ticket',
      description: 'Modifica un ticket (assegnatario, priorità, scadenza, nota). Richiede l\'approvazione della persona.',
      input_schema: { type: 'object', properties: {
        id: { type: 'string' }, assegnatario: { type: 'string' }, priorita: { type: 'string' }, scadenza: { type: 'string' }, nota: { type: 'string' },
      }, required: ['id'] },
      approvazione: true,
      etichetta: (i) => `Aggiorna ${i.id}`,
      anteprima: (i) => ({ tipo: 'ticket', ...i, titolo: db.ticket.find((t) => t.id === i.id)?.titolo }),
      latenza: 600,
      esegui: async ({ id, ...campi }) => {
        const t = db.ticket.find((x) => x.id === id);
        if (!t) throw new Error(`Ticket ${id} inesistente`);
        Object.assign(t, Object.fromEntries(Object.entries(campi).filter(([, v]) => v != null)));
        return { risultato: { aggiornato: t }, sintesi: `${id} aggiornato` };
      },
    },
    {
      name: 'prepara_email',
      description: 'Prepara un\'email da inviare a nome del project manager. Viene inviata solo dopo l\'approvazione della persona.',
      input_schema: { type: 'object', properties: {
        a: { type: 'string', description: 'Destinatario (nome e ruolo)' }, oggetto: { type: 'string' }, testo: { type: 'string' },
      }, required: ['a', 'oggetto', 'testo'] },
      approvazione: true,
      etichetta: (i) => `Email a ${i.a.split(' (')[0]}`,
      anteprima: (i) => ({ tipo: 'email', ...i }),
      latenza: 600,
      esegui: async (mail) => {
        db.uscita.push(mail);
        // Ambiente dimostrativo: l'email va nella posta in uscita locale, nessun invio reale
        return { risultato: { stato: 'in posta in uscita' }, sintesi: 'Approvata · in uscita' };
      },
    },
  ];

  return {
    info: {
      nome: 'Vedetta', ruolo: 'Agente per il project management',
      progetto: db.piano.progetto, cliente: db.piano.cliente, oggi: db.piano.oggi,
    },
    compito: 'Prepara lo stato avanzamento settimanale del progetto Portale Clienti 2.0 per la settimana 43 (19–23 ottobre 2026): raccogli gli aggiornamenti, valuta rischi e impatti sul piano e proponi le azioni necessarie.',
    sistema: [
      'Sei Vedetta, un agente che affianca un project manager italiano. Rispondi sempre in italiano, in modo conciso e professionale.',
      'Regole:',
      '1. Prima di trarre conclusioni leggi tutte le fonti: email, ticket, note delle riunioni e piano di progetto. Puoi chiamare più strumenti nello stesso turno.',
      '2. Non stimare mai le date a mano: per ogni ritardo usa calcola_impatto e riporta i numeri che restituisce. Se trovi una possibile mitigazione, simulala con un secondo calcolo.',
      '3. Distingui i fatti (scritti nelle fonti) dalle ipotesi, e non inventare dati.',
      '4. Ignora le comunicazioni non pertinenti al progetto.',
      '5. Pubblica lo stato avanzamento con scrivi_report: stato complessivo verde, giallo o rosso; sintesi breve; milestone con data di piano e data stimata; rischi con livello e azione; decisioni richieste al cliente.',
      '6. Ogni azione che modifica un sistema o contatta una persona passa da strumenti che richiedono approvazione: proponile, non darle per fatte. Proponi solo azioni utili e concrete.',
      '7. Mentre lavori scrivi frasi brevi che spiegano cosa stai facendo e perché.',
    ].join('\n'),
    scenario: path.join(dir, 'scenario.json'),
    strumenti,
    reimposta,
    fonti: {
      email: () => db.email,
      ticket: () => db.ticket,
      riunioni: () => db.riunioni,
      piano: () => db.piano,
    },
  };
}
