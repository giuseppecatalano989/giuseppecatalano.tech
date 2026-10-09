/* ==========================================================================
   Vetrina di Nocchiero sul portfolio — versione statica.
   Le mini-schermate sono il porting 1:1 di src/features/vetrina/MockSchermi.tsx
   (repo nocchiero): stessi dati inventati, stessi colori, stesse animazioni
   (mk-fade / mk-barw / mk-line si accendono dentro .v-reveal-shot.in).
   ========================================================================== */

const SALVIA = '#4B6350', ORO = '#B08238', ROSSO = '#C0564A', VIOLA = '#6D4C9F', BLU = '#3A6EA5';
const INK = '#20241F', MUTED = '#8A8579';
const PILL_VERDE = 'color:#4B6350;background:#E4EBE1';
const PILL_ORO = 'color:#B08238;background:#F2E4C8';
const PILL_BLU = 'color:#3A6EA5;background:#E7EEF6';
const PILL_ROSSO = 'color:#C0564A;background:#F7E0DB';

// Icona Lucide: viene trasformata in SVG da lucide.createIcons() alla fine
const ic = (name, size, color = 'currentColor') =>
  `<i data-lucide="${name}" style="width:${size}px;height:${size}px;color:${color}"></i>`;

const chipTop = (inner) => `<span class="mk-chip" style="display:inline-flex;align-items:center;gap:5px">${inner}</span>`;

function spark(color = SALVIA, giu = false, full = false) {
  const ys = giu ? [8, 12, 9, 15, 13, 19, 17] : [22, 15, 18, 9, 12, 5, 8];
  const W = 76, H = 30, step = W / (ys.length - 1);
  const d = ys.map((y, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${y}`).join(' ');
  return `<svg width="${full ? '100%' : W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="mk-line"/></svg>`;
}

function kpi({ icon, ib, icol, label, value, spark: sp, sparkColor, sparkGiu, dark, bordo, delay }) {
  if (dark) return `
    <div class="mk-fade" style="border-radius:20px;padding:13px;color:#fff;background:linear-gradient(135deg,#4B6350 0%,#35462F 100%);box-shadow:0 12px 24px -14px rgba(53,70,47,0.55);animation-delay:${delay}s">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11.5px;color:rgba(255,255,255,0.7)">${label}</span>${ic('arrow-up-right', 15, 'rgba(255,255,255,0.7)')}
      </div>
      <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-top:10px">${value}</div>
      ${sp ? `<div style="margin-top:6px">${spark('#fff', false, true)}</div>` : ''}
    </div>`;
  const shadow = bordo ? `box-shadow:0 2px 4px rgba(32,36,31,0.05),0 16px 30px -14px rgba(32,36,31,0.2),inset 0 0 0 1.5px ${bordo};` : '';
  return `
    <div class="mk-card mk-fade" style="padding:13px;animation-delay:${delay}s;${shadow}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div class="mk-ic" style="width:34px;height:34px;background:${ib}">${ic(icon, 16, icol)}</div>
        ${sp ? spark(sparkColor || icol, sparkGiu) : ''}
      </div>
      <div class="mk-muted" style="font-size:11.5px;margin-top:11px">${label}</div>
      <div class="mk-val" style="font-size:17px;margin-top:2px">${value}</div>
    </div>`;
}

// Curva morbida (Catmull-Rom) attraverso i punti
function smooth(p) {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function chartCard(delay = 0.3) {
  const vals = [780, 1010, 900, 1180, 1080, 1260, 1248];
  const W = 900, H = 150, padX = 6, padY = 16, min = 600, max = 1360;
  const stepX = (W - padX * 2) / (vals.length - 1);
  const pts = vals.map((v, i) => [padX + i * stepX, H - padY - ((v - min) / (max - min)) * (H - padY * 2)]);
  const dots = pts.map((c, i) => {
    const last = i === pts.length - 1;
    return `<circle cx="${c[0]}" cy="${c[1]}" r="${last ? 5.5 : 4.5}" fill="${last ? SALVIA : '#fff'}" stroke="${SALVIA}" stroke-width="2" class="mk-fade" style="animation-delay:${0.9 + i * 0.06}s"/>`;
  }).join('');
  return `
    <div class="mk-card mk-fade" style="padding:16px;animation-delay:${delay}s">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mk-h" style="font-size:13px">Incassi</span><span class="mk-badge" style="${PILL_VERDE}">In tempo reale</span>
        </div>
        ${chipTop(`Giorno ${ic('chevron-down', 12)}`)}
      </div>
      <div style="margin-top:10px">
        <div class="mk-muted" style="font-size:10.5px">Giorno</div>
        <div class="mk-val" style="font-size:18px">€ 1.248</div>
        <div class="mk-muted" style="font-size:9.5px">Netto IVA (10%): € 1.023</div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;margin-top:4px">
        <path d="${smooth(pts)}" fill="none" stroke="${SALVIA}" stroke-width="2.5" stroke-linecap="round" class="mk-line"/>${dots}
      </svg>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <span class="mk-muted" style="font-size:10.5px">Stesso giorno 2025 (alla stessa ora) € 1.114</span>
        <span class="mk-badge" style="color:#2F6B4F;background:#DCEBE0">+12,0%</span>
      </div>
    </div>`;
}

const tab = (t, on) =>
  `<span style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:999px;color:${on ? '#fff' : MUTED};background:${on ? INK : '#F1EDE3'}">${t}</span>`;
const riga = (i, delay, inner) =>
  `<div class="mk-fade" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:${i ? '1px solid #F2EFE8' : 'none'};animation-delay:${delay}s">${inner}</div>`;

const MOCK = {
  dashboard: () => `
    <div class="mk">
      <div class="mk-fade" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div><div class="mk-val" style="font-size:18px">Ciao, Marco!</div><div class="mk-muted" style="font-size:12px">Ecco come sta andando oggi</div></div>
        ${chipTop(`${ic('store', 13)} Tutti i negozi`)}
      </div>
      <div class="mk-grid4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        ${kpi({ icon: 'wallet', ib: '#E4EBE1', icol: SALVIA, label: 'Incassi oggi', value: '€ 1.248', spark: true, sparkColor: SALVIA, delay: 0 })}
        ${kpi({ icon: 'utensils-crossed', ib: '#F2E4C8', icol: ORO, label: 'Articoli venduti', value: '96', spark: true, sparkColor: ORO, delay: 0.07 })}
        ${kpi({ icon: 'package', ib: '#F2DCD6', icol: ROSSO, label: 'Costo del venduto', value: '30,4%', spark: true, sparkColor: ROSSO, sparkGiu: true, delay: 0.14 })}
        ${kpi({ label: 'Utile netto', value: '€ 610', dark: true, spark: true, delay: 0.21 })}
      </div>
      ${chartCard(0.32)}
    </div>`,

  incassi: () => {
    const campo = (l, v) => `<div style="flex:1;min-width:96px"><div class="mk-muted" style="font-size:10.5px;margin-bottom:4px">${l}</div><div style="background:#F6F4EF;border:1px solid #E4E0D5;border-radius:10px;padding:8px 11px;font-size:12px">${v}</div></div>`;
    return `
    <div class="mk">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
        ${kpi({ icon: 'wallet', ib: '#E4EBE1', icol: SALVIA, label: 'Incassi oggi', value: '€ 1.248', delay: 0 })}
        ${kpi({ icon: 'trending-up', ib: '#F2E4C8', icol: ORO, label: 'Margine oggi', value: '€ 876', delay: 0.08 })}
        ${kpi({ icon: 'piggy-bank', ib: '#E4EBE1', icol: SALVIA, label: 'Utile oggi', value: '€ 610', delay: 0.16 })}
      </div>
      ${chartCard(0.28)}
      <div class="mk-card mk-fade" style="padding:14px;margin-top:10px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;animation-delay:.5s">
        ${campo('Dal giorno', '01/07/2026')}${campo('Al giorno', '24/07/2026')}
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#fff;background:${INK};padding:9px 16px;border-radius:999px">${ic('search', 13)} Interroga</span>
      </div>
    </div>`;
  },

  magazzino: () => {
    const ing = [
      { n: 'Carne di manzo', g: '12,4 kg', w: '72%', c: SALVIA, s: 'OK', p: PILL_VERDE },
      { n: 'Pane brioche', g: '38 pz', w: '40%', c: ORO, s: 'In calo', p: PILL_ORO },
      { n: 'Bacon croccante', g: '1,2 kg', w: '14%', c: ROSSO, s: 'Sotto scorta', p: PILL_ROSSO },
      { n: 'Patate surgelate', g: '22 kg', w: '88%', c: SALVIA, s: 'OK', p: PILL_VERDE },
    ];
    return `
    <div class="mk">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        ${kpi({ icon: 'utensils-crossed', ib: '#F2E4C8', icol: ORO, label: 'Articoli venduti', value: '96', spark: true, sparkColor: ROSSO, sparkGiu: true, delay: 0 })}
        ${kpi({ icon: 'package', ib: '#F2DCD6', icol: ROSSO, label: 'Costo del venduto', value: '30,4%', spark: true, sparkColor: SALVIA, delay: 0.08 })}
      </div>
      <div class="mk-fade" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;animation-delay:.2s">
        ${tab('Ingredienti', true)}${tab('Ricette')}
        <span class="mk-chip" style="margin-left:auto;display:inline-flex;align-items:center;gap:5px">${ic('upload', 12)} Importa</span>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:#fff;background:${SALVIA};padding:6px 12px;border-radius:999px">${ic('plus', 13)} Nuovo</span>
      </div>
      <div class="mk-fade" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #E4E0D5;border-radius:999px;padding:9px 14px;margin-bottom:10px;color:${MUTED};font-size:12px;animation-delay:.28s">${ic('search', 14)} Cerca ingrediente…</div>
      <div class="mk-card" style="overflow:hidden">
        ${ing.map((x, i) => riga(i, 0.34 + i * 0.08, `
          <div class="mk-ic" style="width:32px;height:32px;background:#F6F4EF">${ic('package', 14, x.c)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;font-size:12.5px">${x.n}</div>
            <div style="height:6px;background:#F1EDE3;border-radius:999px;margin-top:6px;overflow:hidden;max-width:140px">
              <div class="mk-barw" style="height:100%;background:${x.c};border-radius:999px;animation-delay:${0.5 + i * 0.1}s;--w:${x.w}"></div>
            </div>
          </div>
          <div class="mk-muted" style="width:48px;text-align:right;font-size:11px">${x.g}</div>
          <span class="mk-badge" style="${x.p};white-space:nowrap">${x.s}</span>`)).join('')}
      </div>
    </div>`;
  },

  prenotazioni: () => {
    const pren = [
      { o: '19:30', n: 'Rossi', p: 4, t: 'Sala 1 · T5' },
      { o: '20:00', n: 'Bianchi', p: 2, t: 'Sala 1 · T2' },
      { o: '20:30', n: 'Verdi', p: 6, t: 'Dehors · T9' },
      { o: '21:00', n: 'Neri', p: 3, t: 'Sala 2 · T7' },
    ];
    return `
    <div class="mk">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        ${kpi({ icon: 'calendar-plus', ib: '#E7EEF6', icol: BLU, label: 'Nuove prenotazioni', value: '7', delay: 0 })}
        ${kpi({ icon: 'bell', ib: '#F2E4C8', icol: ORO, label: 'Da confermare', value: '2', bordo: '#CFE0CB', delay: 0.08 })}
      </div>
      <div class="mk-fade" style="display:flex;gap:6px;margin-bottom:10px;animation-delay:.18s">${tab('Oggi', true)}${tab('Domani')}${tab('Settimana')}${tab('Mese')}</div>
      <div class="mk-card" style="overflow:hidden">
        ${pren.map((x, i) => riga(i, 0.26 + i * 0.08, `
          <div class="mk-ic" style="width:32px;height:32px;background:#F6F4EF">${ic('calendar-plus', 14, SALVIA)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;font-size:13px">${x.n}</div>
            <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">
              <span class="mk-badge" style="${PILL_BLU}">${x.o}</span><span class="mk-badge" style="${PILL_BLU}">${x.p} persone</span><span class="mk-badge" style="${PILL_BLU}">${x.t}</span>
            </div>
          </div>`)).join('')}
      </div>
    </div>`;
  },

  ordini: () => {
    const ord = [
      { id: '#1043', tipo: 'Asporto', st: 'Pronto', p: PILL_VERDE, tot: '€ 24,50', m: '3 articoli · 20:10' },
      { id: '#1044', tipo: 'Domicilio', st: 'In preparazione', p: PILL_ORO, tot: '€ 38,00', m: '5 articoli · 20:14' },
      { id: '#1045', tipo: 'Asporto', st: 'Nuovo', p: PILL_BLU, tot: '€ 15,00', m: '2 articoli · 20:17' },
    ];
    return `
    <div class="mk">
      <div class="mk-fade" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="mk-h" style="font-size:14px">Ordini online · oggi</div><span class="mk-chip">3 in coda</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${ord.map((x, i) => `
          <div class="mk-card mk-fade" style="padding:13px 15px;animation-delay:${i * 0.1}s">
            <div style="display:flex;align-items:center;gap:9px">
              <div class="mk-ic" style="width:32px;height:32px;background:#F6F4EF">${ic('shopping-bag', 15, SALVIA)}</div>
              <div class="mk-val" style="font-size:13.5px">${x.id}</div>
              <span class="mk-badge" style="color:${MUTED};background:#F1EDE3">${x.tipo}</span>
              <span class="mk-badge" style="${x.p};margin-left:auto">${x.st}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:9px">
              <div class="mk-muted" style="font-size:11.5px">${x.m}</div><div class="mk-val" style="font-size:14px">${x.tot}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  },

  crm: () => {
    const cli = [
      { n: 'Giulia Fontana', s: 'VIP', p: `color:${VIOLA};background:#EEE8F6`, sp: '€ 640' },
      { n: 'Marco Bruni', s: 'Abituale', p: PILL_VERDE, sp: '€ 210' },
      { n: 'Elena Sartori', s: 'A rischio', p: PILL_ROSSO, sp: '€ 95' },
    ];
    return `
    <div class="mk">
      <div class="mk-grid4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:11px">
        ${kpi({ icon: 'users', ib: '#E4EBE1', icol: SALVIA, label: 'Clienti', value: '342', delay: 0 })}
        ${kpi({ icon: 'user-plus', ib: '#E7EEF6', icol: BLU, label: 'Nuovi clienti', value: '96', delay: 0.07 })}
        ${kpi({ icon: 'user-minus', ib: '#F2E4C8', icol: ORO, label: 'A rischio', value: '57', delay: 0.14 })}
        ${kpi({ icon: 'send', ib: '#F2E4C8', icol: ORO, label: 'Campagne', value: '12', bordo: '#E0A33E', delay: 0.21 })}
      </div>
      <div class="mk-fade" style="display:flex;gap:6px;margin-bottom:10px;animation-delay:.28s">${tab('Clienti', true)}${tab('Campagne')}${tab('Coupon')}</div>
      <div class="mk-card" style="overflow:hidden">
        ${cli.map((x, i) => riga(i, 0.34 + i * 0.08, `
          <div class="mk-ic" style="width:32px;height:32px;background:#F6F4EF;font-size:12px;font-weight:700;color:${SALVIA}">${x.n[0]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;font-size:13px">${x.n}</div>
            <span class="mk-badge" style="${x.p};margin-top:3px;display:inline-block">${x.s}</span>
          </div>
          <div style="text-align:right"><div class="mk-muted" style="font-size:10px">spesa reale</div><div class="mk-val" style="font-size:13.5px">${x.sp}</div></div>`)).join('')}
      </div>
    </div>`;
  },

  assistente: () => {
    const st = (l, v) => `<div><div class="mk-muted" style="font-size:10px">${l}</div><div class="mk-val" style="font-size:13.5px">${v}</div></div>`;
    return `
    <div class="mk" style="display:flex;flex-direction:column;gap:10px">
      <div class="mk-fade mk-card" style="display:flex;align-items:center;gap:8px;padding:9px 13px;font-size:11.5px">
        <span class="mk-muted">Ultima azione:</span> <b>Ricetta aggiornata: Cheese Burger</b>
      </div>
      <div class="mk-fade" style="align-self:flex-end;max-width:80%;background:${SALVIA};color:#fff;padding:10px 13px;border-radius:16px;font-size:12.5px;animation-delay:.25s">Quanto ho incassato ieri al Porto?</div>
      <div class="mk-fade" style="align-self:flex-start;max-width:90%;animation-delay:.6s">
        <div class="mk-card" style="padding:12px 14px;border-radius:16px;font-size:12.5px;line-height:1.5">
          Ieri hai incassato <b>€ 1.248</b>, +12% rispetto allo stesso giorno del mese scorso. 🎉
          <div style="margin-top:10px;padding:10px 12px;background:#F7F5F0;border-radius:12px;display:flex;gap:16px">${st('Netto', '€ 1.023')}${st('Scontrini', '84')}${st('Medio', '€ 14,8')}</div>
          <div style="margin-top:10px">Vuoi che confronti i due locali?</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px"><span class="mk-chip">Sì, confronta</span><span class="mk-chip">Crea una campagna</span></div>
      </div>
      <div class="mk-fade mk-typing" style="align-self:flex-start;background:#fff;padding:11px 14px;border-radius:16px;display:flex;gap:5px;box-shadow:0 2px 4px rgba(32,36,31,0.05);animation-delay:1.15s">
        ${[0, 0.2, 0.4].map((d) => `<span style="width:6px;height:6px;border-radius:999px;background:${MUTED};animation-delay:${d}s"></span>`).join('')}
      </div>
      <div class="mk-fade" style="margin-top:auto;display:flex;gap:8px;align-items:center;animation-delay:1.25s">
        <div style="flex:1;background:#fff;border-radius:999px;padding:10px 15px;color:${MUTED};font-size:12px;box-shadow:0 2px 4px rgba(32,36,31,0.05)">Scrivi o detta una domanda…</div>
        <div style="width:38px;height:38px;border-radius:999px;background:#F1EDE3;display:flex;align-items:center;justify-content:center;color:${INK};flex-shrink:0">${ic('mic', 16)}</div>
        <div style="width:38px;height:38px;border-radius:999px;background:${SALVIA};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ic('send', 15)}</div>
      </div>
    </div>`;
  },

  integrazioni: () => {
    const nodo = (icon, l, s, salvia) => `
      <div style="text-align:center">
        <div style="width:48px;height:48px;border-radius:14px;background:${salvia ? SALVIA : '#F1EDE3'};display:flex;align-items:center;justify-content:center;margin:0 auto">${icon}</div>
        <div style="font-size:11.5px;font-weight:600;margin-top:6px">${l}</div><div class="mk-muted" style="font-size:10px">${s}</div>
      </div>`;
    return `
    <div class="mk" style="display:flex;flex-direction:column;gap:12px">
      <div class="mk-fade mk-h" style="font-size:14px">Collegamento cassa</div>
      <div class="mk-card mk-fade" style="padding:18px;animation-delay:.1s">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          ${nodo(ic('store', 18, INK), 'Cassa', 'Il tuo POS')}
          <div class="mk-flow" style="display:flex;gap:6px;flex:1;justify-content:center">
            ${[0, 0.25, 0.5].map((d) => `<span style="width:7px;height:7px;border-radius:999px;background:${SALVIA};animation-delay:${d}s"></span>`).join('')}
          </div>
          ${nodo('<span style="font-weight:700;color:#fff;font-size:18px">N</span>', 'Nocchiero', 'Plancia', true)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #F2EFE8">
          ${ic('check', 15, SALVIA)}<div style="font-size:12px">Sincronizzato <b>8 secondi fa</b> · 84 vendite oggi</div>
          <span class="mk-pulse mk-badge" style="${PILL_VERDE};margin-left:auto">● Live</span>
        </div>
      </div>
      <div class="mk-card mk-fade" style="padding:15px;animation-delay:.3s">
        <div style="display:flex;align-items:center;gap:11px">
          <div class="mk-ic" style="background:#EEE8F6">${ic('sparkles', 16, VIOLA)}</div>
          <div style="flex:1"><div style="font-weight:500;font-size:12.5px">Oppure importa un file</div><div class="mk-muted" style="font-size:11px">Carichi Excel/CSV, l'AI lo interpreta da sola</div></div>
          <span class="mk-chip">Sfoglia</span>
        </div>
      </div>
      <div class="mk-fade mk-muted" style="display:flex;align-items:center;gap:8px;font-size:11.5px;animation-delay:.5s">${ic('truck', 14, ORO)} Delivery partner riconosciuti in automatico</div>
    </div>`;
  },
};

document.querySelectorAll('[data-mock]').forEach((el) => {
  const make = MOCK[el.dataset.mock];
  if (make) el.innerHTML = make();
});
if (window.lucide) window.lucide.createIcons();

/* ---------- Comparse allo scorrimento (come useReveal dell'app) ---------- */
const reveal = document.querySelectorAll('.v-reveal, .v-reveal-shot');
if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  reveal.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  reveal.forEach((el) => io.observe(el));
}

/* ---------- Torna in cima ---------- */
const su = document.getElementById('torna-su');
addEventListener('scroll', () => su.classList.toggle('on', scrollY > 700), { passive: true });
su.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

/* ---------- Modulo "Richiedi una demo" ----------
   Stessa Edge Function pubblica usata da nocchiero.it (richiesta-contatto):
   accetta richieste da qualsiasi origine e non richiede login. */
const ENDPOINT = 'https://fntfysxlzerqysagbkqw.supabase.co/functions/v1/richiesta-contatto';
const form = document.getElementById('contatto-form');
const errore = document.getElementById('form-errore');
const invia = document.getElementById('form-invia');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dati = Object.fromEntries(new FormData(form));
  const mostra = (msg) => { errore.textContent = msg; errore.hidden = false; };
  errore.hidden = true;
  if (!dati.nome.trim()) return mostra('Scrivi il tuo nome.');
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(dati.email.trim())) return mostra("Controlla l'indirizzo email.");

  invia.disabled = true;
  invia.querySelector('span').textContent = 'Invio in corso…';
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.error) throw new Error(out.error || 'Invio non riuscito. Riprova o scrivici direttamente.');
    document.getElementById('form-ok-txt').textContent =
      `Grazie ${dati.nome.trim().split(' ')[0]}. Ti ricontattiamo a breve per organizzare la demo.`;
    form.hidden = true;
    document.getElementById('form-ok').hidden = false;
  } catch (err) {
    mostra(err.message || 'Invio non riuscito. Riprova o scrivici direttamente.');
    invia.disabled = false;
    invia.querySelector('span').textContent = 'Richiedi una demo';
  }
});
