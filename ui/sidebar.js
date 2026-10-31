// What the LEFT sidebar does: New chat, search, the chat list, and "Edit Xile AI itself".

async function refreshChats() {
  const q = $('#searchChats').value.trim().toLowerCase();
  const list = (await xile.listChats()).filter((c) => !q || c.title.toLowerCase().includes(q));
  const box = $('#chatList');
  box.innerHTML = '';
  for (const c of list) {
    const row = el('div', `chat-item${state.chat && c.id === state.chat.id ? ' active' : ''}`);
    row.append(el('span', 'chat-name', escapeHtml(c.title)));
    if (c.running) row.append(el('span', 'run-dot', ''));
    const del = el('button', 'chat-del', '✕');
    del.title = 'Delete chat';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${c.title}"?`)) return;
      await xile.deleteChat(c.id);
      if (state.chat && state.chat.id === c.id) await openNew();
      refreshChats();
    };
    row.append(del);
    row.onclick = () => openChat(c.id);
    box.append(row);
  }
}

async function openChat(id) {
  state.chat = await xile.loadChat(id);
  renderChat();
  refreshChats();
}

async function openNew(folder) {
  state.chat = await xile.newChat(folder || state.settings.folder);
  renderChat();
  refreshChats();
  $('#input').focus();
}

$('#newChat').onclick = () => openNew();
$('#searchChats').addEventListener('input', refreshChats);

// Opens a chat that works on Xile AI's own files.
$('#editSelf').onclick = async () => {
  await openNew(await xile.appDir());
  $('#input').placeholder = 'Describe how to change Xile AI (look, buttons, features)…';
  $('#messages').prepend(el('div', 'msg note', 'This chat changes Xile AI\'s own files. After a change, click <b>Reload window</b> (or <b>Restart app</b> if it changed files in app/). Every edit has an <b>Undo</b> button.'));
};
