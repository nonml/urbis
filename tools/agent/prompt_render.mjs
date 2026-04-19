import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PROMPTS_DIR = join(HERE, 'prompts');

const MAX_CONTEXT_CHARS = Number(process.env.MODEL_MAX_CONTEXT_CHARS || 60_000);

export function loadTemplate(type) {
  const path = join(PROMPTS_DIR, `${type}.md`);
  if (!existsSync(path)) return readFileSync(join(PROMPTS_DIR, 'feature.md'), 'utf8');
  return readFileSync(path, 'utf8');
}

function readFileSafe(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return { path: relPath, content: '(file does not exist — will be created)', bytes: 0 };
  const stat = statSync(abs);
  if (stat.size > 200_000) return { path: relPath, content: `(file too large: ${stat.size} bytes — excluded)`, bytes: stat.size };
  return { path: relPath, content: readFileSync(abs, 'utf8'), bytes: stat.size };
}

export function buildFilesBlock(paths) {
  const parts = [];
  for (const p of paths) {
    const f = readFileSafe(p);
    parts.push(`--- FILE: ${f.path} ---\n${f.content}\n`);
  }
  return parts.join('\n');
}

export function renderPrompt(task) {
  let tpl = loadTemplate(task.type);
  const filesContent =
    buildFilesBlock(task.files_allowed || []) +
    (task.files_reference?.length ? `\n--- REFERENCE FILES ---\n${buildFilesBlock(task.files_reference)}` : '');

  const acceptance = (task.acceptance || []).map((a) => `- ${a}`).join('\n');

  const rendered = tpl
    .replaceAll('{{task.slice}}', task.title || task.slice || task.description || task.id)
    .replaceAll('{{task.files_allowed}}', (task.files_allowed || []).join(', '))
    .replaceAll('{{task.files_reference}}', (task.files_reference || []).join(', '))
    .replaceAll('{{task.max_loc}}', String(task.max_loc || 300))
    .replaceAll('{{task.max_files}}', String(task.max_files || 4))
    .replaceAll('{{files_content}}', filesContent)
    .replace(/\{\{#each task\.acceptance\}\}[\s\S]*?\{\{\/each\}\}/g, acceptance);

  if (rendered.length > MAX_CONTEXT_CHARS) {
    throw new Error(`prompt exceeds MAX_CONTEXT_CHARS (${rendered.length} > ${MAX_CONTEXT_CHARS}). Task too large — mark needs_split.`);
  }
  return rendered;
}

export function renderFixPrompt(task, gateError, lastDiff) {
  return `Your previous diff for task "${task.id}" failed the gate.

${gateError}

Your previous diff:
${lastDiff}

Produce a corrected unified diff touching only files in: ${(task.files_allowed || []).join(', ')}.
Output a single unified diff or ABORT_NEEDS_SPLIT. No prose.`;
}
