import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibilità WCAG 2.2 AA (axe-core) sulle pagine principali.
const pagine = [
  '/',
  // il portfolio mostra una tavola per volta: si controllano tutte
  '/#cosa-faccio',
  '/#metodo',
  '/#progetti',
  '/#chi-sono',
  '/#contatti',
  '/tenutabriantea/index.html',
  '/tenutabriantea/tenuta.html',
  '/tenutabriantea/residenze.html',
  '/tenutabriantea/osteria.html',
  '/tenutabriantea/piscina.html',
  '/tenutabriantea/matrimoni.html',
  '/tenutabriantea/prenota.html',
  '/tenutabriantea/contatti.html',
];

for (const pagina of ['/#progetti', '/#chi-sono']) {
  test(`accessibilità WCAG 2.2 AA con il tema chiaro: ${pagina}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('gc-theme', 'light'));
    await page.goto(pagina);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const risultati = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(risultati.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

for (const pagina of pagine) {
  test(`accessibilità WCAG 2.2 AA: ${pagina}`, async ({ page }) => {
    // Con "riduci movimento" le comparse allo scorrimento sono già visibili: axe legge i colori finali
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pagina);
    const risultati = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const riepilogo = risultati.violations.map((v) => ({
      regola: v.id,
      impatto: v.impact,
      elementi: v.nodes.length,
      aiuto: v.helpUrl,
    }));
    expect(riepilogo, 'Violazioni di accessibilità trovate da axe-core').toEqual([]);
  });
}
