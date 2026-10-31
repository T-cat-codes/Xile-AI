// Shared things every ui/*.js file uses: shortcuts, the current chat, and tool icons.
// Loaded first (see the script list at the bottom of index.html).

const $ = (selector) => document.querySelector(selector);

// Makes an element: el('div', 'my-class', '<b>html</b>')
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtK = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const fmtTime = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)} h` : sec >= 60 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`);

// What the app knows right now.
const state = {
  settings: {},
  chat: null, // the open chat: { id, title, folder, view, ctx, running }
  attachments: [], // pictures waiting to be sent (data: URLs)
};

// Icon and words shown for each tool step in the chat. Add a line here when you add a tool.
const TOOL_LABELS = {
  list_files: ['📂', 'Listed files'],
  read_file: ['📄', 'Read'],
  search_files: ['🔍', 'Searched for'],
  replace_lines: ['✏️', 'Edited'],
  edit_file: ['✏️', 'Edited'],
  write_file: ['📝', 'Wrote'],
  run_command: ['⌨️', 'Ran'],
  screenshot: ['🖥️', 'Looked at the screen'],
  click: ['🖱️', 'Clicked'],
  type_text: ['⌨️', 'Typed'],
  press_keys: ['⌨️', 'Pressed'],
  scroll: ['🖱️', 'Scrolled'],
  wait: ['⏳', 'Waited'],
  web_search: ['🌐', 'Searched the web for'],
  read_webpage: ['🌐', 'Read web page'],
  tv_connect: ['📺', 'Connected to the TV'],
  tv_pair: ['📺', 'Paired with the TV'],
  adb: ['📺', 'TV command'],
  tv_screenshot: ['📺', 'Looked at the TV'],
};

// Starter buttons on an empty chat.
const STARTERS = [
  "What's in this folder?",
  'What is on my TV screen right now?',
  'Open Chrome and go to youtube.com',
  "Search the web for today's top news",
];
