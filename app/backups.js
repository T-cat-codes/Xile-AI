// Keeps a copy of every file before the AI changes it, so the "Undo" button can put it back.
// Copies live in %APPDATA%\xile-ai\backups.
const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('./util');

const DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(DIR, { recursive: true });

// Saves the file as it is now. Returns an id for undo().
function save(file) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const existed = fs.existsSync(file);
  writeJson(path.join(DIR, `${id}.json`), { file, existed, content: existed ? fs.readFileSync(file, 'utf8') : '' });
  return id;
}

// Puts the file back the way it was before that change.
function undo(id) {
  const b = readJson(path.join(DIR, `${id}.json`), null);
  if (!b) return 'That backup is gone.';
  if (b.existed) fs.writeFileSync(b.file, b.content);
  else fs.rmSync(b.file, { force: true });
  return b.existed ? `Put back ${path.basename(b.file)} as it was.` : `Removed the new file ${path.basename(b.file)}.`;
}

module.exports = { save, undo };
