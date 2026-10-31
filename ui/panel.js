// What the RIGHT panel does: Ollama status, working folder, Context bar, Usage, Settings.

function updateContext(ctx = 0, numCtx = state.settings.numCtx) {
  const pct = Math.min(100, Math.round((ctx / numCtx) * 100));
  $('#ctxPct').textContent = `${pct}% used`;
  $('#ctxNums').textContent = `${fmtK(ctx)} / ${fmtK(numCtx)}`;
  const bar = $('#ctxBar');
  bar.style.width = `${pct}%`;
  bar.className = pct > 85 ? 'full' : pct > 60 ? 'warn' : '';
}

function updateFolder() {
  const f = state.chat?.folder || state.settings.folder;
  $('#folderName').textContent = f.split(/[\\/]/).filter(Boolean).pop();
  $('#folderPath').textContent = f;
}

async function refreshUsage() {
  const u = await xile.usage();
  $('#useToday').textContent = `${u.today.requests} replies`;
  $('#useTokens').textContent = `${fmtK(u.today.in)} / ${fmtK(u.today.out)}`;
  $('#useTime').textContent = fmtTime(u.today.seconds);
  $('#useTotal').textContent = `${fmtK(u.total.in + u.total.out)} tokens`;
}

// Fills the model picker and the Ollama status dot.
async function loadModels() {
  const r = await xile.models();
  const sel = $('#modelSelect');
  const keep = sel.value || state.settings.model;
  sel.innerHTML = '';
  if (r.error) {
    $('#ollamaDot').className = 'dot off';
    $('#ollamaText').textContent = 'Ollama is not running';
    sel.append(new Option(state.settings.model, state.settings.model));
    return;
  }
  $('#ollamaDot').className = 'dot on';
  $('#ollamaText').textContent = `Ollama running · ${r.models.length} model${r.models.length === 1 ? '' : 's'}`;
  for (const m of r.models) {
    const sees = /vl|vision|llava|gemma3|minicpm-v/i.test(m.name); // 👁 = can see pictures
    sel.append(new Option(`${m.name}${sees ? ' 👁' : ''}  (${(m.size / 1e9).toFixed(0)} GB)`, m.name));
  }
  if (![...sel.options].some((o) => o.value === keep)) sel.append(new Option(`${keep} (not downloaded)`, keep));
  sel.value = keep;
}

$('#changeFolder').onclick = async () => {
  const f = await xile.pickFolder(state.chat.id);
  if (f) { state.chat.folder = f; state.settings.folder = f; updateFolder(); }
};
$('#folderName').onclick = () => xile.openPath(state.chat.folder);
$('#togglePanel').onclick = () => document.body.classList.toggle('no-panel');
$('#ctxSelect').onchange = async (e) => { state.settings = await xile.setSettings({ numCtx: Number(e.target.value) }); updateContext(state.chat.ctx, state.settings.numCtx); };
$('#webToggle').onchange = async (e) => { state.settings = await xile.setSettings({ webAccess: e.target.checked }); };
$('#ollamaUrl').onchange = async (e) => { state.settings = await xile.setSettings({ ollamaUrl: e.target.value.trim() }); loadModels(); };
$('#reloadBtn').onclick = () => location.reload();
$('#restartBtn').onclick = () => xile.restart();
