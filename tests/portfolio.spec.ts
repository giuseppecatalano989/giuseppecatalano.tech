import { test, expect } from '@playwright/test';

// Portfolio (pagina iniziale): tema, menu, filtri dei progetti, collegamenti e impaginazione.

test('si apre senza errori e tutte le risorse rispondono', async ({ page }) => {
  const errori: string[] = [];
  const falliti: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) falliti.push(`${r.status()} ${r.url()}`); });
  const risposta = await page.goto('/');
  expect(risposta?.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  expect(errori).toEqual([]);
  expect(falliti).toEqual([]);
});

test('il tema scuro è quello di partenza, anche se il sistema chiede il chiaro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Scuro' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0e2649');
});

test('il tema chiaro si sceglie e resta dopo il ricaricamento', async ({ page }) => {
  await page.goto('/');
  const sfondoScuro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: 'Chiaro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Chiaro' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Scuro' })).toHaveAttribute('aria-pressed', 'false');
  // lo sfondo cambia con una transizione: si aspetta il colore finale
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(242, 239, 231)');
  expect(sfondoScuro).toBe('rgb(14, 38, 73)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f2efe7');

  await page.getByRole('button', { name: 'Scuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('le voci del menu aprono una tavola per volta e segnano quella aperta', async ({ page }) => {
  await page.goto('/');
  const voci = page.locator('.topbar nav a');
  await expect(voci).toHaveCount(6);
  await expect(page.locator('#inizio')).toBeVisible();
  await expect(page.locator('#progetti')).toHaveAttribute('hidden', 'until-found');

  await page.locator('.topbar nav a[href="#progetti"]').click();
  await expect(page).toHaveURL(/#progetti$/);
  await expect(page.locator('#progetti')).toBeVisible();
  await expect(page.locator('#progetti')).not.toHaveAttribute('hidden');
  await expect(page.locator('#inizio')).toHaveAttribute('hidden', 'until-found');
  await expect(page.locator('.topbar nav a[href="#progetti"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.topbar nav a[aria-current]')).toHaveCount(1);
  await expect(page).toHaveTitle(/^Progetti · /);
  await expect(page.locator('#c-tav')).toHaveText('04');

  // indietro nel browser riporta alla tavola di prima
  await page.goBack();
  await expect(page.locator('#inizio')).toBeVisible();
  await expect(page.locator('#progetti')).toHaveAttribute('hidden', 'until-found');
  await expect(page.locator('.topbar nav a[href="#inizio"]')).toHaveAttribute('aria-current', 'page');
});

test('i pulsanti in fondo portano alla tavola successiva e alla precedente', async ({ page }) => {
  await page.goto('/#metodo');
  const pager = page.getByRole('navigation', { name: 'Tavola precedente e successiva' });
  await expect(pager.getByRole('link')).toHaveCount(2);
  await pager.getByRole('link', { name: /Successiva/ }).click();
  await expect(page.locator('#progetti')).toBeVisible();
  await expect(page).toHaveURL(/#progetti$/);
  await pager.getByRole('link', { name: /Precedente/ }).click();
  await expect(page.locator('#metodo')).toBeVisible();
  // prima e ultima tavola hanno un solo pulsante
  await page.goto('/#contatti');
  await expect(pager.getByRole('link')).toHaveCount(1);
  await expect(pager.getByRole('link', { name: /Precedente/ })).toBeVisible();
});

test('le tavole chiuse restano trovabili con Ctrl+F e si aprono da sole', async ({ page }) => {
  await page.goto('/');
  const chiuse = await page.locator('main .tav[hidden="until-found"]').count();
  expect(chiuse).toBe(5);
  // il testo delle tavole chiuse è nel documento
  await expect(page.locator('#chi-sono')).toContainText('Scheda tecnica');
  // il browser, trovando il testo, manda beforematch alla tavola
  await page.locator('#chi-sono').evaluate((t) => t.dispatchEvent(new Event('beforematch')));
  await expect(page.locator('#chi-sono')).toBeVisible();
  await expect(page.locator('#inizio')).toHaveAttribute('hidden', 'until-found');
  await expect(page).toHaveURL(/#chi-sono$/);
});

test('in stampa escono tutte le tavole', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ media: 'print' });
  for (const id of ['inizio', 'cosa-faccio', 'metodo', 'progetti', 'chi-sono', 'contatti']) {
    await expect(page.locator(`#${id}`), id).toBeVisible();
  }
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.cartiglio')).toBeHidden();
});

test('gli indirizzi vecchi #tav-NN aprono la tavola giusta', async ({ page }) => {
  await page.goto('/#tav-04');
  await expect(page.locator('#progetti')).toBeVisible();
  await expect(page).toHaveURL(/#progetti$/);
});

test('senza JavaScript tutte le tavole sono una sotto l\'altra', async ({ browser }) => {
  const contesto = await browser.newContext({ javaScriptEnabled: false });
  const page = await contesto.newPage();
  await page.goto('/');
  await expect(page.locator('main .tav:visible')).toHaveCount(6);
  await contesto.close();
});

test('il collegamento "Salta al contenuto" è il primo elemento raggiungibile con Tab', async ({ page, isMobile }) => {
  test.skip(isMobile, 'su telefono non si naviga con la tastiera');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const salta = page.getByRole('link', { name: 'Salta al contenuto' });
  await expect(salta).toBeFocused();
  await expect(salta).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test.describe('filtri dei progetti', () => {
  const casi: [string, string, number][] = [
    ['Software', 'software', 3],
    ['Siti web', 'sito', 1],
    ['Agenti AI', 'agente', 4],
  ];

  for (const [etichetta, valore, attesi] of casi) {
    test(`"${etichetta}" mostra ${attesi} progetti e lo ricorda nell'indirizzo`, async ({ page }) => {
      await page.goto('/#progetti');
      await page.getByRole('button', { name: etichetta, exact: true }).click();
      await expect(page.getByRole('button', { name: etichetta, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.register li[data-cat]:visible')).toHaveCount(attesi);
      await expect(page.locator(`.register li[data-cat="${valore}"]:visible`)).toHaveCount(attesi);
      await expect(page.locator('#reg-count')).toHaveText(attesi === 1 ? '1 progetto' : `${attesi} progetti`);
      expect(new URL(page.url()).searchParams.get('f')).toBe(valore);
      expect(new URL(page.url()).hash).toBe('#progetti');

      await page.getByRole('button', { name: 'Tutti', exact: true }).click();
      await expect(page.locator('.register li[data-cat]:visible')).toHaveCount(8);
      await expect(page.locator('#reg-count')).toHaveText('8 progetti');
      expect(new URL(page.url()).searchParams.has('f')).toBe(false);
    });
  }

  test('un indirizzo con ?f= apre la lista già filtrata', async ({ page }) => {
    await page.goto('/?f=agente');
    await expect(page.locator('#progetti')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agenti AI', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.register li[data-cat]:visible')).toHaveCount(4);
  });

  test('un valore di ?f= sconosciuto mostra tutti i progetti', async ({ page }) => {
    await page.goto('/?f=inesistente');
    await expect(page.getByRole('button', { name: 'Tutti', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.register li[data-cat]:visible')).toHaveCount(8);
  });
});

test('tutti i collegamenti interni della pagina rispondono 200', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'basta controllarli una volta');
  await page.goto('/');
  const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as
    .map((a) => (a as HTMLAnchorElement).href)
    .filter((h) => h.startsWith(location.origin) && !h.includes('#')))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(8);
  for (const h of hrefs) {
    const r = await request.get(h);
    expect(r.status(), h).toBe(200);
  }
});

test('il pulsante ferma e riprende l\'animazione dello schema', async ({ page, isMobile }) => {
  test.skip(isMobile, 'stesso comportamento su desktop e telefono');
  await page.goto('/#cosa-faccio');
  const pulsante = page.locator('.anim-toggle:visible').first();
  await pulsante.scrollIntoViewIfNeeded();
  await expect(pulsante).toHaveText("Ferma l'animazione");
  await pulsante.click();
  await expect(pulsante).toHaveAttribute('aria-pressed', 'true');
  await expect(pulsante).toHaveText("Riprendi l'animazione");
  const svg = pulsante.locator('xpath=..').locator('svg.schema');
  expect(await svg.evaluate((s) => (s as SVGSVGElement).animationsPaused())).toBe(true);
  await pulsante.click();
  await expect(pulsante).toHaveAttribute('aria-pressed', 'false');
  expect(await svg.evaluate((s) => (s as SVGSVGElement).animationsPaused())).toBe(false);
});

test('con "riduci movimento" i contenuti sono subito visibili e i pulsanti di animazione spariscono', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/anima/);
  await expect(page.locator('.anim-toggle:visible')).toHaveCount(0);
  await page.goto('/#metodo');
  const nascosti = await page.locator('.tav.attiva .reveal').evaluateAll((els) =>
    els.filter((e) => Number(getComputedStyle(e).opacity) < 1).length);
  expect(nascosti).toBe(0);
});

test('nessuno scorrimento orizzontale, in ogni tavola e in entrambi i temi', async ({ page }) => {
  await page.goto('/');
  for (const tema of ['Scuro', 'Chiaro']) {
    await page.getByRole('button', { name: tema }).click();
    for (const id of ['inizio', 'cosa-faccio', 'metodo', 'progetti', 'chi-sono', 'contatti']) {
      await page.locator(`.topbar nav a[href="#${id}"]`).click();
      await expect(page.locator(`#${id}`)).toBeVisible();
      const largo = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(largo, `${tema} #${id}`).toBeLessThanOrEqual(0);
    }
  }
});
