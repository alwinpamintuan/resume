import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';

function run(args: string[], file: string) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit', env: { ...process.env, PORTFOLIO_CONTENT_FILE: resolve(file), ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Fixture command failed (${result.status}): ${args.join(' ')}`);
}

// Build and export real sample inputs in isolation from the deployable artifact.
await mkdir('work/fixtures', { recursive: true });
const visibility = parse(await readFile('tests/fixtures/resume.yml', 'utf8'));
for (const section of visibility.sections) if (['experience', 'selected', 'other', 'certifications', 'education'].includes(section.id)) section.visible = false;
visibility.work[2].visible = false;
await writeFile('work/fixtures/visibility.yml', stringify(visibility));
for (const [file, directory] of [
  ['tests/fixtures/resume.yml', 'work/fixture-site'],
  ['work/fixtures/visibility.yml', 'work/visibility-site'],
]) {
  run(['node_modules/astro/bin/astro.mjs', 'build', '--outDir', directory!], file!);
  run(['--import', 'tsx', 'scripts/export.ts', `--dist-dir=${directory}`], file!);
}
