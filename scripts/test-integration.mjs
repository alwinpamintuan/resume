import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const hub = resolve(process.env.HUB_DIR || '../alwinpamintuan.github.io');
const manifest = join(hub, 'package.json');
if (!existsSync(manifest) || !JSON.parse(readFileSync(manifest, 'utf8')).scripts?.['test:integration']) {
  throw new Error('Build the updated Projects hub and set HUB_DIR to its checkout before running test:integration.');
}
const result = spawnSync(process.execPath, [join(hub, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.integration.config.ts', ...process.argv.slice(2)], {
  cwd: hub, stdio: 'inherit', env: { ...process.env, COMPANION_DIST: resolve(process.env.COMPANION_DIST || 'dist') },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
