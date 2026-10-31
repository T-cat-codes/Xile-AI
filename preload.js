// The list of things the window (ui/) may ask the app (main.js) to do, as window.xile.*.
// To add one: add a line here, and an ipcMain.handle with the same name in main.js.
const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke(name, ...args);

contextBridge.exposeInMainWorld('xile', {
  getSettings: call('settings:get'),
  setSettings: call('settings:set'),
  models: call('models'),
  listChats: call('chats:list'),
  loadChat: call('chats:load'),
  newChat: call('chats:new'),
  deleteChat: call('chats:delete'),
  send: call('send'),
  stop: call('stop'),
  approve: call('approve'),
  undo: call('undo'),
  pickFolder: call('folder:pick'),
  usage: call('usage'),
  appDir: call('app:dir'),
  restart: call('app:restart'),
  openPath: call('open:path'),
  onEvent: (cb) => ipcRenderer.on('chat-event', (_e, ev) => cb(ev)),
});
