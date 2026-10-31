// What the MIDDLE chat shows: messages, tool steps, permission questions, and live updates
// from the AI (xile.onEvent at the bottom).

let live = null; // the AI reply being written right now: { el, text, thinking }
let liveTool = null; // the tool step running right now
let paintQueued = false;

function renderChat() {
  const chat = state.chat;
  live = null;
  liveTool = null;
  const box = $('#messages');
  box.innerHTML = '';
  $('#chatTitle').textContent = chat.title;
  if (!chat.view.length) box.append(welcome());
  for (const item of chat.view) {
    if (item.type === 'user') addUser(item.text, item.pictures);
    else if (item.type === 'assistant') { const b = addAssistant(); b.text = item.text; b.thinking = item.thinking; paintAssistant(b); }
    else if (item.type === 'tool') finishTool(addTool(item.name, item.args), item.state, item.result, null, item.undo);
    else if (item.type === 'error') addError(item.text);
  }
  live = null;
  liveTool = null;
  setRunning(chat.running);
  updateFolder();
  updateContext(chat.ctx, state.settings.numCtx);
  scrollDown(true);
}

function welcome() {
  const w = el('div', 'welcome');
  const logo = el('img', 'welcome-logo');
  logo.src = '../icon.png';
  w.append(logo, el('h1', '', 'What should we do?'), el('p', 'muted', 'Xile AI runs on your PC. It can change files, run commands, use your screen and your TV.'));
  const chips = el('div', 'chips');
  for (const t of STARTERS) {
    const c = el('button', 'chip', escapeHtml(t));
    c.onclick = () => { $('#input').value = t; send(); };
    chips.append(c);
  }
  w.append(chips);
  return w;
}

function scrollDown(force) {
  const box = $('#messages');
  if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 200) box.scrollTop = box.scrollHeight;
}

// Your message. pics = picture data: URLs (just sent) or a number (reopened chat; pictures aren't saved).
function addUser(text, pics) {
  $('#messages .welcome')?.remove();
  const m = el('div', 'msg user');
  if (Array.isArray(pics) && pics.length) {
    const row = el('div', 'pics');
    for (const src of pics) { const img = el('img'); img.src = src; row.append(img); }
    m.append(row);
  } else if (pics) {
    m.append(el('div', 'pic-note', `🖼 ${pics} picture${pics > 1 ? 's' : ''}`));
  }
  m.append(el('div', 'bubble', escapeHtml(text).replace(/\n/g, '<br>')));
  $('#messages').append(m);
  scrollDown(true);
}

function addAssistant() {
  const m = el('div', 'msg assistant');
  $('#messages').append(m);
  return { el: m, text: '', thinking: '' };
}

function paintAssistant(b) {
  let html = '';
  if (b.thinking) html += `<details class="thinking"><summary>Thinking</summary><div>${escapeHtml(b.thinking)}</div></details>`;
  html += renderMarkdown(b.text);
  b.el.innerHTML = html;
  b.el.style.display = b.text || b.thinking ? '' : 'none';
}

// The short text after a tool's name, like the file path or the command.
function toolSummary(name, a = {}) {
  if (name === 'click') return `${Math.round(a.x)}, ${Math.round(a.y)}${a.double ? ' (double)' : ''}`;
  if (name === 'scroll') return a.direction || '';
  if (name === 'wait') return `${a.seconds} s`;
  if (name === 'replace_lines') return `${a.path} (lines ${a.start_line}-${a.end_line})`;
  if (name === 'search_files' || name === 'web_search') return `"${a.query}"`;
  return a.path || a.command || a.url || a.args || a.keys || (a.text ? `"${a.text}"` : '') || '';
}

function addTool(name, args) {
  const [icon, label] = TOOL_LABELS[name] || ['⚙️', name];
  const d = el('details', 'tool running');
  const s = el('summary');
  s.append(el('span', 'tool-icon', icon), el('span', 'tool-label', label), el('span', 'tool-arg', escapeHtml(toolSummary(name, args))), el('span', 'tool-state', ''));
  d.append(s);
  const body = el('div', 'tool-body');
  if (name === 'edit_file') {
    const lines = (t, cls, sign) => escapeHtml(t || '').split('\n').map((l) => `<span class="${cls}">${sign} ${l}</span>`).join('\n');
    body.append(el('pre', 'diff', `${lines(args.old_text, 'del', '-')}\n${lines(args.new_text, 'add', '+')}`));
  }
  if (name === 'replace_lines') body.append(el('pre', 'diff', escapeHtml(args.new_text || '').split('\n').map((l) => `<span class="add">+ ${l}</span>`).join('\n')));
  if (name === 'run_command') body.append(el('pre', 'cmd', `&gt; ${escapeHtml(args.command || '')}`));
  d.append(body);
  $('#messages').append(d);
  scrollDown();
  return { el: d, name, args };
}

function finishTool(t, toolState, result, image, undoId) {
  t.el.classList.remove('running', 'waiting');
  t.el.classList.add(toolState);
  const stateEl = t.el.querySelector('.tool-state');
  stateEl.textContent = { error: 'failed', denied: 'you said no' }[toolState] ?? '';
  if (undoId) {
    const u = el('button', 'undo-btn', 'Undo');
    u.title = 'Put the file back the way it was before this change';
    u.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); u.disabled = true; u.textContent = await xile.undo(undoId); };
    stateEl.after(u);
  }
  const body = t.el.querySelector('.tool-body');
  if (result && !/screenshot/.test(t.name)) body.append(el('pre', 'result', escapeHtml(result)));
  if (image) { const img = el('img', 'shot'); img.src = image; body.append(img); }
  t.el.querySelector('.approval')?.remove();
}

function addApproval(t, id, name, args) {
  t.el.classList.add('waiting');
  t.el.open = true;
  const [, label] = TOOL_LABELS[name] || ['', name];
  const card = el('div', 'approval');
  card.append(el('div', 'approval-q', `Allow Xile AI to: <b>${escapeHtml(label)}</b> ${escapeHtml(toolSummary(name, args))}?`));
  const row = el('div', 'approval-btns');
  for (const [text, decision, cls] of [['Yes', 'yes', 'primary'], ['Yes, always in this chat', 'always', ''], ['No', 'no', 'danger']]) {
    const b = el('button', `btn ${cls}`, text);
    b.onclick = () => { card.remove(); t.el.classList.remove('waiting'); t.el.open = false; xile.approve(id, decision); };
    row.append(b);
  }
  card.append(row);
  t.el.append(card);
  scrollDown(true);
}

function addError(text) {
  $('#messages').append(el('div', 'msg error', `⚠️ ${escapeHtml(text)}`));
  scrollDown(true);
}

function setRunning(on) {
  state.chat.running = on;
  const btn = $('#sendBtn');
  btn.textContent = on ? '■' : '↑';
  btn.title = on ? 'Stop' : 'Send (Enter)';
  btn.classList.toggle('stop', on);
  $('#status').innerHTML = on ? '<span class="spinner"></span> Working…' : '';
}

// Live updates from the AI while it works (sent by app/agent.js).
xile.onEvent((ev) => {
  if (ev.type === 'chats-changed') { refreshChats(); refreshUsage(); return; }
  if (!state.chat || ev.chatId !== state.chat.id) return;
  switch (ev.type) {
    case 'status':
      setRunning(ev.running);
      if (!ev.running) xile.loadChat(state.chat.id).then((c) => { if (c && state.chat?.id === c.id) { state.chat.title = c.title; $('#chatTitle').textContent = c.title; } });
      break;
    case 'assistant-start':
      live = addAssistant();
      paintAssistant(live);
      break;
    case 'delta':
      if (!live) live = addAssistant();
      live[ev.kind === 'text' ? 'text' : 'thinking'] += ev.text;
      if (!paintQueued) { paintQueued = true; requestAnimationFrame(() => { paintQueued = false; if (live) { paintAssistant(live); scrollDown(); } }); }
      break;
    case 'tool-start':
      liveTool = addTool(ev.name, ev.args);
      break;
    case 'approval':
      if (liveTool) addApproval(liveTool, ev.id, ev.name, ev.args);
      break;
    case 'tool-end':
      if (liveTool) finishTool(liveTool, ev.state, ev.result, ev.image, ev.undo);
      liveTool = null;
      break;
    case 'stats':
      updateContext(ev.ctx, ev.numCtx);
      if (ev.tps) $('#useSpeed').textContent = `${ev.tps.toFixed(1)} tokens/s`;
      refreshUsage();
      break;
    case 'error':
      addError(ev.text);
      break;
    default:
  }
});
