import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { readContent } from '../support/content.ts';
import type { Resume } from '../../src/lib/content.ts';

// Prevent publishing dangerous destinations, ambiguous navigation, or incomplete exports.
const cases: { name: string; field: string; edit: (data: Resume) => void }[] = [
  { name: 'unsafe profile link', field: 'profile.links.0.url', edit: (d) => { d.profile.links[0]!.url = 'javascript:alert(1)'; } },
  { name: 'unsafe credential link', field: 'certifications.0.credentialUrl', edit: (d) => { d.certifications[0]!.credentialUrl = 'javascript:alert(1)'; } },
  { name: 'export path traversal', field: 'profile.documentName', edit: (d) => { d.profile.documentName = '../resume'; } },
  { name: 'asset path traversal', field: 'work.2.details.screenshot.src', edit: (d) => { d.work[2]!.details!.screenshot!.src = '/../secret.svg'; } },
  { name: 'duplicate content anchor', field: 'work.1.id', edit: (d) => { d.work[1]!.id = d.work[0]!.id; } },
  { name: 'reserved page anchor', field: 'work.2.id', edit: (d) => { d.work[2]!.id = 'experience'; } },
  { name: 'duplicate showcase route', field: 'work.2.slug', edit: (d) => { d.work[2]!.slug = d.work[0]!.slug; } },
  { name: 'reserved showcase route', field: 'work.0.slug', edit: (d) => { d.work[0]!.slug = 'resume'; } },
  { name: 'competing destinations', field: 'work.0', edit: (d) => { d.work[0]!.destination = 'https://example.com/tool/'; } },
  { name: 'unknown export highlight', field: 'exports.profiles.0.highlightIds', edit: (d) => { d.exports.profiles[0]!.highlightIds.push('missing'); } },
  { name: 'hidden export work', field: 'exports.profiles.0.workIds', edit: (d) => { d.work[0]!.visible = false; } },
];

for (const scenario of cases) test(`publisher validation rejects ${scenario.name}`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'resume-validation-'));
  try {
    const data = readContent('tests/fixtures/resume.yml');
    scenario.edit(data);
    const file = join(directory, 'resume.yml');
    await writeFile(file, stringify(data));
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/validate.ts'], {
      env: { ...process.env, PORTFOLIO_CONTENT_FILE: file }, encoding: 'utf8', timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(scenario.field);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
