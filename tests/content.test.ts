import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stringify, parse } from 'yaml';
import { parseContent, resumeBlocks, skillEvidence, type Resume } from '../src/lib/content.ts';

const source = readFileSync('tests/fixtures/resume.yml', 'utf8');
function changed(edit: (data: Resume) => void): string { const data = parse(source) as Resume; edit(data); return stringify(data); }

test('sample content and both profiles validate', () => { const data = parseContent(source); assert.equal(data.exports.profiles.length, 2); assert.equal(data.sample, true); });
test('résumé filenames support conventional naming without allowing paths', () => {
  assert.equal(parseContent(changed((d) => { d.profile.documentName = 'Resume_JohnAlwinPamintuan_DataEngineer'; })).profile.documentName, 'Resume_JohnAlwinPamintuan_DataEngineer');
  assert.throws(() => parseContent(changed((d) => { d.profile.documentName = '../resume'; })), /without an extension/);
});
test('malformed YAML is rejected', () => assert.throws(() => parseContent('profile: [\n')));
test('errors identify missing required fields', () => assert.throws(() => parseContent('sample: true'), /profile/));
test('duplicate IDs are rejected', () => assert.throws(() => parseContent(changed((d) => { d.work[1]!.id = d.work[0]!.id; })), /Duplicate ID/));
test('content IDs cannot collide with page anchors', () => assert.throws(() => parseContent(changed((d) => { d.work[2]!.id = 'experience'; })), /Reserved ID/));
test('duplicate and reserved showcase routes are rejected', () => {
  assert.throws(() => parseContent(changed((d) => { d.work[2]!.slug = d.work[0]!.slug; })), /duplicate slug/);
  assert.throws(() => parseContent(changed((d) => { d.work[0]!.slug = 'resume'; })), /Reserved/);
});
test('local and external ownership cannot compete', () => assert.throws(() => parseContent(changed((d) => { d.work[0]!.destination = 'https://example.com/tool/'; })), /local slug OR/));
test('unsafe links and traversal assets are rejected', () => {
  assert.throws(() => parseContent(changed((d) => { d.profile.links[0]!.url = 'javascript:alert(1)'; })), /http/);
  assert.throws(() => parseContent(changed((d) => { d.work[2]!.details!.screenshot!.src = '/../secret.svg'; })), /local/);
});
test('unknown or hidden export references are rejected', () => {
  assert.throws(() => parseContent(changed((d) => { d.exports.profiles[0]!.highlightIds.push('missing'); })), /Unknown highlight/);
  assert.throws(() => parseContent(changed((d) => { d.work[0]!.visible = false; })), /visible and selected/);
});
test('optional collections and fields may be omitted', () => {
  const data = parseContent(changed((d) => { d.impact = []; d.principles = []; delete d.profile.location; d.work[2]!.visible = false; }));
  assert.equal(data.impact.length, 0); assert.equal(data.work[2]!.visible, false);
});
test('export profiles select real content and omit secondary projects', () => {
  const data = parseContent(source);
  const general = JSON.stringify(resumeBlocks(data, data.exports.profiles[0]!));
  const platform = JSON.stringify(resumeBlocks(data, data.exports.profiles[1]!));
  assert.match(general, /24 hours to six hours/); assert.doesNotMatch(platform, /24 hours to six hours/);
  assert.doesNotMatch(general, /Schema Notes/); assert.doesNotMatch(general, /How I Work/);
});
test('editing YAML changes the shared document model', () => {
  const data = parseContent(changed((d) => { d.experience[0]!.company = 'Changed Employer'; }));
  assert.match(JSON.stringify(resumeBlocks(data, data.exports.profiles[0]!)), /Changed Employer/);
});

test('certifications follow skills in documents and respect section visibility', () => {
  const data = parseContent(source);
  const profile = data.exports.profiles[0]!;
  const blocks = resumeBlocks(data, profile);
  assert.equal(blocks.findIndex((block) => block.heading === 'Certifications'), blocks.findIndex((block) => block.heading === 'Technical Skills') + 1);
  assert.match(JSON.stringify(blocks), /Example Data Engineering Certification.*Example Certification Board.*Issued Jun 2026.*Expires Jun 2028/);
  const certification = blocks.find((block) => block.heading === 'Certifications')!;
  assert.equal(certification.paragraphs[0]!.href, 'https://example.com/credentials/data-engineering');
  assert.equal(certification.paragraphs.some((paragraph) => paragraph.text.includes('https://')), false);
  assert.match(JSON.stringify(blocks), /https:\/\/example.com\/credentials\/data-engineering/);
  data.sections.find((section) => section.id === 'certifications')!.visible = false;
  assert.equal(resumeBlocks(data, profile).some((block) => block.heading === 'Certifications'), false);
  data.sections.find((section) => section.id === 'certifications')!.visible = true;
  data.certifications = [];
  assert.equal(resumeBlocks(data, profile).some((block) => block.heading === 'Certifications'), false);
});

test('certifications allow omitted dates and reject unsafe links and reversed dates', () => {
  const data = parseContent(changed((d) => { d.certifications = [{ name: 'Example credential', issuer: 'Example issuer' }]; }));
  assert.match(JSON.stringify(resumeBlocks(data, data.exports.profiles[0]!)), /Example credential.*Example issuer/);
  assert.throws(() => parseContent(changed((d) => { d.certifications[0]!.credentialUrl = 'javascript:alert(1)'; })), /http/);
  assert.throws(() => parseContent(changed((d) => { d.certifications[0]!.expires = '2025-06'; })), /Expiry must follow/);
  assert.throws(() => parseContent(changed((d) => { d.certifications[0]!.issued = '2026-13'; })), /YYYY-MM/);
  const legacy = parse(source);
  delete legacy.certifications;
  assert.deepEqual(parseContent(stringify(legacy)).certifications, []);
});

test('minimal career entries do not require invented role descriptions or achievements', () => {
  const data = parseContent(changed((d) => {
    d.experience.forEach((job) => job.roles.forEach((role) => { delete role.scope; role.highlights = []; }));
    d.work = [];
    d.exports.profiles.forEach((profile) => { profile.highlightIds = []; profile.workIds = []; });
  }));
  const blocks = resumeBlocks(data, data.exports.profiles[0]!);
  assert.equal(blocks.some((block) => block.heading === 'Selected Work'), false);
  assert.equal(blocks.flatMap((block) => block.paragraphs).some((paragraph) => !paragraph.text), false);
});

test('skill evidence joins explicit achievement tags and project technologies', () => {
  const data = parseContent(source);
  const airflow = skillEvidence(data).get('airflow')!;
  assert.equal(airflow.length, 2);
  assert.equal(airflow[0]!.href, '/#ingestion-recovery');
  assert.equal(airflow[1]!.href, '/reliable-ingestion/');
  assert.equal(skillEvidence(data).has('terraform'), false);
});

test('skill matching ignores capitalization and whitespace without duplicate evidence', () => {
  const data = parseContent(changed((d) => { d.experience[0]!.roles[1]!.highlights[1]!.skills = [' PYTHON ', 'python']; }));
  assert.equal(skillEvidence(data).get('python')!.filter((item) => item.href === '/#ingestion-recovery').length, 1);
});

test('hidden work and sections do not expose skill evidence', () => {
  const data = parseContent(source);
  data.work[0]!.visible = false;
  data.sections.find((section) => section.id === 'experience')!.visible = false;
  assert.equal(skillEvidence(data).has('airflow'), false);
  data.sections.find((section) => section.id === 'other')!.visible = false;
  assert.equal(skillEvidence(data).has('typescript'), false);
});


test('education highlights remain under Education and old entries still validate', () => {
  const legacy = parseContent(source);
  assert.deepEqual(legacy.education[0]!.highlights, []);
  const data = parseContent(changed((d) => { d.education[0]!.highlights = ['Student organization leadership', 'Competitive programming participation']; }));
  const blocks = resumeBlocks(data, data.exports.profiles[0]!);
  const education = blocks.find((block) => block.heading === 'Education')!;
  assert.deepEqual(education.paragraphs.slice(2), [
    { text: 'Student organization leadership', bullet: true },
    { text: 'Competitive programming participation', bullet: true }
  ]);
  assert.doesNotMatch(JSON.stringify(blocks.find((block) => block.heading === 'Professional Experience')), /Student organization leadership/);
  data.sections.find((section) => section.id === 'education')!.visible = false;
  assert.equal(resumeBlocks(data, data.exports.profiles[0]!).some((block) => block.heading === 'Education'), false);
});
