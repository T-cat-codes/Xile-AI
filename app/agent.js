// The agent loop: send the chat to the model, run the tools it asks for, repeat until it's done.
// Also handles Stop, the permission questions, and the "stuck" check.
const settings = require('./settings');
const chats = require('./chats');
const usage = require('./usage');
const ollama = require('./ollama');
const tools = require('./tools');
const { systemPrompt } = require('./prompt');
const { killTree } = require('./tools/command');
const { clip } = require('./util');

const MAX_STEPS = 40;
const MAX_FAILS_IN_A_ROW = 4;
const runs = new Map(); // chat id -> { abort, proc, allowed, hid, ... }
const pending = new Map(); // question id -> { chatId, resolve }

const isRunning = (id) => runs.has(id);

const estimateTokens = (msgs) => Math.round(
  msgs.reduce((n, m) => n + (m.content || '').length + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0), 0) / 3.5
  + msgs.reduce((n, m) => n + (m.images ? m.images.length * 1000 : 0), 0),
);

// Fits the conversation into the model's memory: only the newest screenshot and the newest
// pasted pictures are sent, then old long tool results get shortened, then old messages dropped.
function fitContext(history, numCtx) {
  const lastShot = history.map((m) => !!(m.images && m.shot)).lastIndexOf(true);
  const lastPasted = history.map((m) => !!(m.images && !m.shot)).lastIndexOf(true);
  let msgs = history.map((m, i) => {
    const { shot, ...msg } = m;
    if (!m.images || i === lastShot || i === lastPasted) return msg;
    return { role: m.role, content: `${m.content} (old picture removed)` };
  });
  const budget = numCtx * 0.7;
  for (const m of msgs) {
    if (estimateTokens(msgs) <= budget) break;
    if (m.role === 'tool' && m.content.length > 600) m.content = `${m.content.slice(0, 400)}\n... (old result shortened)`;
  }
  while (estimateTokens(msgs) > budget && msgs.length > 6) msgs = msgs.slice(1);
  return msgs;
}

function needsPermission(tool) {
  const mode = settings.get().mode;
  if (tool.permission === 'none' || mode === 'auto') return false;
  return !(mode === 'edits' && tool.permission === 'edit');
}

async function run(win, chat, userText, images = []) {
  const r = { abort: new AbortController(), proc: null, allowed: new Set(), hid: false, seen: new Map(), failsInARow: 0 };
  runs.set(chat.id, r);
  const emit = (ev) => { if (!win.isDestroyed()) win.webContents.send('chat-event', { chatId: chat.id, ...ev }); };
  const stopped = () => r.abort.signal.aborted;
  const ctx = { chat, run: r, win };

  if (chat.title === 'New chat') chat.title = userText.replace(/\s+/g, ' ').slice(0, 60);
  chat.history.push(images.length ? { role: 'user', content: userText, images } : { role: 'user', content: userText });
  chat.view.push({ type: 'user', text: userText, pictures: images.length });
  chats.save(chat);
  emit({ type: 'status', running: true });
  emit({ type: 'chats-changed' });

  try {
    for (let step = 0; step < MAX_STEPS && !stopped(); step++) {
      const s = settings.get();
      const item = { type: 'assistant', text: '', thinking: '' };
      chat.view.push(item);
      emit({ type: 'assistant-start' });
      const started = Date.now();
      const messages = [{ role: 'system', content: systemPrompt(chat, s) }, ...fitContext(chat.history, s.numCtx)];
      const reply = await ollama.chat(s, messages, tools.forOllama(s), r.abort.signal, (kind, d) => {
        item[kind === 'text' ? 'text' : 'thinking'] += d;
        emit({ type: 'delta', kind, text: d });
      });
      const st = reply.stats;
      chat.ctx = Math.max((st.prompt_eval_count || 0) + (st.eval_count || 0), estimateTokens(messages));
      usage.add(st.prompt_eval_count || 0, st.eval_count || 0, (Date.now() - started) / 1000);
      emit({ type: 'stats', ctx: chat.ctx, numCtx: s.numCtx, tps: st.eval_duration ? st.eval_count / (st.eval_duration / 1e9) : 0 });

      const msg = { role: 'assistant', content: reply.content };
      if (reply.tool_calls.length) msg.tool_calls = reply.tool_calls;
      chat.history.push(msg);
      if (!reply.tool_calls.length) break;

      for (const call of reply.tool_calls) {
        if (stopped()) break;
        const name = call.function?.name;
        let args = call.function?.arguments || {};
        if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
        const row = { type: 'tool', name, args, state: 'running', result: '' };
        chat.view.push(row);
        emit({ type: 'tool-start', name, args });

        const tool = tools.find(name);
        let result = tool ? null : { text: `There is no tool called ${name}.`, error: true };
        if (tool && needsPermission(tool) && !r.allowed.has(name)) {
          if (r.hid && !win.isDestroyed()) { win.restore(); r.hid = false; } // show the question
          const id = Math.random().toString(36).slice(2);
          emit({ type: 'approval', id, name, args });
          const answer = await new Promise((resolve) => pending.set(id, { chatId: chat.id, resolve }));
          if (answer === 'always') r.allowed.add(name);
          if (answer === 'no') result = { text: 'The user said no to this step. Stop and ask what they want instead.', denied: true };
        }
        if (!result && stopped()) break;
        if (!result) {
          try { result = await tool.run(args, ctx); } catch (e) { result = { text: `Error: ${e.message}`, error: true }; }
        }

        // The "stuck" check: small models sometimes repeat the same step forever.
        const key = name + JSON.stringify(args);
        const times = (r.seen.get(key) || 0) + 1;
        r.seen.set(key, times);
        r.failsInARow = result.error ? r.failsInARow + 1 : 0;
        if (times >= 2 && result.error) result.text += '\nThis exact step already failed before. Do NOT repeat it. Try a different way (for file edits use replace_lines), or tell the user what is wrong.';
        else if (times >= 3) result.text += '\nYou already did this exact step. Use what you have and move on.';

        row.state = result.denied ? 'denied' : result.error ? 'error' : 'done';
        row.result = clip(result.text, 4000);
        if (result.undo) row.undo = result.undo;
        chat.history.push({ role: 'tool', tool_name: name, content: result.text });
        if (result.image) chat.history.push({ role: 'user', content: name === 'tv_screenshot' ? 'The TV screen now:' : 'Screenshot of the screen now:', images: [result.image], shot: true });
        emit({ type: 'tool-end', state: row.state, result: row.result, undo: row.undo, image: result.image ? `data:image/png;base64,${result.image}` : null });
        if (result.denied) { r.abort.abort(); break; }
        if (r.failsInARow >= MAX_FAILS_IN_A_ROW) {
          const text = `Xile AI got stuck (${MAX_FAILS_IN_A_ROW} failed steps in a row), so it stopped. Try asking for something smaller or more exact.`;
          chat.view.push({ type: 'error', text });
          emit({ type: 'error', text });
          r.abort.abort();
          break;
        }
      }
      chats.save(chat);
    }
  } catch (e) {
    if (!stopped()) {
      const text = ollama.friendlyError(e);
      chat.view.push({ type: 'error', text });
      emit({ type: 'error', text });
    }
  } finally {
    runs.delete(chat.id);
    for (const [id, p] of pending) if (p.chatId === chat.id) { pending.delete(id); p.resolve('no'); }
    if (r.hid && !win.isDestroyed()) { win.restore(); win.focus(); }
    chats.save(chat);
    emit({ type: 'status', running: false });
    emit({ type: 'chats-changed' });
  }
}

function stop(chatId) {
  const r = runs.get(chatId);
  if (!r) return;
  r.abort.abort();
  if (r.proc) killTree(r.proc.pid);
  for (const [id, p] of pending) if (p.chatId === chatId) { pending.delete(id); p.resolve('no'); }
}

function answer(questionId, decision) {
  const p = pending.get(questionId);
  if (p) { pending.delete(questionId); p.resolve(decision); }
}

module.exports = { run, stop, answer, isRunning };
