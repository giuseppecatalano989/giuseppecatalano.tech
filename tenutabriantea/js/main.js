/* =========================================================
   Tenuta Briantea — script comune a tutte le pagine
   Ogni modulo si attiva solo se nella pagina trova i suoi elementi.
   ========================================================= */

const CONFIG = {
  // Numero WhatsApp in formato internazionale, solo cifre (es. 393331234567)
  whatsappNumber: "390000000000",

  // Endpoint che riceve le richieste di prenotazione (Formspree, backend proprio…).
  // Se null, il form mostra la conferma senza inviare dati.
  bookingEndpoint: null,

  // Posizione della tenuta: usata per alba, tramonto e meteo del "Lunario"
  location: { lat: 45.70, lon: 9.27 },

  // Meteo in tempo reale da Open-Meteo (gratuito, senza chiave). false per disattivarlo.
  liveWeather: true,

  cover: {
    smoothing: 0.12, // 0–1: quanto la copertina "insegue" lo scorrimento (più basso = più morbido)
  },
};

// Piatti della carta e mesi in cui sono disponibili (1 = gennaio).
// Usati per il "piatto del giorno" nelle pagine senza la carta. Tenere allineati con osteria.html.
const DISHES = [
  ["Mondeghili", "all"],
  ["Busecca", [10, 11, 12, 1, 2, 3]],
  ["Risòtt giald cont la luganega", "all"],
  ["Cassœula", [11, 12, 1, 2]],
  ["Rostìn negàa", "all"],
  ["Brasàa cont la polenta", [10, 11, 12, 1, 2, 3, 4]],
  ["Torta de pan", "all"],
  ["Pan de mej", [4, 5]],
  ["Castegn e mièl", [9, 10, 11]],
];

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const params = new URLSearchParams(location.search);
const month = new Date().getMonth() + 1;

document.documentElement.classList.remove("no-js");

/* ---------- Header ---------- */
const header = $("[data-header]");
const hero = $("[data-cover]") || $("[data-hero]");

function updateHeader() {
  const limit = (hero ? hero.offsetHeight : 0) - 80;
  header.classList.toggle("is-solid", window.scrollY > limit);
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

/* ---------- Indice (menu a tutto schermo) ---------- */
const menuBtn = $("[data-menu-toggle]");
const menu = $("[data-menu]");

function setMenu(open) {
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.querySelector(".hd-menu-label").textContent = open ? "Chiudi" : "Menu";
  document.body.classList.toggle("menu-open", open);
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
  } else {
    menu.classList.remove("is-open");
    setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 500);
  }
  document.dispatchEvent(new Event("menuchange"));
}
menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
$$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false); });

/* ---------- Comparse allo scroll ---------- */
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));
  // Foto (.curtain): compaiono quando entrano nello schermo e sono già caricate,
  // così la dissolvenza non parte su un'immagine ancora vuota
  const show = (el) => {
    const ready = el.tagName !== "IMG" || el.complete ? Promise.resolve() :
      new Promise((ok) => { el.addEventListener("load", ok, { once: true }); el.addEventListener("error", ok, { once: true }); });
    ready.then(() => (el.decode ? el.decode().catch(() => {}) : null)).then(() => { if (el.inView) el.classList.add("is-in"); });
  };
  const curtains = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.inView = true; show(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px" });
  // Quando la foto è uscita del tutto dallo schermo torna nascosta: al ritorno la dissolvenza si ripete
  const reset = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (!en.isIntersecting) { en.target.inView = false; en.target.classList.remove("is-in"); } });
  }, { rootMargin: "60px 0px 60px 0px" });
  // Foto vicine (es. le tre residenze in fila) entrano una dopo l'altra
  new Set($$(".curtain").map((el) => el.closest("ul, ol, .grid12, .portico")).filter(Boolean)).forEach((group) => {
    $$(".curtain", group).forEach((el, i) => el.style.setProperty("--delay", `${Math.min(i, 4) * 0.18}s`));
  });
  $$(".curtain").forEach((el) => { curtains.observe(el); reset.observe(el); });
} else {
  $$(".reveal, .curtain").forEach((el) => el.classList.add("is-in"));
}

/* =========================================================
   COPERTINE SCROLL-DRIVEN (home e pagine interne, ogni [data-cover])
   Lo scorrimento della pagina (0 → 1) guida:
   - una sequenza di fotogrammi su <canvas data-scrub-frames> (consigliata)
   - oppure uno o più <video data-scrub>: più clip si susseguono, ognuna
     occupa una parte uguale dello scorrimento
   - in assenza di entrambi, gli strati del paesaggio segnaposto
   e fa comparire le didascalie .cover-step.
   ========================================================= */
$$("[data-cover]").forEach(function initCover(cover) {
  if (reduceMotion) { cover.classList.add("is-static"); return; }

  const steps = $$(".cover-step", cover);
  const clips = $$("video[data-scrub]", cover);
  const canvas = $("canvas[data-scrub-frames]", cover);
  const frames = canvas ? frameSequence(canvas) : null;
  clips.forEach((v) => { v.muted = true; v.pause(); });
  let current = -1;

  let target = 0, p = 0, raf = null;

  function progress() {
    const span = cover.offsetHeight - window.innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -cover.getBoundingClientRect().top / span)) : 0;
  }

  function render() {
    p += (target - p) * CONFIG.cover.smoothing;
    if (Math.abs(target - p) < 0.0005) p = target;
    cover.style.setProperty("--p", p.toFixed(4));
    steps.forEach((s) => s.classList.toggle("is-active", p >= +s.dataset.from && p < +s.dataset.to));

    if (frames) frames.draw(p);
    if (clips.length) {
      const n = clips.length;
      const i = Math.min(n - 1, Math.floor(p * n));
      const v = clips[i];
      if (i !== current) {
        clips.forEach((c, j) => c.classList.toggle("is-current", j === i));
        current = i;
      }
      if (v.duration && !v.seeking) {
        const t = Math.min(1, p * n - i) * (v.duration - 0.05);
        if (Math.abs(v.currentTime - t) > 1 / 60) v.currentTime = t;
      }
    }
    raf = p !== target ? requestAnimationFrame(render) : null;
  }

  const update = () => { target = progress(); if (!raf) raf = requestAnimationFrame(render); };
  // Un salto richiesto mentre il video stava ancora cercando va ripetuto quando ha finito
  clips.forEach((v) => v.addEventListener("seeked", () => { if (!raf) raf = requestAnimationFrame(render); }));
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => { if (frames) frames.resize(); update(); });
});

// Sequenza di fotogrammi disegnata su canvas, con caricamento progressivo
function frameSequence(canvas) {
  // Sui telefoni una serie più leggera (data-scrub-frames-mobile), un fotogramma su due
  const light = window.matchMedia("(max-width: 900px)").matches || navigator.connection?.saveData;
  const pattern = (light && canvas.dataset.scrubFramesMobile) || canvas.dataset.scrubFrames;
  const count = parseInt(canvas.dataset.count, 10);
  const pad = (pattern.match(/#+/) || ["#"])[0].length;
  const url = (i) => pattern.replace(/#+/, String(i + 1).padStart(pad, "0"));
  const ctx = canvas.getContext("2d");
  const imgs = new Array(count);
  // Stacchi (data-cuts="347,…"): fotogrammi che iniziano una nuova inquadratura; lì non si sfuma
  const cuts = (canvas.dataset.cuts || "").split(",").map(Number).filter((n) => n > 0);
  let lastP = 0, shown = null;

  // Mappa facoltativa (data-map): a quale frazione di scorrimento corrisponde ogni fotogramma.
  // Generata da tools/estrai-fotogrammi.html per rendere uniforme la velocità percepita.
  let map = null;
  if (canvas.dataset.map) {
    fetch(canvas.dataset.map)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (Array.isArray(m) && m.length === count) { map = m; shown = null; draw(lastP); } })
      .catch(() => {});
  }
  // Posizione nella sequenza, con la parte frazionaria: tra due fotogrammi si sfuma dall'uno all'altro
  function frameAt(p) {
    if (!map) return p * (count - 1);
    if (p <= map[0]) return 0;
    if (p >= map[count - 1]) return count - 1;
    let lo = 0, hi = count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (map[mid] <= p) lo = mid; else hi = mid - 1;
    }
    const span = map[lo + 1] - map[lo];
    return lo + (span > 0 ? (p - map[lo]) / span : 0);
  }

  // Prima un fotogramma ogni 16, poi via via più fitti: la sequenza è subito navigabile.
  // Sui telefoni basta un fotogramma su due: la dissolvenza tra i vicini copre la differenza.
  const order = [];
  const seen = new Set();
  (light ? [16, 8, 4, 2] : [16, 8, 4, 2, 1]).forEach((step) => {
    for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
  });
  if (light && !seen.has(count - 1)) order.push(count - 1);
  order.forEach((i) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { imgs[i] = img; shown = null; draw(lastP); };
    img.src = url(i);
  });

  // Fotogramma caricato più vicino, cercando prima all'indietro (a) o in avanti (b)
  function loadedBefore(i) { for (let k = i; k >= 0; k--) if (imgs[k]) return k; return -1; }
  function loadedAfter(i) { for (let k = i; k < count; k++) if (imgs[k]) return k; return -1; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    shown = null;
    draw(lastP);
  }
  function paint(img, alpha) {
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }
  function draw(p) {
    lastP = p;
    const f = frameAt(p);
    let a = loadedBefore(Math.floor(f)), b = loadedAfter(Math.ceil(f));
    if (a < 0) a = b;
    if (b < 0) b = a;
    if (a < 0) return;
    // Si sfuma solo tra fotogrammi vicini; durante il caricamento, con buchi più ampi, si mostra il più vicino
    let mix = b > a ? Math.min(1, Math.max(0, (f - a) / (b - a))) : 0;
    if (b - a > 2 || cuts.some((c) => a < c && c <= b)) { if (mix >= 0.5) a = b; mix = 0; }
    const key = `${a}:${b}:${mix.toFixed(3)}`;
    if (key === shown) return;
    shown = key;
    paint(imgs[a], 1);
    if (mix > 0.004) paint(imgs[b], mix);
  }
  resize();
  return { draw, resize };
}

/* ---------- Sentieri: anteprima che segue il cursore ---------- */
(function initTrails() {
  const list = $("[data-trails]");
  const preview = $("[data-trail-preview]");
  if (!list || !preview || !finePointer) return;
  const label = $("[data-trail-preview-label]");
  const img = $("[data-trail-preview-img]");
  let tx = 0, ty = 0, x = 0, y = 0, raf = null;

  function tick() {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    preview.style.setProperty("--px", `${x}px`);
    preview.style.setProperty("--py", `${y}px`);
    raf = (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) ? requestAnimationFrame(tick) : null;
  }
  list.addEventListener("pointermove", (e) => {
    tx = e.clientX + 28;
    ty = e.clientY - preview.offsetHeight / 2;
    if (!preview.classList.contains("is-on")) { x = tx; y = ty; }
    if (!raf) raf = requestAnimationFrame(tick);
  });
  $$(".trail", list).forEach((li) => {
    if (li.dataset.img) new Image().src = li.dataset.img;  // precarica: l'anteprima appare subito
    li.addEventListener("pointerenter", () => {
      label.textContent = li.dataset.preview;
      if (img && li.dataset.img) img.src = li.dataset.img;
      preview.classList.add("is-on");
    });
  });
  list.addEventListener("pointerleave", () => preview.classList.remove("is-on"));
})();

/* ---------- Un anno in tenuta: evidenzia il mese corrente ---------- */
$$("[data-year]").forEach((list) => {
  const item = $(`[data-m="${month}"]`, list);
  if (!item) return;
  item.classList.add("is-now");
  if (list.scrollWidth > list.clientWidth) {
    const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    list.scrollLeft += item.getBoundingClientRect().left - list.getBoundingClientRect().left - pad;
  }
});

/* ---------- La carta: piatti di stagione ---------- */
$$(".piatto").forEach((p) => {
  const mesi = p.dataset.mesi;
  if (!mesi || mesi === "all") return;
  p.classList.add(mesi.split(",").map(Number).includes(month) ? "in-season" : "off-season");
});

/* =========================================================
   LUNARIO — oggi in tenuta
   ========================================================= */
(function initAlmanac() {
  const set = (key, val) => $$(`[data-al="${key}"]`).forEach((el) => { el.textContent = val; });
  const now = new Date();
  const tz = "Europe/Rome";
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const dateStr = cap(new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now));
  set("date", dateStr);

  // Stagione
  const y = now.getFullYear();
  const starts = [
    ["Inverno", new Date(y - 1, 11, 21)],
    ["Primavera", new Date(y, 2, 20)],
    ["Estate", new Date(y, 5, 21)],
    ["Autunno", new Date(y, 8, 22)],
    ["Inverno", new Date(y, 11, 21)],
  ];
  let season = starts[0];
  starts.forEach((s) => { if (now >= s[1]) season = s; });
  set("season", `${season[0]}, ${Math.floor((now - season[1]) / 864e5) + 1}º giorno`);

  // Alba e tramonto
  const sun = sunTimes(now, CONFIG.location.lat, CONFIG.location.lon);
  const hm = (d) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  set("sun", `${hm(sun.rise)} · ${hm(sun.set)}`);
  const mins = Math.round((sun.set - sun.rise) / 60000);
  set("daylight", `${Math.floor(mins / 60)} ore e ${mins % 60} minuti di luce`);

  // Luna
  const moon = moonPhase(now);
  set("moon", moon.name);
  set("moon-note", moon.note);
  const icon = $('[data-al="moon-icon"]');
  if (icon) icon.innerHTML = moonSVG(moon.fraction);

  // Piatto del giorno: tra quelli di stagione, a rotazione
  const seasonal = DISHES.filter(([, m]) => m !== "all" && m.includes(month)).map(([n]) => n);
  const pool = seasonal.length ? seasonal : DISHES.map(([n]) => n);
  const doy = Math.floor((now - new Date(y, 0, 0)) / 864e5);
  set("dish", pool[doy % pool.length]);

  // Versione breve per il menu
  const short = $("[data-almanac-short]");
  if (short) short.textContent = `${dateStr}. Alba ${hm(sun.rise)}, tramonto ${hm(sun.set)}. ${moon.name}.`;

  // Meteo (solo dove serve)
  if (!$('[data-al="weather"]')) return;
  const seasonSky = { Primavera: "Aria di primavera", Estate: "Aria d'estate", Autunno: "Aria d'autunno", Inverno: "Aria d'inverno" };
  set("weather", seasonSky[season[0]]);
  if (!CONFIG.liveWeather) return;
  const { lat, lon } = CONFIG.location;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 6000);
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Europe%2FRome`, { signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      set("weather", `${Math.round(d.current.temperature_2m)}° · ${weatherLabel(d.current.weather_code)}`);
      set("weather-note", "In questo momento, in Brianza");
    })
    .catch(() => {});
})();

function weatherLabel(code) {
  if (code === 0) return "sereno";
  if (code <= 2) return "poco nuvoloso";
  if (code === 3) return "coperto";
  if (code === 45 || code === 48) return "nebbia";
  if (code >= 51 && code <= 57) return "pioviggine";
  if (code >= 61 && code <= 67) return "pioggia";
  if (code >= 71 && code <= 77) return "neve";
  if (code >= 80 && code <= 82) return "rovesci";
  if (code >= 85 && code <= 86) return "neve";
  if (code >= 95) return "temporale";
  return "variabile";
}

// Alba e tramonto (algoritmo astronomico semplificato, precisione ±1–2 minuti)
function sunTimes(date, lat, lng) {
  const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
  const toDays = (d) => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
  const e = rad * 23.4397;
  const lw = rad * -lng, phi = rad * lat;
  const n = Math.round(toDays(date) - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const a = J0 + (w + lw) / (2 * Math.PI) + n;
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { rise: fromJulian(Jnoon - (Jset - Jnoon)), set: fromJulian(Jset) };
}

// Fase lunare
function moonPhase(date) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // luna nuova di riferimento
  const age = ((((date - ref) / 864e5) % synodic) + synodic) % synodic;
  const fraction = age / synodic;
  const names = ["Luna nuova", "Luna crescente", "Primo quarto", "Gibbosa crescente", "Luna piena", "Gibbosa calante", "Ultimo quarto", "Luna calante"];
  const name = names[Math.floor(fraction * 8 + 0.5) % 8];
  const toFull = Math.round(((0.5 - fraction + 1) % 1) * synodic);
  const toNew = Math.round(((1 - fraction) % 1) * synodic);
  let note;
  if (toFull === 0 || toNew === 0) note = "Stanotte";
  else if (toFull < toNew) note = toFull === 1 ? "Piena domani" : `Piena tra ${toFull} giorni`;
  else note = toNew === 1 ? "Nuova domani" : `Nuova tra ${toNew} giorni`;
  return { fraction, name, note };
}

function moonSVG(f) {
  const r = 10, rx = (r * Math.abs(Math.cos(2 * Math.PI * f))).toFixed(2);
  const d = f < 0.5
    ? `M12 2 A${r} ${r} 0 0 1 12 22 A${rx} ${r} 0 0 ${f < 0.25 ? 0 : 1} 12 2Z`
    : `M12 2 A${r} ${r} 0 0 0 12 22 A${rx} ${r} 0 0 ${f < 0.75 ? 0 : 1} 12 2Z`;
  return `<circle cx="12" cy="12" r="${r}" fill="#E7DDCA" stroke="rgba(47,34,25,.35)" stroke-width=".8"/><path d="${d}" fill="#D3A24D"/>`;
}

/* =========================================================
   FORM
   ========================================================= */
function setError(form, msg) { form.querySelector(".form-error").textContent = msg || ""; }
function markInvalid(field, bad) {
  const wrap = field.closest(".field, .check");
  if (wrap) wrap.classList.toggle("invalid", bad);
}
function firstInvalid(form) {
  let first = null;
  $$("[required]", form).forEach((f) => {
    const ok = f.type === "checkbox" ? f.checked : f.value.trim() !== "" && f.checkValidity();
    markInvalid(f, !ok);
    if (!ok && !first) first = f;
  });
  return first;
}
$$("form").forEach((form) => {
  ["input", "change"].forEach((ev) => form.addEventListener(ev, (e) => markInvalid(e.target, false)));
});

function openWhatsApp(lines) {
  const text = lines.filter((l) => l != null).join("\n");
  window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

// Imposta il valore di una select solo se l'opzione esiste
function selectIfExists(select, value) {
  if (select && value && [...select.options].some((o) => (o.value || o.text) === value)) select.value = value;
}

// Date minime (oggi / domani) e partenza sempre dopo l'arrivo
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDay = (s) => { const d = new Date(s); d.setDate(d.getDate() + 1); return iso(d); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
function linkDates(inEl, outEl) {
  const today = iso(new Date());
  inEl.min = today;
  outEl.min = addDay(today);
  inEl.addEventListener("change", () => {
    if (!inEl.value) return;
    outEl.min = addDay(inEl.value);
    if (!outEl.value || outEl.value <= inEl.value) outEl.value = addDay(inEl.value);
  });
}

/* ---------- Prenotazione (prenota.html) ---------- */
(function initBooking() {
  const form = $("#booking-form");
  if (!form) return;
  const inEl = $("#b-checkin"), outEl = $("#b-checkout");
  linkDates(inEl, outEl);

  // Valori arrivati dai link del sito (es. prenota.html?residenza=Il%20Fienile&arrivo=…)
  if (isDate(params.get("arrivo")) && params.get("arrivo") >= inEl.min) {
    inEl.value = params.get("arrivo");
    inEl.dispatchEvent(new Event("change"));
  }
  if (isDate(params.get("partenza")) && params.get("partenza") > inEl.value) outEl.value = params.get("partenza");
  selectIfExists($("#b-adults"), params.get("adulti"));
  selectIfExists($("#b-room"), params.get("residenza"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError(form);
    const bad = firstInvalid(form);
    if (bad) { setError(form, "Mancano alcuni dati: li abbiamo evidenziati."); bad.focus(); return; }
    if (outEl.value <= inEl.value) {
      markInvalid(outEl, true);
      setError(form, "La partenza deve essere successiva all'arrivo.");
      outEl.focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      if (CONFIG.bookingEndpoint) {
        const res = await fetch(CONFIG.bookingEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
      } else {
        console.info("[Tenuta Briantea] Richiesta di prenotazione (nessun endpoint configurato):", data);
      }
      form.querySelector(".form-done").hidden = false;
      form.reset();
    } catch {
      setError(form, "Invio non riuscito. Riprovate o scriveteci su WhatsApp.");
    } finally {
      btn.disabled = false;
    }
  });
})();

/* ---------- WhatsApp: informazioni (contatti.html) ---------- */
(function initWhatsApp() {
  const form = $("#whatsapp-form");
  if (!form) return;
  selectIfExists($("#w-topic"), params.get("argomento"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError(form);
    const bad = firstInvalid(form);
    if (bad) { setError(form, "Scriveteci il vostro nome e il messaggio."); bad.focus(); return; }
    const d = Object.fromEntries(new FormData(form));
    openWhatsApp([
      "Buongiorno Tenuta Briantea,",
      `sono ${d.nome.trim()}.`,
      "",
      `*${d.argomento}*`,
      d.messaggio.trim(),
    ]);
  });
})();

/* ---------- WhatsApp: matrimoni e cerimonie (matrimoni.html) ---------- */
(function initEvent() {
  const form = $("#evento-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError(form);
    const bad = firstInvalid(form);
    if (bad) { setError(form, "Indicateci almeno nome e periodo."); bad.focus(); return; }
    const d = Object.fromEntries(new FormData(form));
    openWhatsApp([
      "Buongiorno Tenuta Briantea,",
      `sono ${d.nome.trim()} e vorrei informazioni per un evento.`,
      "",
      `*Occasione:* ${d.occasione}`,
      `*Periodo:* ${d.periodo.trim()}`,
      `*Ospiti:* ${d.ospiti}`,
      d.messaggio.trim() ? `\n${d.messaggio.trim()}` : null,
      "",
      "Vorremmo fissare un sopralluogo e ricevere la brochure.",
    ]);
  });
})();

/* ---------- Barra di prenotazione ---------- */
(function initBar() {
  const bar = $("[data-bar]");
  if (!bar) return;
  linkDates($("[data-bar-in]"), $("[data-bar-out]"));

  let pastHero = false, hidden = 0;
  const update = () => bar.classList.toggle("is-on", pastHero && hidden === 0 && !document.body.classList.contains("menu-open"));

  const onScroll = () => {
    pastHero = window.scrollY > (hero ? hero.offsetHeight - window.innerHeight * 0.3 : 300);
    update();
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("menuchange", update);

  // Si nasconde dove c'è già un invito all'azione
  if ("IntersectionObserver" in window) {
    const zones = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? zones.add(en.target) : zones.delete(en.target)));
      hidden = zones.size;
      update();
    }, { threshold: 0.05 });
    $$(".invite, .evento, .next, .ft").forEach((el) => io.observe(el));
  }
})();

/* ---------- Anno nel footer ---------- */
$$("[data-current-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
