import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Resume } from '../../src/lib/content.ts';

// Read test inputs, never the production parser/model that the tests must verify.
export const readContent = (file = 'src/content/resume.yml'): Resume => parse(readFileSync(file, 'utf8')) as Resume;
export const content = readContent();
export const routes = ['/resume/', '/resume/resume/', ...content.work.filter((work) => work.visible !== false && work.slug).map((work) => `/resume/${work.slug}/`), '/resume/404.html'];
