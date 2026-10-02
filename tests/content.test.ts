import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stringify, parse } from 'yaml';
import { parseContent, resumeBlocks, type Resume } from '../src/lib/content.ts';

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
