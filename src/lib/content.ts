import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { sitePath } from './urls.ts';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens');
const webUrl = z.url().refine((value) => /^https?:\/\//.test(value), 'Use an http or https URL');
const date = text.regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const sections = ['experience', 'selected', 'other', 'expertise', 'certifications', 'principles', 'education'] as const;
const asset = text.refine((value) => /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..'), 'Use a local /images/file path');

export const contentSchema = z.object({
  sample: z.boolean(),
  profile: z.object({ name: text, title: text, summary: text, location: text.optional(), email: z.email(),
    links: z.array(z.object({ label: text, url: webUrl })).default([]),
    documentName: text.regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, underscores, and hyphens without an extension') }),
  sections: z.array(z.object({ id: z.enum(sections), label: text, visible: z.boolean().default(true) })),
  impact: z.array(z.object({ id, value: text, label: text, context: text })).default([]),
  experience: z.array(z.object({ id, company: text, location: text.optional(),
    roles: z.array(z.object({ title: text, start: date, end: z.union([date, z.literal('Present')]),
      scope: text.optional(), highlights: z.array(z.object({ id, text, skills: z.array(text).default([]) })).default([]) })).min(1)
  })).default([]),
  work: z.array(z.object({ id, title: text, summary: text, placement: z.enum(['selected', 'other']),
    visible: z.boolean().default(true), type: text, year: text, technologies: z.array(text).default([]),
    slug: id.optional(), destination: webUrl.optional(), source: webUrl.optional(), demo: webUrl.optional(),
    details: z.object({ problem: text, contribution: text, tradeoff: text, outcome: text,
      screenshot: z.object({ src: asset, alt: text }).optional(),
      pipeline: z.object({ label: text, nodes: z.array(text).length(3), caption: text }).optional()
    }).optional()
  })).default([]),
  expertise: z.array(z.object({ area: text, tools: z.array(text).min(1) })).default([]),
  certifications: z.array(z.object({ name: text, issuer: text, issued: date.optional(),
    expires: date.optional(), credentialUrl: webUrl.optional() })).default([]),
  principles: z.array(z.object({ title: text, description: text })).default([]),
  education: z.array(z.object({ institution: text, qualification: text, year: text, honors: text.optional(), highlights: z.array(text).default([]) })).default([]),
  exports: z.object({ default: id, profiles: z.array(z.object({ id, label: text,
    highlightIds: z.array(id), workIds: z.array(id) })).min(1) })
}).superRefine((data, ctx) => {
  const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const reservedIds = new Set<string>(['main', 'top', 'intro-title', ...sections, ...sections.map((section) => `${section}-title`)]);
  const seen = new Set<string>();
  const unique = (value: string, path: (string | number)[]) => {
    if (reservedIds.has(value) || value.startsWith('skill-proof-')) add(path, `Reserved ID: ${value}`);
    if (seen.has(value)) add(path, `Duplicate ID: ${value}`);
    seen.add(value);
  };
  const sectionIds = new Set<string>();
  data.sections.forEach((section, i) => {
    if (sectionIds.has(section.id)) add(['sections', i, 'id'], 'Duplicate section');
    sectionIds.add(section.id);
  });
  data.impact.forEach((item, i) => unique(item.id, ['impact', i, 'id']));
  data.certifications.forEach((item, i) => {
    if (item.issued && item.expires && item.expires < item.issued)
      add(['certifications', i, 'expires'], 'Expiry must follow issue date');
  });
  const highlights = new Set<string>();
  data.experience.forEach((job, i) => {
    unique(job.id, ['experience', i, 'id']);
    job.roles.forEach((role, j) => {
      if (role.end !== 'Present' && role.end < role.start) add(['experience', i, 'roles', j, 'end'], 'End must follow start');
      role.highlights.forEach((item, k) => {
        unique(item.id, ['experience', i, 'roles', j, 'highlights', k, 'id']); highlights.add(item.id);
      });
    });
  });
  const reserved = new Set(['resume', 'downloads', '404', 'images', 'fonts', 'assets', 'sitemap', 'robots', '_astro']);
  const slugs = new Set<string>();
  data.work.forEach((item, i) => {
    unique(item.id, ['work', i, 'id']);
    if (item.slug && item.destination) add(['work', i], 'Choose a local slug OR an external destination');
    if (item.slug && !item.details) add(['work', i, 'details'], 'Local showcases require details');
    if (item.slug) {
      if (reserved.has(item.slug) || slugs.has(item.slug)) add(['work', i, 'slug'], 'Reserved or duplicate slug');
      slugs.add(item.slug);
    }
  });
  const profiles = new Set<string>();
  data.exports.profiles.forEach((profile, i) => {
    if (profiles.has(profile.id)) add(['exports', 'profiles', i, 'id'], 'Duplicate export profile');
    profiles.add(profile.id);
    if (new Set(profile.highlightIds).size !== profile.highlightIds.length || new Set(profile.workIds).size !== profile.workIds.length)
      add(['exports', 'profiles', i], 'Profile references must be unique');
    profile.highlightIds.forEach((ref, j) => { if (!highlights.has(ref)) add(['exports', 'profiles', i, 'highlightIds', j], `Unknown highlight: ${ref}`); });
    profile.workIds.forEach((ref, j) => {
      const work = data.work.find((item) => item.id === ref);
      if (!work || !work.visible || work.placement !== 'selected') add(['exports', 'profiles', i, 'workIds', j], `Work must be visible and selected: ${ref}`);
    });
  });
  if (!profiles.has(data.exports.default)) add(['exports', 'default'], 'Unknown default profile');
});

export type Resume = z.infer<typeof contentSchema>;
export type Work = Resume['work'][number];
export type ExportProfile = Resume['exports']['profiles'][number];
export type SectionId = typeof sections[number];

export function parseContent(source: string): Resume {
  const result = contentSchema.safeParse(parse(source));
  if (!result.success) throw new Error(`Content validation failed:\n${result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')}`);
  return result.data;
}

export function loadContent(): Resume {
  return parseContent(readFileSync(resolve(process.env.PORTFOLIO_CONTENT_FILE ?? 'src/content/resume.yml'), 'utf8'));
}

export function displayDate(value: string): string {
  if (value === 'Present') return value;
  const [year, month] = value.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${year}`;
}

export function workHref(work: Work): string | undefined {
  return work.slug ? sitePath(`${work.slug}/`) : work.destination;
}

export const skillKey = (value: string) => value.trim().toLocaleLowerCase('en');
export interface SkillEvidence { title: string; context: string; excerpt: string; href: string }

/** Explicit content tags provide evidence; untagged prose is never interpreted. */
export function skillEvidence(data: Resume): Map<string, SkillEvidence[]> {
  const result = new Map<string, SkillEvidence[]>();
  const enabled = (section: SectionId) => data.sections.some((item) => item.id === section && item.visible);
  const add = (skills: string[], evidence: SkillEvidence) => {
    for (const key of new Set(skills.map(skillKey))) {
      result.set(key, [...(result.get(key) ?? []), evidence]);
    }
  };
  if (enabled('experience')) for (const job of data.experience) for (const role of job.roles) {
    for (const highlight of role.highlights) add(highlight.skills, {
      title: job.company, context: role.title, excerpt: highlight.text, href: sitePath(`#${highlight.id}`),
    });
  }
  for (const work of data.work) {
    if (!work.visible || !enabled(work.placement === 'selected' ? 'selected' : 'other')) continue;
    add(work.technologies, { title: work.title, context: `${work.type} · ${work.year}`,
      excerpt: work.summary, href: workHref(work) ?? sitePath(`#${work.id}`) });
  }
  return result;
}

/** A conventional document model shared by the print view and Word exporter. */
export function resumeBlocks(data: Resume, profile: ExportProfile): { heading: string; paragraphs: { text: string; bullet?: boolean; strong?: boolean; href?: string }[] }[] {
  const enabled = (id: SectionId) => data.sections.some((section) => section.id === id && section.visible);
  const blocks: ReturnType<typeof resumeBlocks> = [];
  if (enabled('experience') && data.experience.length) blocks.push({ heading: 'Professional Experience', paragraphs: data.experience.flatMap((job) => [
    { text: job.company, strong: true },
    ...job.roles.flatMap((role) => [
      { text: `${role.title} | ${displayDate(role.start)} - ${displayDate(role.end)}`, strong: true },
      ...(role.scope ? [{ text: role.scope }] : []),
      ...profile.highlightIds.flatMap((ref) => role.highlights.filter((item) => item.id === ref).map((item) => ({ text: item.text, bullet: true })))
    ])
  ]) });
  const works = profile.workIds.flatMap((ref) => data.work.filter((item) => item.id === ref));
  if (enabled('selected') && works.length) blocks.push({ heading: 'Selected Work', paragraphs: works.flatMap((work) => [
    { text: work.title, strong: true }, { text: work.summary },
    ...(work.technologies.length ? [{ text: `Technologies: ${work.technologies.join(', ')}` }] : [])
  ]) });
  if (enabled('expertise') && data.expertise.length) blocks.push({ heading: 'Technical Skills', paragraphs: data.expertise.map((item) => ({ text: `${item.area}: ${item.tools.join(', ')}` })) });
  if (enabled('certifications') && data.certifications.length) blocks.push({ heading: 'Certifications', paragraphs: data.certifications.flatMap((item) => [
    { text: item.name, strong: true, ...(item.credentialUrl ? { href: item.credentialUrl } : {}) },
    { text: `${item.issuer}${item.issued ? ` - Issued ${displayDate(item.issued)}` : ''}${item.expires ? ` - Expires ${displayDate(item.expires)}` : ''}` }
  ]) });
  if (enabled('education') && data.education.length) blocks.push({ heading: 'Education', paragraphs: data.education.flatMap((item) => [
    { text: item.qualification, strong: true },
    { text: `${item.institution} | ${item.year}` },
    ...(item.honors ? [{ text: item.honors }] : []),
    ...item.highlights.map((highlight) => ({ text: highlight, bullet: true }))
  ]) });
  return blocks;
}
