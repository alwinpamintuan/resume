import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens');
const webUrl = z.url().refine((value) => /^https?:\/\//.test(value), 'Use an http or https URL');
const date = text.regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const sections = ['experience', 'selected', 'other', 'expertise', 'principles', 'education'] as const;
const asset = text.refine((value) => /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..'), 'Use a local /images/file path');

export const contentSchema = z.object({
  sample: z.boolean(),
  profile: z.object({ name: text, title: text, summary: text, location: text.optional(), email: z.email(),
    links: z.array(z.object({ label: text, url: webUrl })).default([]),
    documentName: id }),
  sections: z.array(z.object({ id: z.enum(sections), label: text, visible: z.boolean().default(true) })),
  impact: z.array(z.object({ id, value: text, label: text, context: text })).default([]),
  experience: z.array(z.object({ id, company: text, location: text.optional(),
    roles: z.array(z.object({ title: text, start: date, end: z.union([date, z.literal('Present')]),
      scope: text, highlights: z.array(z.object({ id, text })).default([]) })).min(1)
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
  principles: z.array(z.object({ title: text, description: text })).default([]),
  education: z.array(z.object({ institution: text, qualification: text, year: text })).default([]),
  exports: z.object({ default: id, profiles: z.array(z.object({ id, label: text,
    highlightIds: z.array(id), workIds: z.array(id) })).min(1) })
}).superRefine((data, ctx) => {
  const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const reservedIds = new Set<string>(['main', 'top', 'intro-title', ...sections, ...sections.map((section) => `${section}-title`)]);
  const seen = new Set<string>();
  const unique = (value: string, path: (string | number)[]) => {
    if (reservedIds.has(value)) add(path, `Reserved ID: ${value}`);
    if (seen.has(value)) add(path, `Duplicate ID: ${value}`);
    seen.add(value);
  };
  const sectionIds = new Set<string>();
  data.sections.forEach((section, i) => {
    if (sectionIds.has(section.id)) add(['sections', i, 'id'], 'Duplicate section');
    sectionIds.add(section.id);
  });
  data.impact.forEach((item, i) => unique(item.id, ['impact', i, 'id']));
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
  return parseContent(readFileSync(resolve('src/content/resume.yml'), 'utf8'));
}

export function displayDate(value: string): string {
  if (value === 'Present') return value;
  const [year, month] = value.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${year}`;
}

export function workHref(work: Work): string | undefined {
  return work.slug ? `/${work.slug}/` : work.destination;
}

/** A conventional document model shared by the print view and Word exporter. */
export function resumeBlocks(data: Resume, profile: ExportProfile): { heading: string; paragraphs: { text: string; bullet?: boolean; strong?: boolean }[] }[] {
  const enabled = (id: SectionId) => data.sections.some((section) => section.id === id && section.visible);
  const blocks: ReturnType<typeof resumeBlocks> = [];
  if (enabled('experience') && data.experience.length) blocks.push({ heading: 'Professional Experience', paragraphs: data.experience.flatMap((job) => [
    { text: job.company, strong: true },
    ...job.roles.flatMap((role) => [
      { text: `${role.title} | ${displayDate(role.start)} - ${displayDate(role.end)}`, strong: true },
      { text: role.scope },
      ...profile.highlightIds.flatMap((ref) => role.highlights.filter((item) => item.id === ref).map((item) => ({ text: item.text, bullet: true })))
    ])
  ]) });
  const works = profile.workIds.flatMap((ref) => data.work.filter((item) => item.id === ref));
  if (enabled('selected') && works.length) blocks.push({ heading: 'Selected Work', paragraphs: works.flatMap((work) => [
    { text: work.title, strong: true }, { text: work.summary },
    ...(work.technologies.length ? [{ text: `Technologies: ${work.technologies.join(', ')}` }] : [])
  ]) });
  if (enabled('expertise') && data.expertise.length) blocks.push({ heading: 'Technical Skills', paragraphs: data.expertise.map((item) => ({ text: `${item.area}: ${item.tools.join(', ')}` })) });
  if (enabled('education') && data.education.length) blocks.push({ heading: 'Education', paragraphs: data.education.map((item) => ({ text: `${item.qualification} | ${item.institution} | ${item.year}` })) });
  return blocks;
}
