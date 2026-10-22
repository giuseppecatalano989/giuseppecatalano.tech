// Rende la composizione di un agente (<agente>/comp.html) fotogramma per fotogramma.
// Uso: node agenti/render.js <agente> <16|45> <cartella-uscita> [secondi-di-anteprima...]
// Variabile facoltativa: BROWSER (percorso di Edge o Chrome)
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const [agente, f, outRel, ...anteprime] = process.argv.slice(2);
const fmt = f === '45' ? '45' : '16';
const DIR = path.join(__dirname, '..', agente);
const outDir = path.resolve(DIR, outRel || `out${fmt}`);
const previewTimes = anteprime.map(Number);
const FPS = 30;
const [W, H] = fmt === '16' ? [1920, 1080] : [1080, 1350];
const BROWSER = process.env.BROWSER || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: BROWSER, headless: true,
    args: ['--allow-file-access-from-files', '--disable-web-security', '--force-device-scale-factor=1', '--hide-scrollbars',
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('ERRORE PAGINA:', e.message));
  await page.goto('file://' + (process.platform === 'win32' ? '/' : '') + path.join(DIR, 'comp.html').replace(/\\/g, '/') + '?fmt=' + fmt);
  await page.evaluate(() => window.ready);
  const duration = await page.evaluate(() => window.DURATION);

  const from = Number(process.env.FROM || 0);
  const times = previewTimes.length ? previewTimes : Array.from({ length: Math.round(duration * FPS) }, (_, i) => i / FPS);
  const t0 = Date.now();
  for (let i = previewTimes.length ? 0 : from; i < times.length; i++) {
    await page.evaluate((t) => window.renderAt(t), times[i]);
    const name = previewTimes.length ? `prova_${times[i]}.jpg` : `f${String(i + 1).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(outDir, name), type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: W, height: H } });
    if (!previewTimes.length && i % 300 === 0) console.log(`${i}/${times.length} fotogrammi (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  console.log(`FATTO: ${times.length} fotogrammi in ${Math.round((Date.now() - t0) / 1000)} s · durata ${duration.toFixed(2)} s`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
