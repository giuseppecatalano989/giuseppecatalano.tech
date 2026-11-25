import { defineConfig, devices } from '@playwright/test';

// Sito statico: lo serve python3 sulla porta 4173. Con BASE_URL si testa un'anteprima online.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: `${baseURL}/tenutabriantea/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
