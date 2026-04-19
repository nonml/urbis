import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKLIST_PATH = join(HERE, '..', '..', 'docs', 'CHECKLIST_2Y.md');

export function tickChecklistItems(ids) {
  if (!ids || !ids.length) return [];
  const text = readFileSync(CHECKLIST_PATH, 'utf8');
  const lines = text.split('\n');
  const ticked = [];
  for (let i = 0; i < lines.length; i++) {
    for (const id of ids) {
      if (lines[i].includes('`' + id + '`') && lines[i].startsWith('- [ ]')) {
        lines[i] = lines[i].replace('- [ ]', '- [x]');
        ticked.push(id);
      }
    }
  }
  if (ticked.length) writeFileSync(CHECKLIST_PATH, lines.join('\n'));
  return ticked;
}
