"""Testi professionali per i video degli agenti (revisione «direzione marketing»).

Applica a ogni comp.html:
- in apertura la categoria del prodotto al posto dello slogan;
- una frase di posizionamento su due righe al posto delle tre parole lampo;
- copertine numerate con il nome della funzionalità, più lente;
- titoli, punti e numeri delle scene orientati ai benefici;
- chiusura con il claim e la firma «Demo con dati di esempio».

Uso: python agenti/copy_pro.py   (da tools/video)
"""
import re
from pathlib import Path

BYLINE = 'Agente AI progettato da Giuseppe Catalano · Demo con dati di esempio'

TESTI = {
    'metis': {
        'tag': 'Agente AI per la pianificazione dei progetti',
        'stmt': ['Fornitori, email e call,', 'in un unico piano.'],
        'outro': ['Progetti complessi,', 'sotto controllo.'],
        'scene': {
            'legge': dict(card=['Analisi delle fonti', 'Brief, offerte, team, email del progetto e call da Granola e Notion.'],
                          eyebrow='Analisi delle fonti', l1='Tutte le informazioni,', l2='in un’unica vista.',
                          points=['Offerte e capacità del team', 'Email di cliente e fornitori', 'Call da Granola e Notion'],
                          stat=(' email', 'e 3 call registrate', 6)),
            'piano': dict(card=['Pianificazione', 'Dipendenze, festività e chiusure, calcolate da un motore deterministico.'],
                          eyebrow='Pianificazione', l1='Percorso critico e scadenze,', l2='calcolati, non stimati.',
                          points=['Percorso critico', 'Festività e chiusure aziendali', 'Verifica della data vincolante'],
                          stat=(' giorni', 'di ritardo individuati in anticipo')),
            'variante': dict(eyebrow='Analisi what-if', l1='Scenari alternativi,', l2='confrontati in tempo reale.',
                             points=['Consegne per lotti', 'Attività in parallelo', 'Data contrattuale rispettata']),
            'registro': dict(eyebrow='Registro di progetto', l1='Decisioni, azioni e rischi,', l2='con la fonte di ogni voce.',
                             points=['Email e call collegate', 'Responsabili e scadenze', 'Rischi prioritizzati'],
                             stat=(' azioni', 'con responsabile e scadenza', 5)),
            'documenti': dict(card=['Documentazione', 'Matrice RACI, piano dei SAL e report per il committente.'],
                              eyebrow='Documentazione di progetto', l1='RACI, SAL e report,', l2='allineati al piano.',
                              points=['Matrice delle responsabilità', 'Piano dei SAL e flussi mensili', 'Rischi e decisioni'],
                              stat=(' €', 'di SAL pianificati')),
            'approva': dict(card=['Coordinamento', 'Comunicazioni ai fornitori pronte, inviate solo con la tua approvazione.'],
                            eyebrow='Coordinamento fornitori', l1='Comunicazioni pronte,', l2='inviate con il tuo consenso.',
                            points=['Conferma della consegna in due lotti', 'Pianificazione del sopralluogo'],
                            stat=(' email', 'approvate dal project manager')),
            'finale': dict(eyebrow='Risultato', l1='Apertura confermata', l2='nella data contrattuale.',
                           points=['18 attività, 7 parti coordinate', '6 email e 3 call nel registro']),
        },
    },
    'quadra': {
        'tag': 'Agente AI per il ciclo passivo e attivo',
        'stmt': ['Fatture passive e attive,', 'sotto controllo.'],
        'outro': ['Ogni fattura verificata,', 'ogni incasso seguito.'],
        'scene': {
            'verifica': dict(card=['Controllo a tre vie', 'Ogni fattura confrontata con ordine d’acquisto e documento di trasporto.'],
                             eyebrow='controllo a tre vie', l1='Ordine, DDT e fattura,', l2='riconciliati in automatico.',
                             points=['Prezzi e quantità', 'Fatture duplicate', 'IBAN, IVA e totali'],
                             stat=(' fatture', 'verificate in automatico')),
            'anomalie': dict(card=['Anomalie', 'Scostamenti di prezzo, merce non consegnata, duplicati.'],
                             eyebrow='rilevamento anomalie', l1='Ogni scostamento', l2='individuato e documentato.',
                             points=['Prezzo superiore all’ordine', 'Merce non consegnata', 'Fattura già registrata']),
            'frode': dict(eyebrow='prevenzione frodi', l1='IBAN modificato?', l2='Pagamento sospeso.',
                          points=['Confronto con lo storico pagamenti', 'Blocco preventivo', 'Verifica con il fornitore']),
            'approva': dict(card=['Governance', 'Blocchi e contestazioni eseguiti solo dopo la tua approvazione.'],
                            eyebrow='governance', l1='Blocchi e contestazioni,', l2='solo con la tua approvazione.',
                            points=['Pagamenti sospesi', 'Contestazioni ai fornitori pronte'],
                            stat=(' azioni', 'approvate dall’amministrazione')),
            'attivo': dict(card=['Ciclo attivo', 'Fatture ai clienti dalle consegne, con prezzi d’ordine e controlli per lo SDI.'],
                           eyebrow='fatturazione attiva', l1='Dalla consegna alla fattura,', l2='con i controlli già eseguiti.',
                           points=['Prezzi dall’ordine cliente', 'Quantità dal DDT', 'Codice destinatario SDI'],
                           stat=(' fatture', 'pronte per lo SDI', 2)),
            'incassi': dict(eyebrow='riconciliazione incassi', l1='Incassi abbinati,', l2='scaduto in evidenza.',
                            points=['Abbinamento per causale', 'Abbinamento per importo', 'Giorni di ritardo'],
                            stat=(' €', 'di incassi riconciliati', 10370)),
            'approva2': dict(eyebrow='invio e solleciti', l1='SDI e solleciti,', l2='solo con la tua approvazione.',
                             points=['Due fatture allo SDI', 'Un sollecito al cliente'],
                             stat=(' azioni', 'approvate dall’amministrazione', 2)),
            'riepilogo': dict(eyebrow='risultato', l1='Due cicli,', l2='un unico riepilogo.',
                              points=['Fornitori: anomalie intercettate', 'Clienti: incassi riconciliati'],
                              stat=(' €', 'di importi anomali intercettati')),
        },
    },
    'comitas': {
        'tag': 'Agente AI per customer care e social media',
        'stmt': ['Email, chat e social,', 'gestiti da un unico agente.'],
        'outro': ['Ogni canale presidiato,', 'ogni cliente seguito.'],
        'scene': {
            'ascolta': dict(card=['Inbox unificata', 'Email, chat, messaggi diretti e commenti in un’unica coda di lavoro.'],
                            eyebrow='inbox unificata', l1='Tutti i canali,', l2='in un’unica coda.',
                            points=['Email e live chat', 'DM e commenti social', 'Storico cliente tra i canali'],
                            stat=(' messaggi', 'da cinque canali')),
            'persona': dict(eyebrow='riconoscimento del cliente', l1='Più canali, un cliente,', l2='un unico caso.',
                            points=['Email e Facebook collegati', 'Escalation a un operatore', 'Spam rimosso']),
            'risponde': dict(card=['Risposte verificate', 'Basate su ordini, tracking e policy aziendali.'],
                             eyebrow='risposte verificate', l1='Risposte immediate,', l2='basate su dati reali.',
                             points=['Tracking aggiornato', 'Risposte pubbliche ai commenti'],
                             stat=(' risposte', 'gestite in autonomia')),
            'approva': dict(card=['Approvazioni', 'Rimborsi, modifiche e risposte pubbliche validati dal team.'],
                            eyebrow='tutela del brand', l1='Rimborsi e risposte pubbliche', l2='approvati dal team.',
                            points=['Sostituzione con ritiro', 'Modifica dell’indirizzo', 'Risposta pubblica al reclamo'],
                            stat=(' azioni', 'approvate dal team')),
            'riepilogo': dict(eyebrow='risultato', l1='Otto richieste,', l2='zero in attesa.',
                              points=['Report per il team'],
                              stat=(' su 8', 'messaggi gestiti')),
        },
    },
    'minerva': {
        'tag': 'Agente AI per service desk e knowledge management',
        'stmt': ['Il sapere aziendale,', 'applicato a ogni ticket.'],
        'outro': ['La conoscenza aziendale,', 'al servizio di ogni ticket.'],
        'scene': {
            'cerca': dict(card=['Knowledge base', 'Confluence, Notion e altre fonti consultate per ogni richiesta.'],
                          eyebrow='knowledge base', l1='Ogni richiesta,', l2='collegata alla sua procedura.',
                          points=['Indice di confidenza', 'Stato dei servizi', 'Incidenti collegati'],
                          stat=(' richieste', 'da portale ed email')),
            'legge': dict(eyebrow='procedure verificate', l1='Risposte da procedure,', l2='mai improvvisate.',
                          points=['Passi documentati', 'Policy di sicurezza', 'Matrice delle competenze']),
            'assegna': dict(card=['Triage', 'Nota privata con analisi e fonti, ticket al tecnico competente.'],
                            eyebrow='triage e assegnazione', l1='Nota privata,', l2='tecnico competente.',
                            points=['Analisi per il tecnico', 'Fonti citate', 'Instradamento per competenza'],
                            stat=(' ticket', 'assegnati con nota privata')),
            'risponde': dict(card=['Risposta governata', 'Invio automatico solo con procedura verificata. Altrimenti, bozza.'],
                             eyebrow='risposta governata', l1='Invio automatico', l2='o bozza da approvare.',
                             points=['Procedure self-service', 'Incidenti in revisione', 'Sicurezza in revisione'],
                             stat=(' bozze', 'approvate dal responsabile')),
            'riepilogo': dict(eyebrow='risultato', l1='Coda gestita,', l2='ogni risposta documentata.',
                              points=['Report per il responsabile'],
                              stat=(' pagine', 'citate come fonte')),
        },
    },
}

CSS = """
  /* Revisione professionale: frase di posizionamento e copertine numerate */
  #trio .line { display: block; width: max-content; margin-left: auto; margin-right: auto; padding: 10px 24px 34px; }
  .stmt .outro-l1, .stmt .outro-l2 { font-size: 92px; }
  .f45 .stmt .outro-l1, .f45 .stmt .outro-l2 { font-size: 60px; }
  .card .n { font-size: 26px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; opacity: 0; margin-bottom: 6px; }
  .card .t { font-size: 124px !important; letter-spacing: -.045em !important; }
  .f45 .card .t { font-size: 80px !important; }
  .card .s { max-width: 1300px; margin-left: auto; margin-right: auto; font-size: 38px !important; }
  .f45 .card .s { max-width: 900px; font-size: 30px !important; }
  .outro-l1, .outro-l2 { font-size: 100px !important; }
  .f45 .outro-l1, .f45 .outro-l2 { font-size: 62px !important; }
  .byline { font-size: 24px !important; }
  .f45 .byline { font-size: 20px !important; padding: 0 40px; }
  .f45 .tagline { padding: 0 60px; }
"""

STMT_ANIM = """gsap.set(['#st1', '#st2'], { yPercent: 175 });
tl.to('#st1', { yPercent: 0, duration: 0.9, ease: 'expo.out' }, INTRO + 0.1);
tl.to('#st2', { yPercent: 0, duration: 0.9, ease: 'expo.out' }, INTRO + 0.32);
tl.to(['#st1', '#st2'], { yPercent: -175, duration: 0.45, stagger: 0.05, ease: 'power3.in' }, INTRO + TRIO - 0.55);
"""


def js(s):
    return "'" + s.replace("'", "\\'") + "'"


def applica(agente, d):
    p = Path(agente) / 'comp.html'
    s = p.read_text()
    # Apertura, frase di posizionamento, chiusura
    s = re.sub(r'(<div class="tagline" id="introTag">)[^<]*(</div>)', lambda m: m.group(1) + d['tag'] + m.group(2), s)
    s = re.sub(r'<div class="trio" id="trio">[^\n]*\n',
               f'<div class="trio" id="trio"><div class="stmt"><div class="line"><span class="outro-l1 w" id="st1">{d["stmt"][0]}</span></div>'
               f'<div class="line"><span class="outro-l2 w" id="st2">{d["stmt"][1]}</span></div></div></div>\n', s, count=1, flags=re.S)
    s = re.sub(r'(id="o1">)[^<]*(<)', lambda m: m.group(1) + d['outro'][0] + m.group(2), s)
    s = re.sub(r'(id="o2">)[^<]*(<)', lambda m: m.group(1) + d['outro'][1] + m.group(2), s)
    s = re.sub(r'(id="byline">)[^<]*(<)', lambda m: m.group(1) + BYLINE + m.group(2), s)
    s = re.sub(r"\[0, 1, 2\]\.forEach\(k => \{\n.*?\n\}\);\n", lambda m: STMT_ANIM, s, count=1, flags=re.S)
    # Ritmo più posato
    s = re.sub(r'const INTRO = [\d.]+, TRIO = [\d.]+, CARD = [\d.]+, OUTRO_DUR = [\d.]+;',
               'const INTRO = 4.0, TRIO = 3.4, CARD = 2.2, OUTRO_DUR = 6.5;', s)
    # Copertine numerate: numero e descrizione compaiono insieme
    s = s.replace('<div class="in"><div><div class="line">', '<div class="in"><div><div class="n">${String(++NCARD).padStart(2, \'0\')}</div><div class="line">')
    if 'let NCARD' not in s:
        s = s.replace('/* ---------- Costruzione ---------- */', '/* ---------- Costruzione ---------- */\nlet NCARD = 0;')
    s = s.replace("tl.fromTo(`${sel} .s`,", "tl.fromTo([`${sel} .s`, `${sel} .n`],")
    # Testi delle scene
    for sid, v in d['scene'].items():
        m = re.search(r"\{ id: '" + sid + r"',.*?\] \},?\n", s, flags=re.S)
        assert m, (agente, sid)
        blocco = m.group(0)
        nuovo = blocco
        if 'card' in v:
            nuovo = re.sub(r"card: \['[^']*', '[^']*', '(\w)'\]", lambda mm: f"card: [{js(v['card'][0])}, {js(v['card'][1])}, '{mm.group(1)}']", nuovo)
        nuovo = re.sub(r"eyebrow: '[^']*'", lambda mm: 'eyebrow: ' + js(v['eyebrow']), nuovo)
        nuovo = re.sub(r"l1: '[^']*'", lambda mm: 'l1: ' + js(v['l1']), nuovo)
        nuovo = re.sub(r"l2: '[^']*'", lambda mm: 'l2: ' + js(v['l2']), nuovo)
        nuovo = re.sub(r"points: \[[^\]]*\]", lambda mm: 'points: [' + ', '.join(js(x) for x in v['points']) + ']', nuovo)
        if 'stat' in v:
            nuovo = re.sub(r"(stat: \[[\d.]+, \d+, \d+, '[^']*', )'[^']*', '[^']*'\]",
                           lambda mm: mm.group(1) + js(v['stat'][0]) + ', ' + js(v['stat'][1]) + ']', nuovo)
            if len(v['stat']) > 2:
                nuovo = re.sub(r"stat: \[([\d.]+), \d+,", lambda mm: f"stat: [{mm.group(1)}, {v['stat'][2]},", nuovo)
        s = s.replace(blocco, nuovo)
    if 'Revisione professionale' not in s:
        s = s.replace('</style>', CSS + '</style>', 1)
    p.write_text(s)
    print(agente, 'ok')


for a, d in TESTI.items():
    applica(a, d)
