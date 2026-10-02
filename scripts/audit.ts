import { mkdir, mkdtemp, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { serveDist } from './server.ts';
import { loadContent } from '../src/lib/content.ts';

await mkdir('work/audits', { recursive: true });
const auditRoot = resolve('work/audits');
const browserProfile = await mkdtemp(`${auditRoot}${sep}chrome-`);
const server = await serveDist();
let chrome: Awaited<ReturnType<typeof launch>> | undefined;
try {
  chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless', '--no-sandbox'], userDataDir: browserProfile });
  const data = loadContent();
  for (const route of ['/', ...data.work.filter((w) => w.visible && w.slug).map((w) => `/${w.slug}/`)]) {
    const result = await lighthouse(`${server.url}${route}`, { port: chrome.port, output: 'html', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    if (!result) throw new Error('Lighthouse returned no result');
    const name = route === '/' ? 'home' : route.replaceAll('/', '');
    await writeFile(`work/audits/${name}.html`, result.report as string);
    await writeFile(`work/audits/${name}.json`, JSON.stringify(result.lhr, null, 2));
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round((value.score ?? 0) * 100)]));
    console.log(`${route}: ${JSON.stringify(scores)}${data.sample ? ' (sample noindex affects SEO)' : ''}`);
    const seoFailures = result.lhr.categories.seo?.auditRefs.filter((ref) => ref.weight > 0 && result.lhr.audits[ref.id]?.score === 0).map((ref) => ref.id) ?? [];
    if (data.sample && seoFailures.some((id) => id !== 'is-crawlable')) throw new Error(`Unexpected sample SEO failure: ${seoFailures.join(', ')}`);
    for (const [key, score] of Object.entries(scores)) if (score < 95 && !(data.sample && key === 'seo')) throw new Error(`${route} ${key} is below 95: ${score}`);
  }
  const files = await readdir('dist/_astro');
  const js = files.filter((file) => file.endsWith('.js'));
  let compressed = 0;
  for (const file of js) compressed += gzipSync(await readFile(`dist/_astro/${file}`)).byteLength;
  const inlineScripts = new Set<string>();
  for (const file of await readdir('dist', { recursive: true })) {
    if (!file.endsWith('.html')) continue;
    const html = await readFile(`dist/${file}`, 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if (match[1]?.trim()) inlineScripts.add(match[1]);
  }
  for (const script of inlineScripts) compressed += gzipSync(script).byteLength;
  console.log(`Client JavaScript: ${compressed} bytes gzip`);
  if (compressed > 30 * 1024) throw new Error('Client JavaScript exceeds 30 KB gzip');
} finally {
  if (chrome) {
    const exited = new Promise<void>((done) => {
      if (!chrome?.process || chrome.process.exitCode !== null) done();
      else chrome.process.once('close', () => done());
    });
    chrome.kill();
    await exited;
  }
  await server.close();
  if (browserProfile.startsWith(`${auditRoot}${sep}`)) await rm(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
