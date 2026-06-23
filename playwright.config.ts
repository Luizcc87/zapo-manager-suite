import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Carrega as variáveis de ambiente do .env da raiz usando o dotenv do backend
try {
  const dotenvPath = path.resolve(__dirname, 'backend/node_modules/dotenv');
  const dotenv = require(dotenvPath);
  dotenv.config({ path: path.resolve(__dirname, '.env') });
} catch (e) {
  console.warn('[Playwright Config] Não foi possível carregar o .env da raiz:', e);
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: require.resolve('./tests/global-setup'),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    cwd: './backend',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

