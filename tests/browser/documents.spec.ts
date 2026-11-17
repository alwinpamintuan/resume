import { test, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import { serveDist } from '../../scripts/server.ts';
import { readContent } from '../support/content.ts';

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

// Prevent recipients downloading incomplete/wrong profiles, stale facts, or hidden content.
for (const scenario of [
  { name: 'published', input: 'src/content/resume.yml', directory: 'dist' },
  { name: 'sample', input: 'tests/fixtures/resume.yml', directory: 'work/fixture-site' },
  { name: 'visibility', input: 'work/fixtures/visibility.yml', directory: 'work/visibility-site' },
]) test(`${scenario.name} pages and downloaded documents contain the intended career content`, async ({ page, request }) => {
  const data = readContent(scenario.input);
  const server = await serveDist(0, scenario.directory);
  const enabled = (id: string) => data.sections.some((section) => section.id === id && section.visible !== false);
  try {
    await page.goto(server.url + '/');
    for (const section of data.sections) if (section.visible === false) await expect(page.locator(`#${section.id}`)).toHaveCount(0);
    for (const work of data.work.filter((work) => work.visible === false)) {
      await expect(page.getByRole('main')).not.toContainText(work.title);
      if (work.slug) expect((await request.get(server.url + '/' + work.slug + '/')).status()).toBe(404);
    }
    if (scenario.name === 'visibility') {
      await expect(page.getByRole('button', { name: 'Airflow', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'TypeScript', exact: true })).toHaveCount(0);
    }
    for (const profile of data.exports.profiles) {
      const filename = data.profile.documentName + (profile.id === data.exports.default ? '' : `-${profile.id}`);
      const headings = [
        enabled('experience') && data.experience.length ? 'Professional Experience' : '',
        enabled('selected') && profile.workIds.length ? 'Selected Work' : '',
        enabled('expertise') && data.expertise.length ? 'Technical Skills' : '',
        enabled('certifications') && data.certifications.length ? 'Certifications' : '',
        enabled('education') && data.education.length ? 'Education' : '',
      ].filter(Boolean);
      for (const extension of ['pdf', 'docx']) {
        // The default profile is downloaded through the actual document-view link.
        await page.goto(server.url + '/resume/');
        const href = profile.id === data.exports.default
          ? await page.getByRole('link', { name: extension === 'pdf' ? 'PDF ↓' : 'Word ↓', exact: true }).getAttribute('href')
          : `/resume/downloads/${filename}.${extension}`;
        expect(href).toBe(`/resume/downloads/${filename}.${extension}`);
        const response = await request.get(new URL(href!, server.url).href);
        expect(response.ok(), href!).toBeTruthy();
        expect(response.headers()['content-type']).toContain(extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        const bytes = await response.body();
        let text: string;
        if (extension === 'pdf') {
          const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
          try {
            const pdf = await task.promise;
            const pages: string[] = [];
            for (let index = 1; index <= pdf.numPages; index++) pages.push((await (await pdf.getPage(index)).getTextContent()).items.map((item) => 'str' in item ? item.str : '').join(' '));
            text = normalize(pages.join(' '));
          } finally { await task.destroy(); }
        } else {
          const zip = await JSZip.loadAsync(bytes);
          const xml = await zip.file('word/document.xml')!.async('text');
          text = normalize(await page.evaluate((xml) => {
            const document = new DOMParser().parseFromString(xml, 'application/xml');
            return [...document.getElementsByTagNameNS('*', 'p')].map((paragraph) => [...paragraph.getElementsByTagNameNS('*', 't')].map((run) => run.textContent).join('')).join(' ');
          }, xml));
          if (enabled('certifications')) {
            const relationships = await zip.file('word/_rels/document.xml.rels')!.async('text');
            for (const credential of data.certifications) if (credential.credentialUrl) expect(relationships).toContain(credential.credentialUrl.replaceAll('&', '&amp;'));
          }
        }
        expect(text).toContain(normalize(data.profile.name));
        expect(text).toContain(normalize(data.profile.summary));
        expect(text.includes('SAMPLE RESUME')).toBe(data.sample);
        for (const heading of headings) expect(text).toContain(heading);
        for (let index = 1; index < headings.length; index++) expect(text.indexOf(headings[index - 1]!)).toBeLessThan(text.indexOf(headings[index]!));
        for (const job of data.experience) {
          if (enabled('experience')) {
            expect(text).toContain(normalize(job.company));
            for (const role of job.roles) expect(text).toContain(normalize(role.title));
          } else expect(text).not.toContain(normalize(job.company));
          for (const role of job.roles) for (const highlight of role.highlights ?? []) {
            const selected = enabled('experience') && profile.highlightIds.includes(highlight.id);
            if (selected) expect(text).toContain(normalize(highlight.text));
            else expect(text).not.toContain(normalize(highlight.text));
          }
        }
        for (const work of data.work) {
          if (enabled('selected') && profile.workIds.includes(work.id)) expect(text).toContain(normalize(work.title));
          else expect(text).not.toContain(normalize(work.title));
        }
        for (const credential of data.certifications) {
          if (enabled('certifications')) {
            expect(text).toContain(normalize(credential.name));
            expect(text).toContain(normalize(credential.issuer));
          } else expect(text).not.toContain(normalize(credential.name));
        }
        for (const education of data.education) {
          if (enabled('education')) {
            expect(text).toContain(normalize(education.institution));
            if (education.honors) expect(text).toContain(normalize(education.honors));
            for (const highlight of education.highlights ?? []) expect(text).toContain(normalize(highlight));
          } else expect(text).not.toContain(normalize(education.institution));
        }
      }
    }
  } finally { await server.close(); }
});
