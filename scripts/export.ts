import { mkdir, writeFile, rm, rename } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } from 'docx';
import { loadContent, resumeBlocks, type Resume, type ExportProfile } from '../src/lib/content.ts';
import { serveDist } from './server.ts';

const data = loadContent();
const requested = process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1];
if (requested && !data.exports.profiles.some((profile) => profile.id === requested)) throw new Error(`Unknown profile: ${requested}`);
const profiles = requested ? data.exports.profiles.filter((profile) => profile.id === requested) : data.exports.profiles;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function profileHtml(data: Resume, profile: ExportProfile): string {
  return `${data.sample ? '<p class="document-sample">SAMPLE RESUME - Fictional career details and results. Not for job applications.</p>' : ''}<h1>${escape(data.profile.name)}</h1><p class="document-title">${escape(data.profile.title)}</p><p class="document-contact">${escape(data.profile.email)}${data.profile.location ? ` | ${escape(data.profile.location)}` : ''}</p><p class="document-contact">${data.profile.links.map((link) => `<a href="${escape(link.url)}">${escape(link.url)}</a>`).join(' | ')}</p><p class="document-summary">${escape(data.profile.summary)}</p>${resumeBlocks(data, profile).map((block) => `<section class="document-section"><h2>${escape(block.heading)}</h2>${block.paragraphs.map((p) => `<p class="${p.bullet ? 'document-bullet' : p.strong ? 'document-strong' : ''}">${p.bullet ? '• ' : ''}${p.href ? `<a href="${escape(p.href)}">${escape(p.text)}</a>` : escape(p.text)}</p>`).join('')}</section>`).join('')}`;
}

const staging = 'dist/.exports-temp';
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
// A full export replaces downloads atomically; targeted exports update only their files.
if (!requested) await rm('dist/downloads', { recursive: true, force: true });
const server = await serveDist();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const response = await page.goto(`${server.url}/resume/`);
  if (!response?.ok()) throw new Error('Build the site before exporting: /resume/ was not found.');
  await page.evaluate(() => document.fonts.ready);
  for (const profile of profiles) {
    await page.locator('.resume-document').evaluate((element, html) => { element.innerHTML = html; }, profileHtml(data, profile));
    const filename = `${data.profile.documentName}${profile.id === data.exports.default ? '' : `-${profile.id}`}`;
    await page.pdf({ path: `${staging}/${filename}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: false, tagged: true });
    const paragraphs: Paragraph[] = [];
    if (data.sample) paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'SAMPLE RESUME - Fictional career details and results. Not for job applications.', bold: true, size: 16 })], spacing: { after: 160 } }));
    paragraphs.push(new Paragraph({ heading: HeadingLevel.TITLE, text: data.profile.name }), new Paragraph({ text: data.profile.title }));
    paragraphs.push(new Paragraph({ text: `${data.profile.email}${data.profile.location ? ` | ${data.profile.location}` : ''}`, spacing: { after: 40 } }));
    for (const link of data.profile.links) paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${link.label}: ${link.url}`, size: 18 })], spacing: { after: 30 } }));
    paragraphs.push(new Paragraph({ text: data.profile.summary, spacing: { before: 140, after: 120 } }));
    for (const block of resumeBlocks(data, profile)) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: block.heading }));
      for (const item of block.paragraphs) paragraphs.push(new Paragraph({
        children: [item.href
          ? new ExternalHyperlink({ link: item.href, children: [new TextRun({ text: item.text, bold: item.strong ?? false, color: '111111' })] })
          : new TextRun({ text: item.text, bold: item.strong ?? false })],
        ...(item.bullet ? { bullet: { level: 0 } } : {}),
        keepNext: item.strong ?? false, spacing: { before: item.strong ? 110 : 0, after: 70 }
      }));
    }
    const doc = new Document({ creator: data.profile.name, title: `${data.profile.name} Resume`,
      styles: { default: {
        document: { run: { font: 'Arial', size: 21, color: '111111' }, paragraph: { spacing: { line: 270 } } },
        title: { run: { font: 'Arial', size: 44, bold: true, color: '111111' }, paragraph: { spacing: { after: 100 } } },
        heading1: { run: { font: 'Arial', size: 24, bold: true, color: '111111' }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } }
      } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 907, right: 907, bottom: 907, left: 907 } } }, children: paragraphs }]
    });
    await writeFile(`${staging}/${filename}.docx`, await Packer.toBuffer(doc));
    console.log(`Exported ${filename}.pdf and .docx`);
  }
  if (!requested) await rename(staging, 'dist/downloads');
  else {
    await mkdir('dist/downloads', { recursive: true });
    const profile = profiles[0]!;
    const filename = `${data.profile.documentName}${profile.id === data.exports.default ? '' : `-${profile.id}`}`;
    for (const ext of ['pdf', 'docx']) await rename(`${staging}/${filename}.${ext}`, `dist/downloads/${filename}.${ext}`);
  }
} finally {
  await browser?.close();
  await server.close();
  await rm(staging, { recursive: true, force: true });
}
