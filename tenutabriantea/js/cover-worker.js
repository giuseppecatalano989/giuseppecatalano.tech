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
// Tre accorgimenti per la fluidità:
// - inerzia: l'immagine non salta alla posizione dello scorrimento, la raggiunge in pochi
//   centesimi di secondo (uno scatto della rotella diventa una scivolata);
// - fusione: la posizione mostrata cade quasi sempre tra due fotogrammi, e si disegnano tutti e
//   due, il secondo in trasparenza: il movimento sembra continuo anche tra un fotogramma e l'altro.
//   A scorrimento fermo l'immagine si posa sul fotogramma più vicino, quindi resta nitida;
// - due livelli: sui computer c'è anche un flusso leggero (960 px). Quando lo scorrimento è
//   veloce si decodifica quello, che costa un quarto, e si torna al flusso pieno appena si
//   rallenta. Serve anche quando il flusso pieno non è ancora arrivato.

const AHEAD = 24, BEHIND = 12;    // fotogrammi pronti davanti e dietro, nel verso dello scorrimento
const CHUNK = 4;                  // gruppi (da un fotogramma chiave al successivo) per richiesta
// Lo scorrimento è "veloce" quando chiede più fotogrammi al secondo di quanti la scheda grafica ne
// decodifichi (flusso pieno) usando un quarto del suo tempo. Il costo di un fotogramma si misura
// mentre si lavora (dipende dal dispositivo): all'inizio si parte prudenti.
let BUDGET = 0.25;

let canvas, ctx, debug = false, dead = false;
let hi = null, lo = null;         // flusso pieno e flusso leggero (quest'ultimo solo sui computer)
let goal = 0, pos = 0, dir = 1;   // posizione voluta (0 → 1) e mostrata (in fotogrammi, frazionaria)
let tau = 0.09;                   // costante di tempo dell'inerzia, in secondi
let cssW = 0, cssH = 0, dpr = 1, busy = false, ticking = false, lastTick = 0;
let speed = 0, lastMsgAt = 0, lastMsgF = 0, wake = 0, drawnKey = "", lastStepAt = 0;

const fail = (e) => { if (!dead) { dead = true; postMessage({ type: "error", message: String(e) }); } };
const count = () => hi.info.count;
const goalFrame = () => goal * (count() - 1);
const shownFrame = () => Math.max(0, Math.min(count() - 1, Math.round(pos)));
// Velocità attuale: se da un po' non arrivano posizioni nuove, lo scorrimento si è fermato
const currentSpeed = () => (performance.now() - lastMsgAt > 120 ? 0 : speed);
const fastThreshold = () => Math.max(60, Math.min(400, (BUDGET * 1000) / hi.msPerFrame));
const isFast = () => currentSpeed() > fastThreshold();
// Si passa al flusso leggero solo quando il pieno non ce la fa davvero: oltre metà dei fotogrammi
// al secondo che la scheda grafica sa decodificare, e comunque oltre 140 (circa 1300 px/s di scorrimento)
const lowThreshold = () => Math.max(140, 500 / hi.msPerFrame);
const useLow = () => !!lo && currentSpeed() > lowThreshold();
const raf = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);

/* ---------- Flussi ---------- */
async function openTier(name, index, src) {
  const info = await fetch(index).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  const config = { codec: info.codec, codedWidth: info.width, codedHeight: info.height, optimizeForLatency: true };
  if (!(await VideoDecoder.isConfigSupported(config)).supported) throw new Error("codec non supportato");
  const T = {
    name, info, src, data: new Uint8Array(info.offsets[info.count]), groups: info.keys.length,
    bitmaps: new Map(), pendingOut: null, inflight: 0, wholeFile: false, retries: 0, msPerFrame: 6,
    crop: [0, 0, 1, 1],
  };
  T.haveGroup = new Uint8Array(T.groups);
  T.chunks = [];
  for (let g = 0; g < T.groups; g += CHUNK) T.chunks.push([g, Math.min(T.groups, g + CHUNK)]);
  T.chunkState = new Uint8Array(T.chunks.length);
  T.decoder = new VideoDecoder({ output: (f) => output(T, f), error: fail });
  T.decoder.configure(config);
  return T;
}

// Gruppo (da un fotogramma chiave al successivo) che contiene il fotogramma i
function groupOf(T, i) {
  const k = T.info.keys;
  let a = 0, b = k.length - 1;
  while (a < b) { const mid = (a + b + 1) >> 1; if (k[mid] <= i) a = mid; else b = mid - 1; }
  return a;
}
const groupStart = (T, g) => T.info.keys[g];
const groupEnd = (T, g) => (g + 1 < T.info.keys.length ? T.info.keys[g + 1] : T.info.count); // escluso

/* ---------- Misure ---------- */
function setSize(w, h, ratio) {
  cssW = w; cssH = h; dpr = ratio;
  if (!hi || !w || !h) return;
  // Tanti pixel quanti ne ha lo schermo (fino a 1,5× sugli schermi ad alta densità), mai più del video
  const r = Math.max(0.5, Math.min(dpr, 1.5, hi.info.width / w));
  canvas.width = Math.round(w * r);
  canvas.height = Math.round(h * r);
  for (const T of [hi, lo]) {
    if (!T) continue;
    const s = Math.max(canvas.width / T.info.width, canvas.height / T.info.height);
    const sw = canvas.width / s, sh = canvas.height / s;
    T.crop = [(T.info.width - sw) / 2, (T.info.height - sh) / 2, sw, sh];
  }
  ctx.imageSmoothingQuality = "high";
  // I fotogrammi pronti sono interi: valgono anche con la misura nuova, basta ridisegnare
  drawnKey = "";
  draw();
  pump();
}

/* ---------- Scaricamento a pezzi ---------- */
function chunkOrder(T) {
  // Prima il pezzo che contiene il punto voluto, poi quelli vicini nel verso dello scorrimento
  const c = Math.floor(groupOf(T, Math.round(goalFrame())) / CHUNK), n = T.chunks.length;
  const order = [c];
  for (let d = 1; d < n; d++) {
    const a = c + d * dir, b = c - d * dir;
    if (a >= 0 && a < n) order.push(a);
    if (b >= 0 && b < n) order.push(b);
  }
  return order;
}

function download() {
  if (dead) return;
  // Flusso pieno: tre richieste insieme. Flusso leggero: una, in parallelo (è piccolo e arriva presto)
  fetchChunks(hi, 3);
  if (lo) fetchChunks(lo, 1);
}

function fetchChunks(T, parallel) {
  if (T.wholeFile) return;
  while (T.inflight < parallel) {
    const c = chunkOrder(T).find((k) => T.chunkState[k] === 0);
    if (c === undefined) return;
    T.chunkState[c] = 1;
    T.inflight++;
    const [g0, g1] = T.chunks[c];
    const from = T.info.offsets[groupStart(T, g0)], to = T.info.offsets[groupEnd(T, g1 - 1)] - 1;
    fetch(T.src, { headers: { Range: `bytes=${from}-${to}` } })
      .then(async (r) => {
        if (r.status === 206) {
          T.data.set(new Uint8Array(await r.arrayBuffer()), from);
          for (let g = g0; g < g1; g++) T.haveGroup[g] = 1;
          T.chunkState[c] = 2;
        } else if (r.ok) {
          // Il server non accetta le richieste a pezzi: si legge il file intero, in streaming
          T.wholeFile = true;
          await streamWhole(T, r);
        } else throw new Error(`HTTP ${r.status}`);
      })
      .catch((e) => { T.chunkState[c] = 0; if (++T.retries > 20) fail(e); })
      .finally(() => { T.inflight--; pump(); download(); });
  }
}

async function streamWhole(T, r) {
  const reader = r.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || dead) break;
    T.data.set(value, received);
    received += value.length;
    for (let g = 0; g < T.groups; g++) if (!T.haveGroup[g] && T.info.offsets[groupEnd(T, g)] <= received) T.haveGroup[g] = 1;
    pump();
  }
  T.chunkState.fill(2);
}

/* ---------- Decodifica ---------- */
// Finestra attorno al fotogramma mostrato, allungata nel verso dello scorrimento (dove sta la
// posizione voluta, che l'inerzia raggiunge tra poco)
function windowRange() {
  const t = shownFrame();
  const a = Math.max(0, t - (dir > 0 ? BEHIND : AHEAD));
  const b = Math.min(count() - 1, t + (dir > 0 ? AHEAD : BEHIND));
  return [a, b];
}

// Il prossimo gruppo da decodificare: quello del punto mostrato, poi i vicini nel verso dello scorrimento
function nextGroup(T) {
  const [a, b] = windowRange();
  const gt = groupOf(T, shownFrame());
  const order = [gt];
  for (let d = 1; d < T.groups; d++) {
    const x = gt + d * dir, y = gt - d * dir;
    if (x >= 0 && x < T.groups) order.push(x);
    if (y >= 0 && y < T.groups) order.push(y);
  }
  for (const g of order) {
    const s = groupStart(T, g), e = groupEnd(T, g) - 1;
    if (e < a || s > b) continue;
    if (!T.haveGroup[g]) continue;
    for (let i = Math.max(s, a); i <= Math.min(e, b); i++) if (!T.bitmaps.has(i)) return g;
  }
  return -1;
}

function evict(T) {
  if (!T) return;
  const [a, b] = windowRange();
  for (const [i, bm] of T.bitmaps) {
    if (i < a - 6 || i > b + 6) { bm.close(); T.bitmaps.delete(i); }
  }
}

async function decodeGroup(T, g, keepLo, keepHi) {
  const s = groupStart(T, g), e = groupEnd(T, g);
  T.pendingOut = { lo: keepLo, hi: keepHi, jobs: [] };
  const t0 = performance.now();
  for (let i = s; i < e; i++) {
    T.decoder.decode(new EncodedVideoChunk({
      type: i === s ? "key" : "delta", timestamp: i, data: T.data.subarray(T.info.offsets[i], T.info.offsets[i + 1]),
    }));
  }
  await T.decoder.flush();
  await Promise.all(T.pendingOut.jobs);
  T.pendingOut = null;
  const spent = performance.now() - t0;
  T.msPerFrame = T.msPerFrame * 0.7 + (spent / (e - s)) * 0.3;
  draw();
  return spent;
}

// Scorrimento veloce: si decodifica il gruppo che contiene il fotogramma che sarà a schermo tra un
// istante e se ne tengono i fotogrammi da lì in avanti nel verso dello scorrimento; poi una pausa
// lunga quanto la decodifica, così la scheda grafica resta occupata al massimo per metà del tempo.
async function decodeAhead(T) {
  const v = currentSpeed() * dir;
  const t = Math.max(0, Math.min(count() - 1, Math.round(pos + v * 0.04)));
  const g = groupOf(T, t);
  if (T.bitmaps.has(t) || !T.haveGroup[g]) return false;
  const s = groupStart(T, g), last = dir > 0 ? groupEnd(T, g) - 1 : t;
  const spent = await decodeGroup(T, g, dir > 0 ? t : s, last);
  await new Promise((r) => setTimeout(r, Math.max(8, spent)));
  return true;
}

async function pump() {
  if (busy || dead || !hi || !canvas.width) return;
  busy = true;
  try {
    for (;;) {
      evict(hi); evict(lo);
      if (useLow()) {
        // Molto veloce: il flusso leggero, che costa un quarto
        if (await decodeAhead(lo)) continue;
        break;
      }
      if (isFast()) {
        // Veloce: solo il fotogramma che andrà a schermo, dal flusso pieno
        if (await decodeAhead(hi)) continue;
        break;
      }
      const [a, b] = windowRange();
      const g = nextGroup(hi);
      if (g >= 0) {
        await decodeGroup(hi, g, Math.max(a - 6, groupStart(hi, g)), Math.min(b + 6, groupEnd(hi, g) - 1));
        continue;
      }
      // Il flusso pieno qui non è ancora arrivato: intanto il leggero, meglio che restare fermi
      const t = shownFrame();
      if (lo && !hi.haveGroup[groupOf(hi, t)] && !lo.bitmaps.has(t) && lo.haveGroup[groupOf(lo, t)]) {
        const gl = groupOf(lo, t);
        await decodeGroup(lo, gl, groupStart(lo, gl), groupEnd(lo, gl) - 1);
        continue;
      }
      break;
    }
  } catch (e) {
    fail(e);
  } finally {
    busy = false;
  }
  // Quando lo scorrimento veloce si ferma davvero (nessuna posizione nuova da 120 ms), si torna a
  // preparare tutti i fotogrammi vicini. Finché le posizioni arrivano, la velocità resta quella misurata.
  clearTimeout(wake);
  if (isFast()) wake = setTimeout(pump, 140);
}

function output(T, frame) {
  const i = frame.timestamp;
  const P = T.pendingOut;
  const want = P && i >= P.lo && i <= P.hi && !T.bitmaps.has(i);
  if (!want) { frame.close(); return; }
  // Copia del fotogramma così com'è, che resta nella scheda grafica: ritaglio e ridimensionamento
  // si fanno al momento del disegno. (Ritagliare qui con createImageBitmap(frame, sx, sy, …,
  // { resizeWidth }) costringe a passare dalla memoria centrale e rallenta tutta la pagina.)
  P.jobs.push(
    createImageBitmap(frame)
      .then((bm) => {
        T.bitmaps.get(i)?.close();
        T.bitmaps.set(i, bm);
        if (Math.abs(i - pos) < 1.5) draw();
      })
      .catch(() => {})
      .finally(() => frame.close())
  );
}

/* ---------- Disegno ---------- */
function paint(T, i, alpha) {
  const [sx, sy, sw, sh] = T.crop;
  ctx.globalAlpha = alpha;
  ctx.drawImage(T.bitmaps.get(i), sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

function draw() {
  if (dead || !hi) return;
  const i0 = Math.max(0, Math.min(count() - 1, Math.floor(pos)));
  const i1 = Math.min(count() - 1, i0 + 1);
  const a = pos - i0;
  const blend = a > 0.03 && a < 0.97 && i1 !== i0 && !isFast();
  const has = (T, i) => T && T.bitmaps.has(i);
  let plan = null;   // [flusso, primo fotogramma, secondo fotogramma o -1, peso del secondo]

  if (blend && has(hi, i0) && has(hi, i1)) plan = [hi, i0, i1, a];
  else if (blend && has(lo, i0) && has(lo, i1) && !has(hi, Math.round(pos))) plan = [lo, i0, i1, a];
  else {
    const r = Math.round(pos);
    if (has(hi, r) && !useLow()) plan = [hi, r, -1, 0];
    else if (has(lo, r)) plan = [lo, r, -1, 0];
    else if (has(hi, r)) plan = [hi, r, -1, 0];
    else {
      // Il fotogramma giusto non è ancora pronto: il più vicino disponibile, se è meglio di quello a schermo
      let best = null, d = Infinity;
      for (const T of [hi, lo]) if (T) for (const i of T.bitmaps.keys()) { const k = Math.abs(i - pos); if (k < d) { d = k; best = [T, i, -1, 0]; } }
      if (!best) return;
      const cur = drawnKey && +drawnKey.split(":")[1];
      if (drawnKey && Math.abs(cur - pos) <= d) return;
      plan = best;
    }
  }
  const [T, f0, f1, w] = plan;
  const key = `${T.name}:${f0}:${f1}:${Math.round(w * 48)}`;
  if (key === drawnKey) return;
  paint(T, f0, 1);
  if (f1 >= 0) paint(T, f1, w);
  ctx.globalAlpha = 1;
  drawnKey = key;
  // Per tools/misura-copertina.mjs: istante del disegno e posizione mostrata (frazionaria se c'è
  // la fusione), su un orologio comune a pagina e worker
  if (debug) postMessage({ type: "drawn", i: f1 >= 0 ? f0 + w : f0, t: goalFrame(), tier: T.name, at: performance.timeOrigin + performance.now() });
}

/* ---------- Inerzia ---------- */
// Un passo dell'inerzia: la posizione mostrata si avvicina a quella voluta in proporzione al tempo
// trascorso. Restituisce true se c'è ancora strada da fare.
function step(now) {
  if (dead || !hi) return false;
  const dt = Math.min(0.064, Math.max(0, (now - lastTick) / 1000));
  lastTick = Math.max(lastTick, now);
  lastStepAt = performance.now();
  // A scorrimento fermo si punta al fotogramma intero più vicino: l'immagine ferma è sempre nitida
  const idle = performance.now() - lastMsgAt > 150;
  const aim = idle ? Math.round(goalFrame()) : goalFrame();
  pos = tau > 0 ? pos + (aim - pos) * (1 - Math.exp(-dt / tau)) : aim;
  if (Math.abs(aim - pos) < 0.02) pos = aim;
  draw();
  return pos !== aim || !idle;
}

function tick(now) {
  ticking = false;
  // Un passo per refresh: se la pagina ha appena mandato una posizione, è già stato fatto
  if (performance.now() - lastStepAt < 6) { start(); return; }
  if (step(now)) start();
  pump();
}

function start() {
  if (ticking) return;
  ticking = true;
  raf((t) => tick(t));
}

/* ---------- Messaggi dalla pagina ---------- */
onmessage = async ({ data: m }) => {
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d", { alpha: true, desynchronized: false });
    debug = !!m.debug;
    if (debug && m.budget) BUDGET = m.budget;   // solo per le misure (?misura&budget=0.2)
    if (typeof m.tau === "number") tau = m.tau;
    goal = m.p || 0;
    try {
      hi = await openTier("pieno", m.index, m.src);
      pos = goalFrame();
      if (m.low) lo = await openTier("leggero", m.low.index, m.low.src).catch(() => null);
      lastTick = performance.now();
      setSize(m.w, m.h, m.dpr);
      postMessage({ type: "ready", count: count() });
      download();
    } catch (e) {
      fail(e);
    }
  } else if (m.type === "p") {
    goal = m.p;
    if (!hi) return;
    const t = performance.now(), f = goalFrame(), dt = t - lastMsgAt;
    if (f !== lastMsgF) dir = f > lastMsgF ? 1 : -1;
    // Velocità, media mobile delle ultime posizioni (in fotogrammi al secondo)
    speed = dt > 0 && dt < 200 ? speed * 0.6 + (Math.abs(f - lastMsgF) / dt) * 1000 * 0.4 : 0;
    lastMsgAt = t; lastMsgF = f;
    // Un passo dell'inerzia subito, al ritmo della pagina (che manda una posizione a ogni refresh):
    // non si dipende solo dal requestAnimationFrame del worker, che il browser può rallentare
    if (t - lastStepAt >= 6) step(t);   // (se il refresh l'ha appena fatto, basta il prossimo)
    start();
    pump();
    download();
  } else if (m.type === "size") {
    setSize(m.w, m.h, m.dpr);
  }
};
