// Motore delle copertine animate ("sequenza", preparata con tools/prepara_sequenza.py).
// Tutto il lavoro avviene qui, in un thread separato: scaricamento a pezzi (richieste Range),
// decodifica con WebCodecs e disegno sul canvas, che la pagina ha ceduto al worker
// (OffscreenCanvas). La pagina manda soltanto la posizione dello scorrimento (0 → 1):
// anche se è occupata, la copertina continua a rispondere.
//
// Il flusso H.264 ha un fotogramma chiave ogni 6: per mostrare un fotogramma qualsiasi
// se ne decodificano al massimo 6. Si tiene pronta solo una finestra di fotogrammi attorno
// al punto in cui ci si trova: disegnare è una copia ritagliata, fatta dalla scheda grafica.
//
// Quando lo scorrimento è veloce non si possono decodificare tutti i fotogrammi attraversati:
// la scheda grafica, saturata, rallenterebbe tutta la pagina. Allora si decodifica soltanto il
// fotogramma che andrà a schermo, e tra una decodifica e l'altra la si lascia libera.

const AHEAD = 24, BEHIND = 12;    // fotogrammi pronti davanti e dietro, nel verso dello scorrimento
const CHUNK = 4;                  // gruppi (da un fotogramma chiave al successivo) per richiesta
const PARALLEL = 3;               // richieste contemporanee
// Lo scorrimento è "veloce" quando chiede più fotogrammi al secondo di quanti la scheda grafica ne
// decodifichi usando un quarto del suo tempo. Il costo di un fotogramma si misura mentre si lavora
// (dipende dal dispositivo e dalla variante): all'inizio si parte prudenti.
let BUDGET = 0.25;
let msPerFrame = 6;
const fastThreshold = () => Math.max(60, Math.min(400, (BUDGET * 1000) / msPerFrame));

let info, canvas, ctx, src, debug = false;
let data, groups, chunks, haveGroup, chunkState;
let decoder, busy = false, dead = false;
let target = 0, dir = 1, drawn = -1, cssW = 0, cssH = 0, dpr = 1;
let crop = [0, 0, 1, 1];
const bitmaps = new Map();        // indice → ImageBitmap del fotogramma intero (nella scheda grafica)
let pendingOut = null;            // fotogrammi attesi dalla decodifica in corso
let inflight = 0, wholeFile = false;
let speed = 0, lastMsgAt = 0, lastMsgF = 0, wake = 0;   // velocità dello scorrimento, in fotogrammi al secondo

const fail = (e) => { if (!dead) { dead = true; postMessage({ type: "error", message: String(e) }); } };

// Gruppo (da un fotogramma chiave al successivo) che contiene il fotogramma i
function groupOf(i) {
  const k = info.keys;
  let lo = 0, hi = k.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (k[mid] <= i) lo = mid; else hi = mid - 1; }
  return lo;
}
const groupStart = (g) => info.keys[g];
const groupEnd = (g) => (g + 1 < info.keys.length ? info.keys[g + 1] : info.count); // escluso

/* ---------- Misure ---------- */
function setSize(w, h, ratio) {
  cssW = w; cssH = h; dpr = ratio;
  if (!info || !w || !h) return;
  // Tanti pixel quanti ne ha lo schermo (fino a 1,5× sugli schermi ad alta densità), mai più del video
  const r = Math.max(0.5, Math.min(dpr, 1.5, info.width / w));
  canvas.width = Math.round(w * r);
  canvas.height = Math.round(h * r);
  const s = Math.max(canvas.width / info.width, canvas.height / info.height);
  const sw = canvas.width / s, sh = canvas.height / s;
  crop = [(info.width - sw) / 2, (info.height - sh) / 2, sw, sh];
  ctx.imageSmoothingQuality = "high";
  // I fotogrammi pronti sono interi: valgono anche con la misura nuova, basta ridisegnare
  drawn = -1;
  draw();
  pump();
}

/* ---------- Scaricamento a pezzi ---------- */
function chunkOrder() {
  // Prima il pezzo che contiene il punto corrente, poi quelli vicini nel verso dello scorrimento
  const c = Math.floor(groupOf(targetFrame()) / CHUNK), n = chunks.length;
  const order = [c];
  for (let d = 1; d < n; d++) {
    const a = c + d * dir, b = c - d * dir;
    if (a >= 0 && a < n) order.push(a);
    if (b >= 0 && b < n) order.push(b);
  }
  return order;
}

function download() {
  if (dead || wholeFile) return;
  while (inflight < PARALLEL) {
    const c = chunkOrder().find((k) => chunkState[k] === 0);
    if (c === undefined) return;
    chunkState[c] = 1;
    inflight++;
    const [g0, g1] = chunks[c];
    const from = info.offsets[groupStart(g0)], to = info.offsets[groupEnd(g1 - 1)] - 1;
    fetch(src, { headers: { Range: `bytes=${from}-${to}` } })
      .then(async (r) => {
        if (r.status === 206) {
          data.set(new Uint8Array(await r.arrayBuffer()), from);
          for (let g = g0; g < g1; g++) haveGroup[g] = 1;
          chunkState[c] = 2;
        } else if (r.ok) {
          // Il server non accetta le richieste a pezzi: si legge il file intero, in streaming
          wholeFile = true;
          await streamWhole(r);
        } else throw new Error(`HTTP ${r.status}`);
      })
      .catch((e) => { chunkState[c] = 0; if (++retries > 20) fail(e); })
      .finally(() => { inflight--; pump(); download(); });
  }
}
let retries = 0;

async function streamWhole(r) {
  const reader = r.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || dead) break;
    data.set(value, received);
    received += value.length;
    for (let g = 0; g < groups; g++) if (!haveGroup[g] && info.offsets[groupEnd(g)] <= received) haveGroup[g] = 1;
    pump();
  }
  chunkState.fill(2);
}

/* ---------- Decodifica ---------- */
const targetFrame = () => Math.round(target * (info.count - 1));

function windowRange() {
  const t = targetFrame();
  const lo = Math.max(0, t - (dir > 0 ? BEHIND : AHEAD));
  const hi = Math.min(info.count - 1, t + (dir > 0 ? AHEAD : BEHIND));
  return [lo, hi];
}

// Il prossimo gruppo da decodificare: quello del punto corrente, poi i vicini nel verso dello scorrimento
function nextGroup() {
  const [lo, hi] = windowRange();
  const gt = groupOf(targetFrame());
  const order = [gt];
  for (let d = 1; d < groups; d++) {
    const a = gt + d * dir, b = gt - d * dir;
    if (a >= 0 && a < groups) order.push(a);
    if (b >= 0 && b < groups) order.push(b);
  }
  for (const g of order) {
    const s = groupStart(g), e = groupEnd(g) - 1;
    if (e < lo || s > hi) continue;
    if (!haveGroup[g]) continue;
    for (let i = Math.max(s, lo); i <= Math.min(e, hi); i++) if (!bitmaps.has(i)) return g;
  }
  return -1;
}

function evict() {
  const [lo, hi] = windowRange();
  for (const [i, bm] of bitmaps) {
    if (i < lo - 6 || i > hi + 6) { bm.close(); bitmaps.delete(i); }
  }
}

// Velocità attuale: se da un po' non arrivano posizioni nuove, lo scorrimento si è fermato
const currentSpeed = () => (performance.now() - lastMsgAt > 120 ? 0 : speed);

// Scorrimento veloce: si decodifica il gruppo che contiene il fotogramma che sarà a schermo tra un
// istante, e se ne tengono i fotogrammi da lì in avanti nel verso dello scorrimento (i refresh
// successivi li trovano già pronti); poi una pausa lunga quanto la decodifica, così la scheda grafica
// resta occupata al massimo per metà del tempo.
async function decodeAhead() {
  const v = currentSpeed() * dir;
  const t = Math.max(0, Math.min(info.count - 1, Math.round(target * (info.count - 1) + v * 0.04)));
  const g = groupOf(t);
  if (bitmaps.has(t) || !haveGroup[g]) return false;
  const s = groupStart(g), last = dir > 0 ? groupEnd(g) - 1 : t;
  pendingOut = { lo: dir > 0 ? t : s, hi: last, jobs: [] };
  const t0 = performance.now();
  for (let i = s; i <= last; i++) {
    decoder.decode(new EncodedVideoChunk({ type: i === s ? "key" : "delta", timestamp: i, data: data.subarray(info.offsets[i], info.offsets[i + 1]) }));
  }
  await decoder.flush();
  await Promise.all(pendingOut.jobs);
  pendingOut = null;
  draw();
  const spent = performance.now() - t0;
  msPerFrame = msPerFrame * 0.7 + (spent / (last - s + 1)) * 0.3;
  await new Promise((r) => setTimeout(r, Math.max(8, spent)));
  return true;
}

async function pump() {
  if (busy || dead || !decoder || !canvas.width) return;
  busy = true;
  try {
    for (;;) {
      evict();
      if (currentSpeed() > fastThreshold()) {
        if (!(await decodeAhead())) break;
        continue;
      }
      const g = nextGroup();
      if (g < 0) break;
      const s = groupStart(g), e = groupEnd(g);
      const [lo, hi] = windowRange();
      pendingOut = { lo: Math.max(lo - 6, s), hi: Math.min(hi + 6, e - 1), jobs: [] };
      for (let i = s; i < e; i++) {
        decoder.decode(new EncodedVideoChunk({
          type: i === s ? "key" : "delta",
          timestamp: i,
          data: data.subarray(info.offsets[i], info.offsets[i + 1]),
        }));
      }
      const t0 = performance.now();
      await decoder.flush();
      await Promise.all(pendingOut.jobs);
      msPerFrame = msPerFrame * 0.7 + ((performance.now() - t0) / (e - s)) * 0.3;
      pendingOut = null;
      draw();
    }
  } catch (e) {
    fail(e);
  } finally {
    busy = false;
  }
  // Quando lo scorrimento veloce si ferma davvero (nessuna posizione nuova da 120 ms), si torna a
  // preparare tutti i fotogrammi vicini. Finché le posizioni arrivano, la velocità resta quella misurata.
  clearTimeout(wake);
  if (currentSpeed() > fastThreshold()) wake = setTimeout(pump, 140);
}

function output(frame) {
  const i = frame.timestamp;
  const want = pendingOut && i >= pendingOut.lo && i <= pendingOut.hi && !bitmaps.has(i);
  if (!want) { frame.close(); return; }
  // Copia del fotogramma così com'è, che resta nella scheda grafica: ritaglio e ridimensionamento
  // si fanno al momento del disegno. (Ritagliare qui con createImageBitmap(frame, sx, sy, …,
  // { resizeWidth }) costringe a passare dalla memoria centrale e rallenta tutta la pagina.)
  pendingOut.jobs.push(
    createImageBitmap(frame)
      .then((bm) => {
        bitmaps.get(i)?.close();
        bitmaps.set(i, bm);
        if (i === targetFrame()) draw();
      })
      .catch(() => {})
      .finally(() => frame.close())
  );
}

/* ---------- Disegno ---------- */
function draw() {
  if (dead || !bitmaps.size) return;
  const t = targetFrame();
  let best = bitmaps.has(t) ? t : -1;
  if (best < 0) {
    // Il fotogramma giusto non è ancora pronto: il più vicino disponibile, se è meglio di quello a schermo
    let d = Infinity;
    for (const i of bitmaps.keys()) { const k = Math.abs(i - t); if (k < d) { d = k; best = i; } }
    if (drawn >= 0 && bitmaps.has(drawn) && Math.abs(drawn - t) <= d) return;
  }
  if (best === drawn) return;
  const [sx, sy, sw, sh] = crop;
  ctx.drawImage(bitmaps.get(best), sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  drawn = best;
  // Per tools/misura-copertina.mjs: istante del disegno su un orologio comune a pagina e worker
  if (debug) postMessage({ type: "drawn", i: best, t, at: performance.timeOrigin + performance.now() });
}

/* ---------- Messaggi dalla pagina ---------- */
onmessage = async ({ data: m }) => {
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d", { alpha: true, desynchronized: false });
    src = m.src;
    debug = !!m.debug;
    if (debug && m.budget) BUDGET = m.budget;   // solo per le misure (?misura&budget=0.2)
    target = m.p || 0;
    try {
      info = await fetch(m.index).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
      const config = { codec: info.codec, codedWidth: info.width, codedHeight: info.height, optimizeForLatency: true };
      const { supported } = await VideoDecoder.isConfigSupported(config);
      if (!supported) throw new Error("codec non supportato");
      decoder = new VideoDecoder({ output, error: fail });
      decoder.configure(config);
      data = new Uint8Array(info.offsets[info.count]);
      groups = info.keys.length;
      haveGroup = new Uint8Array(groups);
      chunks = [];
      for (let g = 0; g < groups; g += CHUNK) chunks.push([g, Math.min(groups, g + CHUNK)]);
      chunkState = new Uint8Array(chunks.length);
      setSize(m.w, m.h, m.dpr);
      postMessage({ type: "ready", count: info.count });
      download();
    } catch (e) {
      fail(e);
    }
  } else if (m.type === "p") {
    if (!info) { target = m.p; return; }
    const before = targetFrame();
    target = m.p;
    const now = targetFrame();
    if (now !== before) dir = now > before ? 1 : -1;
    // Velocità, media mobile delle ultime posizioni
    const t = performance.now(), f = target * (info.count - 1), dt = t - lastMsgAt;
    speed = dt > 0 && dt < 200 ? speed * 0.6 + (Math.abs(f - lastMsgF) / dt) * 1000 * 0.4 : 0;
    lastMsgAt = t; lastMsgF = f;
    draw();
    pump();
    download();
  } else if (m.type === "size") {
    setSize(m.w, m.h, m.dpr);
  }
};
