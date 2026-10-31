// Small helpers used by the other files in app/.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..'); // the Xile AI folder
const DATA_DIR = app.getPath('userData'); // %APPDATA%\xile-ai (chats, settings, usage, backups)

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shortens long text, keeping the start and the end.
const clip = (s, max = 12000) => (s.length <= max ? s : `${s.slice(0, max / 2)}\n... (${s.length - max} characters cut) ...\n${s.slice(-max / 2)}`);

module.exports = { APP_DIR, DATA_DIR, readJson, writeJson, sleep, clip };
