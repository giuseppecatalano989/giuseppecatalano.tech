// Ripresa di un agente in modalità demo: avvia il server locale, apre l'interfaccia, preme il pulsante,
// approva le azioni proposte con un cursore visibile, scorre il report e salva il video
// (ripresa.mp4, 30 fps a tempi reali)
// più i "segni" (marks.json): il momento di ogni evento dell'agente, usato da scenes.json.
//
// Uso: node agenti/registra.js <agente>        es. node agenti/registra.js metis
// Variabili facoltative: BROWSER (percorso di Edge o Chrome), FFMPEG (percorso di ffmpeg)
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const agente = process.argv[2] || 'metis';
const PORTA = 4310;
const W = 1440, H = 900;
const OUT = path.join(__dirname, '..', 'captures', agente);
const BROWSER = process.env.BROWSER || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  server = spawn(process.execPath, [path.join(__dirname, '..', '..', 'agenti', 'core', 'server.js'), agente, '--porta', String(PORTA)], { stdio: 'inherit' });
  await pausa(1200);

  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('ERRORE PAGINA:', e.message));
  await page.goto(`http://localhost:${PORTA}/`, { waitUntil: 'load' });
  await page.waitForSelector('#run');
  await pausa(800);
  await page.evaluate(() => document.fonts.ready);

  // Cursore visibile (le riprese headless non hanno il puntatore)
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = 'cursore-ripresa';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2 L4 22 L9.5 17 L13 25.5 L16.5 24 L13 15.8 L20.5 15.8 Z" fill="#fff" stroke="#0f2e33" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(1100px, 520px)', transition: 'transform .06s linear', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' });
    document.body.append(c);
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 2}px)`; }, true);
    addEventListener('mousedown', () => { c.firstChild.style.transform = 'scale(.85)'; }, true);
    addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
  });
  let mouse = { x: 1100, y: 520 };
  await page.mouse.move(mouse.x, mouse.y);
  const vai = async (sel) => {
    const b = await (await page.$(sel)).boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 28 }); mouse = { x, y };
    await pausa(350);
  };

  // Segni: il tempo di ogni evento dell'agente, dall'inizio della ripresa
  const marks = [];
  let t0;
  await page.exposeFunction('segna', (ev) => marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), ...ev }));
  await page.evaluate(() => {
    const es = new EventSource('/api/eventi');
    es.onmessage = (m) => { const e = JSON.parse(m.data); if (e.type !== 'testo') window.segna({ type: e.type, nome: e.nome, tipo: e.tipo || e.vista?.tipo }); };
  });

  // Fotogrammi direttamente da Chrome, ciascuno con il suo istante: il montaggio rispetta i tempi reali
  const RAW = path.join(OUT, 'raw');
  fs.rmSync(RAW, { recursive: true, force: true }); fs.mkdirSync(RAW, { recursive: true });
  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const f = `${String(frames.length + 1).padStart(5, '0')}.jpg`;
    frames.push({ f, ts: metadata.timestamp });
    fs.writeFileSync(path.join(RAW, f), Buffer.from(data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await pausa(300);
  t0 = Date.now();
  const tsInizio = Date.now() / 1000;
  await pausa(1800);
  await vai('#run');
  await page.click('#run');
  marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), type: 'click' });

  // Approva ogni azione proposta, dopo il tempo di leggerla
  const fatte = new Set();
  while (!marks.some((m) => m.type === 'fine')) {
    const ids = await page.$$eval('.approve:not(.fatto):not(.no)', (els) => els.map((e) => e.id));
    for (const id of ids) {
      if (fatte.has(id)) continue;
      fatte.add(id);
      await pausa(1700);
      await vai(`#${id} [data-ok]`);
      await page.click(`#${id} [data-ok]`);
      marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), type: 'click_approva' });
    }
    await pausa(150);
  }
  await pausa(1500);

  // Se l'app ha la scheda del piano (Metis), si chiude tornando sul piano definitivo
  if (await page.$('.tabs button[data-tab="piano"]')) {
    await vai('.tabs button[data-tab="piano"]');
    await page.click('.tabs button[data-tab="piano"]');
    marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), type: 'piano_finale' });
    await pausa(3200);
  }

  // Scorre il report con calma
  const rep = await page.$('#rep');
  if (rep) {
    const b = await rep.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 260, { steps: 30 });
    marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), type: 'scorri_report' });
    for (let i = 0; i < 26; i++) { await page.mouse.wheel({ deltaY: 28 }); await pausa(60); }
    await pausa(2200);
  }
  marks.push({ t: +((Date.now() - t0) / 1000).toFixed(2), type: 'stop' });
  await cdp.send('Page.stopScreencast');
  await pausa(300);
  // Montaggio: ogni fotogramma resta a schermo fino al successivo (Chrome invia solo i cambiamenti)
  const lista = frames.filter((x) => x.ts >= tsInizio - 0.05);
  const fine = tsInizio + marks.at(-1).t;
  let concat = '';
  lista.forEach((x, i) => {
    const da = Math.max(x.ts, tsInizio), a = i + 1 < lista.length ? lista[i + 1].ts : fine;
    if (a > da) concat += `file 'raw/${x.f}'\nduration ${(a - da).toFixed(4)}\n`;
  });
  concat += `file 'raw/${lista.at(-1).f}'\n`;
  fs.writeFileSync(path.join(OUT, 'concat.txt'), concat);
  require('child_process').execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', 'ripresa.mp4'], { cwd: OUT, stdio: 'inherit' });
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 1));
  console.log(`Ripresa salvata in ${OUT} (${marks.at(-1).t} s, ${marks.length} segni)`);
  await browser.close();
  server.kill();
})().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
