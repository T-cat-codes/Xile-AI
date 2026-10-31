// Starts the window: loads settings, fills the pickers, opens the newest chat. Loaded last.

async function start() {
  state.settings = await xile.getSettings();
  $('#modeSelect').value = state.settings.mode;
  $('#ctxSelect').value = String(state.settings.numCtx);
  $('#webToggle').checked = state.settings.webAccess;
  $('#ollamaUrl').value = state.settings.ollamaUrl;
  await loadModels();
  const list = await xile.listChats();
  if (list.length) await openChat(list[0].id); else await openNew();
  refreshUsage();
  setInterval(loadModels, 15000); // keeps the Ollama dot up to date
}

start();
