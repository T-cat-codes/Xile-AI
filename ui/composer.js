// What the CHAT BOX does: typing, sending/stopping, pictures (paste, drag in, + button),
// and the model and permission pickers under it.

async function send() {
  const chat = state.chat;
  if (chat.running) { xile.stop(chat.id); return; }
  const input = $('#input');
  const pics = state.attachments;
  const text = input.value.trim() || (pics.length ? 'What is in this picture?' : '');
  if (!text) return;
  input.value = '';
  state.attachments = [];
  paintAttachments();
  autosize();
  addUser(text, pics);
  if (chat.title === 'New chat') { chat.title = text.slice(0, 60); $('#chatTitle').textContent = chat.title; }
  setRunning(true);
  if (!(await xile.send(chat.id, text, pics.map((p) => p.split(',')[1])))) setRunning(false);
}

function autosize() {
  const t = $('#input');
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight, 240)}px`;
}

// Adds a picture, shrinking big ones (like 4K screenshots) so the model handles them quickly.
function addPicture(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      state.attachments.push(c.toDataURL('image/jpeg', 0.9));
      paintAttachments();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function paintAttachments() {
  const box = $('#attachments');
  box.innerHTML = '';
  state.attachments.forEach((src, i) => {
    const t = el('div', 'thumb');
    const img = el('img');
    img.src = src;
    const x = el('button', '', '✕');
    x.title = 'Remove';
    x.onclick = () => { state.attachments.splice(i, 1); paintAttachments(); };
    t.append(img, x);
    box.append(t);
  });
}

$('#sendBtn').onclick = send;
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
$('#input').addEventListener('input', autosize);
$('#input').addEventListener('paste', (e) => {
  const files = [...e.clipboardData.items].filter((i) => i.kind === 'file').map((i) => i.getAsFile());
  if (files.length) { e.preventDefault(); files.forEach(addPicture); }
});
$('#attachBtn').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = (e) => { [...e.target.files].forEach(addPicture); e.target.value = ''; };
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
window.addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('dragging'); [...e.dataTransfer.files].forEach(addPicture); });

$('#modelSelect').onchange = async (e) => { state.settings = await xile.setSettings({ model: e.target.value }); };
$('#modeSelect').onchange = async (e) => { state.settings = await xile.setSettings({ mode: e.target.value }); };
