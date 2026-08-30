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

const backendBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const backendPort = (() => {
  try {
    return Number(new URL(backendBaseURL).port || 80);
  } catch {
    return 8080;
  }
})();
const backendCommand = process.platform === 'win32'
  ? `powershell -NoProfile -Command "$env:PORT='${backendPort}'; npm run dev"`
  : `PORT=${backendPort} npm run dev`;
const isFakeSmokeRun = process.argv.some((arg) => arg.includes('zapo-smoke-fake.spec'));

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: require.resolve('./tests/global-setup'),
  use: {
    baseURL: backendBaseURL,
    trace: 'on-first-retry',
  },
  webServer: isFakeSmokeRun ? undefined : {
    command: backendCommand,
    cwd: './backend',
    port: backendPort,
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
