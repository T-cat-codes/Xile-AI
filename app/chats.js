// Saving and loading chats. Each chat is one file in %APPDATA%\xile-ai\chats.
// A chat has: history (what the AI sees) and view (what the window shows).
const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('./util');
const settings = require('./settings');

const DIR = path.join(DATA_DIR, 'chats');
fs.mkdirSync(DIR, { recursive: true });

const open = new Map(); // chat id -> chat object in memory
const fileOf = (id) => path.join(DIR, `${id}.json`);

function create(folder) {
  const chat = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: 'New chat', created: Date.now(), updated: Date.now(),
    folder: folder || settings.get().folder, history: [], view: [], ctx: 0,
  };
  open.set(chat.id, chat);
  return chat;
}

function get(id) {
  if (!open.has(id)) { const c = readJson(fileOf(id), null); if (c) open.set(id, c); }
  return open.get(id);
}

function save(chat) {
  chat.updated = Date.now();
  // Pictures are big, so they are not saved.
  const history = chat.history.map((m) => (m.images ? { role: m.role, content: `${m.content} (picture not saved)` } : m));
  writeJson(fileOf(chat.id), { ...chat, history });
}

function list(isRunning) {
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(DIR, f), null)).filter(Boolean)
    .map((c) => ({ id: c.id, title: c.title, updated: c.updated, running: isRunning(c.id) }))
    .sort((a, b) => b.updated - a.updated);
}

function remove(id) {
  open.delete(id);
  fs.rmSync(fileOf(id), { force: true });
}

module.exports = { create, get, save, list, remove };
