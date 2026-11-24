import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Tenuta Briantea: le otto pagine si aprono senza errori e il percorso di prenotazione funziona
// (sito dimostrativo: le richieste non partono davvero, ma il visitatore deve vedere la conferma).
const PAGINE = ['index', 'tenuta', 'residenze', 'osteria', 'piscina', 'matrimoni', 'prenota', 'contatti'];

for (const nome of PAGINE) {
  test(`${nome}.html si apre senza errori`, async ({ page }) => {
    const errori: string[] = [];
    const falliti: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));
    page.on('response', (r) => {
      // Solo le risorse del sito: il meteo esterno può rispondere 429 senza colpa nostra
      if (r.url().includes('/tenutabriantea/') && r.status() >= 400) falliti.push(`${r.status()} ${r.url()}`);
    });
    const risposta = await page.goto(`/tenutabriantea/${nome}.html`);
    expect(risposta?.status()).toBe(200);
    await expect(page).toHaveTitle(/Tenuta Briantea/);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(errori, 'errori JavaScript').toEqual([]);
    expect(falliti, 'risorse del sito non trovate').toEqual([]);
  });
}

test('il menu si apre e si chiude con Esc', async ({ page }) => {
  // Il pulsante Menu compare sotto i 1180px: su schermi larghi c'è la navigazione completa
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tenutabriantea/index.html');
  const pulsante = page.locator('[data-menu-toggle]');
  await pulsante.click();
  await expect(page.locator('#indice')).toBeVisible();
  await expect(pulsante).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#indice')).toBeHidden();
});

test('la richiesta di prenotazione mostra la conferma', async ({ page }) => {
  await page.goto('/tenutabriantea/prenota.html?residenza=Il%20Fienile');
  await expect(page.locator('#b-room')).toHaveValue('Il Fienile');
  const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  await page.fill('#b-checkin', domani);
  await page.locator('#b-checkin').dispatchEvent('change');
  await page.fill('#b-name', 'Ospite di prova');
  await page.fill('#b-email', 'ospite@example.com');
  await page.check('input[name="privacy"]');
  await page.click('#booking-form button[type="submit"]');
  await expect(page.locator('.form-done')).toBeVisible();
});

test('la richiesta incompleta segnala i campi mancanti', async ({ page }) => {
  await page.goto('/tenutabriantea/prenota.html');
  await page.click('#booking-form button[type="submit"]');
  await expect(page.locator('#booking-form .form-error')).not.toBeEmpty();
  await expect(page.locator('.form-done')).toBeHidden();
});

test('le versioni di CSS e JS corrispondono ai file (cache di un anno)', async () => {
  const sito = join(__dirname, '..', 'tenutabriantea');
  const file = ['css/style.css', 'js/main.js', 'js/video-worker.js', 'js/cover-worker.js'];
  const attese = Object.fromEntries(file.map((f) => [f, createHash('md5').update(readFileSync(join(sito, f))).digest('hex').slice(0, 8)]));
  for (const pagina of readdirSync(sito).filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(join(sito, pagina), 'utf8');
    for (const f of file) {
      const trovata = html.match(new RegExp(`${f.replace('.', '\\.')}\\?v=([0-9a-f]{8})`))?.[1];
      if (trovata) expect(trovata, `${pagina}: ${f} (lanciate npm run versioni)`).toBe(attese[f]);
    }
  }
});
