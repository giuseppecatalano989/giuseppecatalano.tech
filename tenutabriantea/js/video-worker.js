// Decodifica delle copertine video in un thread separato (Web Worker), così la pagina
// non si ferma mai: qui si scarica il flusso H.264 e lo si decodifica con WebCodecs a blocchi
// (da un fotogramma chiave al successivo) attorno al punto in cui si trova chi guarda.
// I fotogrammi pronti tornano alla pagina come ImageBitmap, trasferiti senza copia.

let info, data, received = 0, decoder;
let center = 0, dir = 1, AHEAD = 40, BEHIND = 16;
const sent = new Set();      // fotogrammi già consegnati alla pagina
let busy = false, dead = false, wanted = null;

function keyOf(i) {
  const keys = info.keys;
  let lo = 0, hi = keys.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (keys[mid] <= i) lo = mid; else hi = mid - 1; }
  return lo;
}
const blockEnd = (k) => (k + 1 < info.keys.length ? info.keys[k + 1] : info.count);

// La pagina tiene solo i fotogrammi vicini: quelli lontani li ha già liberati
function forgetFar() {
  const lo = center - AHEAD - BEHIND - 24, hi = center + AHEAD + BEHIND + 24;
  for (const i of sent) if (i < lo || i > hi) sent.delete(i);
}

function nextBlock() {
  const lo = Math.max(0, center - (dir > 0 ? BEHIND : AHEAD));
  const hi = Math.min(info.count - 1, center + (dir > 0 ? AHEAD : BEHIND));
  const kc = keyOf(center), n = info.keys.length;
  const order = [kc];
  for (let d = 1; d < n; d++) {
    const a = kc + d * dir, b = kc - d * dir;
    if (a >= 0 && a < n) order.push(a);
    if (b >= 0 && b < n) order.push(b);
  }
  for (const k of order) {
    const s = info.keys[k], e = blockEnd(k);
    if (e - 1 < lo || s > hi) continue;
    if (info.offsets[e] > received) continue;
    for (let i = Math.max(s, lo); i < Math.min(e, hi + 1); i++) if (!sent.has(i)) return k;
  }
  return -1;
}

async function pump() {
  if (busy || dead || !decoder) return;
  busy = true;
  try {
    for (;;) {
      const k = nextBlock();
      if (k < 0) break;
      const s = info.keys[k], e = blockEnd(k);
      wanted = new Set();
      for (let i = s; i < e; i++) if (!sent.has(i)) wanted.add(i);
      const pending = [];
      decoder.ondone = pending;
      for (let i = s; i < e; i++) {
        decoder.decode(new EncodedVideoChunk({
          type: i === s ? "key" : "delta",
          timestamp: i,
          data: data.subarray(info.offsets[i], info.offsets[i + 1]),
        }));
      }
      await decoder.flush();
      await Promise.all(pending);
    }
  } catch (e) {
    if (!dead) { dead = true; postMessage({ type: "error", message: String(e) }); }
  } finally {
    busy = false;
  }
}

function output(frame) {
  const i = frame.timestamp;
  if (!wanted || !wanted.has(i)) { frame.close(); return; }
  sent.add(i);
  decoder.ondone.push(
    createImageBitmap(frame)
      .then((bitmap) => postMessage({ type: "frame", i, bitmap }, [bitmap]))
      .catch(() => sent.delete(i))
      .finally(() => frame.close())
  );
}

onmessage = async ({ data: msg }) => {
  if (msg.type === "init") {
    info = msg.info;
    AHEAD = msg.ahead; BEHIND = msg.behind;
    data = new Uint8Array(info.offsets[info.count]);
    try {
      decoder = new VideoDecoder({
        output,
        error: (e) => { if (!dead) { dead = true; postMessage({ type: "error", message: String(e) }); } },
      });
      decoder.configure(msg.config);
      const r = await fetch(msg.src);
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done || dead) break;
        data.set(value, received);
        received += value.length;
        postMessage({ type: "progress", received, total: data.length });
        pump();
      }
    } catch (e) {
      if (!dead) { dead = true; postMessage({ type: "error", message: String(e) }); }
    }
  } else if (msg.type === "center") {
    center = msg.center; dir = msg.dir;
    forgetFar();
    pump();
  }
};
