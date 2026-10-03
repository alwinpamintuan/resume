import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  webServer: { command: 'npx tsx scripts/serve.ts', url: 'http://127.0.0.1:4322/resume/', reuseExistingServer: false },
});
