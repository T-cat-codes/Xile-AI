// Starts Xile AI: opens the window and connects the window's buttons to the app/ files.
// The real work is in app/ (see XILE.md for the map).
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const settings = require('./app/settings');
const chats = require('./app/chats');
const usage = require('./app/usage');
const agent = require('./app/agent');
const ollama = require('./app/ollama');
const backups = require('./app/backups');
const { APP_DIR } = require('./app/util');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600,
    title: 'Xile AI', backgroundColor: '#1c1b1a', autoHideMenuBar: true,
    icon: path.join(APP_DIR, 'icon.png'),
    webPreferences: { preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenu(null);
  win.loadFile(path.join(APP_DIR, 'ui', 'index.html'));
  // Ctrl+R reloads the window (after changing files in ui/). F12 opens developer tools.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.key.toLowerCase() === 'r') { win.webContents.reload(); e.preventDefault(); }
    if (input.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

const forWindow = (c) => ({ id: c.id, title: c.title, folder: c.folder, view: c.view, ctx: c.ctx, running: agent.isRunning(c.id) });

// Everything the window can ask for. Each name matches a line in preload.js.
ipcMain.handle('settings:get', () => settings.get());
ipcMain.handle('settings:set', (_e, patch) => settings.set(patch));
ipcMain.handle('models', async () => { try { return { models: await ollama.models() }; } catch (e) { return { error: ollama.friendlyError(e) }; } });
ipcMain.handle('chats:list', () => chats.list(agent.isRunning));
ipcMain.handle('chats:load', (_e, id) => { const c = chats.get(id); return c ? forWindow(c) : null; });
ipcMain.handle('chats:new', (_e, folder) => forWindow(chats.create(folder)));
ipcMain.handle('chats:delete', (_e, id) => { agent.stop(id); chats.remove(id); });
ipcMain.handle('send', (_e, id, text, images = []) => {
  const chat = chats.get(id);
  if (!chat || agent.isRunning(id) || (!text.trim() && !images.length)) return false;
  agent.run(win, chat, text.trim() || 'What is in this picture?', images);
  return true;
});
ipcMain.handle('stop', (_e, id) => agent.stop(id));
ipcMain.handle('approve', (_e, id, decision) => agent.answer(id, decision));
ipcMain.handle('undo', (_e, backupId) => backups.undo(backupId));
ipcMain.handle('folder:pick', async (_e, id) => {
  const chat = chats.get(id);
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: chat?.folder });
  if (r.canceled || !r.filePaths[0]) return null;
  if (chat) chat.folder = r.filePaths[0];
  settings.set({ folder: r.filePaths[0] });
  return r.filePaths[0];
});
ipcMain.handle('usage', () => usage.get());
ipcMain.handle('app:dir', () => APP_DIR);
ipcMain.handle('app:restart', () => { app.relaunch(); app.exit(0); });
ipcMain.handle('open:path', (_e, p) => shell.openPath(p));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
