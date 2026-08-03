import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../',
  testMatch: /zapo-manager-ui\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm --prefix frontend run dev -- --host localhost',
    cwd: '../..',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
