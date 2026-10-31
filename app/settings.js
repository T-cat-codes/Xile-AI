// The user's settings (right panel and the pickers under the chat box).
// Saved in %APPDATA%\xile-ai\settings.json. To add a setting: add it to DEFAULTS here,
// then add a control for it in ui/index.html and ui/panel.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('./util');

const FILE = path.join(DATA_DIR, 'settings.json');
const tvHome = path.join(os.homedir(), 'Documents', 'TV Home');

const DEFAULTS = {
  ollamaUrl: 'http://127.0.0.1:11434',
  model: 'qwen3-vl:30b-a3b-instruct',
  numCtx: 32768, // how much the AI can remember (context window)
  mode: 'ask', // ask = ask before changes, edits = file edits without asking, auto = never ask
  folder: fs.existsSync(tvHome) ? tvHome : os.homedir(),
  webAccess: true, // turns the web tools (app/tools/web.js) on or off
};

const get = () => ({ ...DEFAULTS, ...readJson(FILE, {}) });
const set = (patch) => { const s = { ...get(), ...patch }; writeJson(FILE, s); return s; };

module.exports = { get, set };
