// Tools for files: list, read, search, write, edit, replace_lines.
// Every change saves a backup first (app/backups.js) so the user can click "Undo".
const fs = require('fs');
const path = require('path');
const backups = require('../backups');
const { clip } = require('../util');

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', '.idea', 'dist', 'out']);
const BINARY = /\.(png|jpe?g|gif|webp|ico|apk|jar|zip|exe|dll|jks|class|so|pdf|mp4|mp3)$/i;

const resolve = (ctx, p) => path.resolve(ctx.chat.folder, p || '.');

function walkFiles(root, onFile, limit = 4000) {
  let n = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (n >= limit) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full); } else { n++; onFile(full); }
    }
  };
  walk(root);
}

// Small models often copy the "35| " line numbers from read_file into their edits. Remove them.
function stripLineNumbers(text) {
  const lines = String(text ?? '').split('\n');
  const numbered = lines.filter((l) => /^\s*\d+\s*[|:]\s?/.test(l)).length;
  if (numbered === 0 || numbered < lines.filter((l) => l.trim()).length * 0.6) return String(text ?? '');
  return lines.map((l) => l.replace(/^\s*\d+\s*[|:]\s?/, '')).join('\n');
}

// Finds oldText in content. Tries an exact match first, then a match that ignores
// spaces at the start/end of lines. Returns { start, end } or { error }.
function locate(content, oldText) {
  const exact = content.split(oldText).length - 1;
  if (exact === 1) { const start = content.indexOf(oldText); return { start, end: start + oldText.length }; }
  if (exact > 1) return { error: `That text appears ${exact} times. Use replace_lines with line numbers instead.` };

  const lines = content.split('\n');
  const want = oldText.split(/\r?\n/).map((l) => l.trim());
  while (want.length && !want[0]) want.shift();
  while (want.length && !want[want.length - 1]) want.pop();
  if (!want.length) return { error: 'old_text is empty.' };
  const hits = [];
  for (let i = 0; i + want.length <= lines.length; i++) {
    if (want.every((w, k) => lines[i + k].trim() === w)) hits.push(i);
  }
  if (hits.length === 1) {
    const before = lines.slice(0, hits[0]).join('\n');
    const start = hits[0] === 0 ? 0 : before.length + 1;
    const end = start + lines.slice(hits[0], hits[0] + want.length).join('\n').replace(/\r$/, '').length;
    return { start, end };
  }
  if (hits.length > 1) return { error: `That text appears ${hits.length} times. Use replace_lines with line numbers instead.` };

  const near = lines.findIndex((l) => l.trim() && l.includes(want[0].slice(0, 40)));
  return { error: `old_text was not found.${near >= 0 ? ` The closest line is ${near + 1}.` : ''} Use replace_lines with the line numbers from read_file instead.` };
}

const show = (lines, from, to) => lines.slice(Math.max(0, from), to).map((l, i) => `${Math.max(0, from) + i + 1}| ${l}`).join('\n');

module.exports = [
  {
    name: 'list_files',
    about: 'List files and folders. Paths are relative to the working folder.',
    inputs: { path: 'Folder to list, default "."', depth: 'number: How many levels deep, default 2' },
    permission: 'none',
    run: async (a, ctx) => {
      const depth = Math.min(Number(a.depth) || 2, 5);
      const out = [];
      const walk = (dir, d, indent) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (out.length > 500 || SKIP_DIRS.has(e.name)) continue;
          out.push(indent + e.name + (e.isDirectory() ? '/' : ''));
          if (e.isDirectory() && d < depth) walk(path.join(dir, e.name), d + 1, `${indent}  `);
        }
      };
      walk(resolve(ctx, a.path), 1, '');
      return { text: out.join('\n') || '(empty folder)' };
    },
  },
  {
    name: 'read_file',
    about: 'Read a text file. Each line starts with its line number, like "12| text" (the number is not part of the file).',
    inputs: { path: 'File path', start_line: 'number: First line, default 1', max_lines: 'number: How many lines, default 400' },
    required: ['path'],
    permission: 'none',
    run: async (a, ctx) => {
      const lines = fs.readFileSync(resolve(ctx, a.path), 'utf8').replace(/\r/g, '').split('\n');
      const start = Math.max(1, Number(a.start_line) || 1);
      const count = Math.min(Number(a.max_lines) || 400, 2000);
      const more = start - 1 + count < lines.length ? `\n... (the file has ${lines.length} lines; read more with start_line)` : '';
      return { text: clip(show(lines, start - 1, start - 1 + count), 60000) + more };
    },
  },
  {
    name: 'search_files',
    about: 'Find text in all files of a folder (not case sensitive). Returns file:line: text.',
    inputs: { query: 'Text to find', path: 'Folder to search, default "."' },
    required: ['query'],
    permission: 'none',
    run: async (a, ctx) => {
      const q = String(a.query).toLowerCase();
      const hits = [];
      walkFiles(resolve(ctx, a.path), (file) => {
        if (hits.length >= 100 || BINARY.test(file) || fs.statSync(file).size > 1e6) return;
        fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (hits.length < 100 && line.toLowerCase().includes(q)) hits.push(`${path.relative(ctx.chat.folder, file)}:${i + 1}: ${line.trim().slice(0, 200)}`);
        });
      });
      return { text: hits.join('\n') || 'No matches.' };
    },
  },
  {
    name: 'replace_lines',
    about: 'Change a file by line numbers (the easiest way to edit). Replaces lines start_line..end_line with new_text. To add lines without removing any, set end_line to start_line - 1.',
    inputs: { path: 'File path', start_line: 'number: First line to replace', end_line: 'number: Last line to replace', new_text: 'The new lines (no line numbers)' },
    required: ['path', 'start_line', 'end_line', 'new_text'],
    permission: 'edit',
    run: async (a, ctx) => {
      const file = resolve(ctx, a.path);
      const content = fs.readFileSync(file, 'utf8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.replace(/\r/g, '').split('\n');
      const start = Number(a.start_line);
      const end = Number(a.end_line);
      if (!(start >= 1 && start <= lines.length + 1 && end >= start - 1 && end <= lines.length)) {
        throw new Error(`Line numbers must be between 1 and ${lines.length}. Read the file again to check them.`);
      }
      const added = stripLineNumbers(a.new_text).replace(/\r/g, '').split('\n');
      const undo = backups.save(file);
      lines.splice(start - 1, end - start + 1, ...added);
      fs.writeFileSync(file, lines.join(eol));
      return { text: `Done. The file around the change now reads:\n${show(lines, start - 3, start - 1 + added.length + 2)}`, undo };
    },
  },
  {
    name: 'edit_file',
    about: 'Change a file by replacing old_text with new_text. old_text must be copied from the file (without line numbers).',
    inputs: { path: 'File path', old_text: 'Text now in the file', new_text: 'Text to put instead' },
    required: ['path', 'old_text', 'new_text'],
    permission: 'edit',
    run: async (a, ctx) => {
      const file = resolve(ctx, a.path);
      const content = fs.readFileSync(file, 'utf8');
      const crlf = content.includes('\r\n');
      const norm = (t) => { const s = stripLineNumbers(t).replace(/\r/g, ''); return crlf ? s.replace(/\n/g, '\r\n') : s; };
      const at = locate(content, norm(a.old_text));
      if (at.error) throw new Error(at.error);
      const undo = backups.save(file);
      fs.writeFileSync(file, content.slice(0, at.start) + norm(a.new_text) + content.slice(at.end));
      return { text: `Edited ${path.basename(file)}.`, undo };
    },
  },
  {
    name: 'write_file',
    about: 'Create a new file, or replace a whole file.',
    inputs: { path: 'File path', content: 'The full file content' },
    required: ['path', 'content'],
    permission: 'edit',
    run: async (a, ctx) => {
      const file = resolve(ctx, a.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const undo = backups.save(file);
      fs.writeFileSync(file, stripLineNumbers(a.content));
      return { text: `Wrote ${String(a.content ?? '').split('\n').length} lines to ${file}`, undo };
    },
  },
];
