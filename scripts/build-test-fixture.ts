import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Build a separate sample site to verify interactions without changing personal YAML.
const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', 'work/fixture-site'], {
  stdio: 'inherit', env: { ...process.env, PORTFOLIO_CONTENT_FILE: resolve('tests/fixtures/resume.yml'), ASTRO_TELEMETRY_DISABLED: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
