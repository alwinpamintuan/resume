import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContent } from '../src/lib/content.ts';

const content = loadContent();
for (const work of content.work) {
  const screenshot = work.details?.screenshot;
  if (screenshot && !existsSync(resolve('public', screenshot.src.slice(1)))) throw new Error(`work.${work.id}.details.screenshot.src: file does not exist`);
}
console.log(`Validated résumé, ${content.work.length} work entries, and ${content.exports.profiles.length} export profiles.`);
