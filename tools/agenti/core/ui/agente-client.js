// Collegamento comune tra l'interfaccia di un agente e il suo server locale.
// L'interfaccia registra un gestore per ogni tipo di evento: avvio, testo, testo_fine,
// strumento, risultato, approvazione, approvato, rifiutato, output, fine, errore.
export function collegaAgente(gestori) {
  const es = new EventSource('/api/eventi');
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    (gestori[ev.type] || (() => {}))(ev);
    gestori.qualsiasi?.(ev);
  };
  return {
    info: () => fetch('/api/info').then((r) => r.json()),
    fonte: (n) => fetch('/api/fonte/' + n).then((r) => r.json()),
    avvia: () => fetch('/api/avvia', { method: 'POST' }),
    approva: (id, ok = true) => fetch('/api/approva', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ok }) }),
  };
}

// Piccole utilità condivise
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dataBreve = (iso) => new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
export const giornoSettimana = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
