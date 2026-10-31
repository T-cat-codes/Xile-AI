// Talks to Ollama, the program that runs the AI models on this PC.
const s = require('./settings');

// Sends the conversation and streams the reply. onDelta(kind, text) is called as words arrive
// (kind is 'text' or 'thinking'). Returns { content, thinking, tool_calls, stats }.
async function chat(settings, messages, tools, signal, onDelta) {
  const res = await fetch(`${settings.ollamaUrl}/api/chat`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: settings.model, messages, tools, stream: true, keep_alive: '30m', options: { num_ctx: settings.numCtx } }),
  });
  if (!res.ok) throw new Error(`Ollama said: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const out = { content: '', thinking: '', tool_calls: [], stats: {} };
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.error) throw new Error(`Ollama said: ${j.error}`);
      const m = j.message || {};
      if (m.thinking) { out.thinking += m.thinking; onDelta('thinking', m.thinking); }
      if (m.content) { out.content += m.content; onDelta('text', m.content); }
      if (m.tool_calls) out.tool_calls.push(...m.tool_calls);
      if (j.done) out.stats = j;
    }
  }
  return out;
}

// The downloaded models, for the model picker.
async function models() {
  const res = await fetch(`${s.get().ollamaUrl}/api/tags`);
  const data = await res.json();
  return (data.models || []).map((m) => ({ name: m.name, size: m.size }));
}

// Turns errors into words the user understands.
function friendlyError(e) {
  const msg = String(e?.cause?.code || e?.message || e);
  if (/ECONNREFUSED|fetch failed/i.test(msg)) return "Can't reach Ollama. Open the Ollama app, then try again.";
  if (/does not support tools/i.test(msg)) return "This model can't use tools. Pick another model under the chat box.";
  if (/image|vision/i.test(msg) && /support/i.test(msg)) return "This model can't see pictures. Pick a model with 👁 under the chat box.";
  if (/not found/i.test(msg) && /model/i.test(msg)) return 'That model is not downloaded. Pick another model under the chat box.';
  return msg;
}

module.exports = { chat, models, friendlyError };
