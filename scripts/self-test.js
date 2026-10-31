// Checks that the tools really work: TV, web, and file edits the way small models write them.
// Run: node_modules\electron\dist\electron.exe scripts\self-test.js
// Results (PASS/FAIL lines) go to scripts\self-test.log, since Electron can't print to a terminal on Windows.
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.on('window-all-closed', () => {}); // the web tools' hidden windows closing must not end the test
app.whenReady().then(async () => {
  const tools = require('../app/tools');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'xile-test-'));
  const ctx = { chat: { folder }, run: { proc: null }, win: null };
  const call = async (name, args) => {
    try { return await tools.find(name).run(args, ctx); } catch (e) { return { text: `Error: ${e.message}`, error: true }; }
  };
  const log = path.join(__dirname, 'self-test.log');
  fs.writeFileSync(log, '');
  const check = (label, ok, detail) => fs.appendFileSync(log, `${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` - ${String(detail).split('\n')[0].slice(0, 150)}` : ''}\n`);

  // Files: the exact mistake small models make (copying "35| " line numbers into old_text).
  fs.writeFileSync(path.join(folder, 'a.html'), '<div>\r\n    <button id="x">Hi</button>\r\n    <p>text</p>\r\n</div>\r\n');
  let r = await call('edit_file', { path: 'a.html', old_text: '2|     <button id="x">Hi</button>', new_text: '2|     <button id="x">Hello</button>' });
  check('edit_file with copied line numbers', !r.error && fs.readFileSync(path.join(folder, 'a.html'), 'utf8').includes('<button id="x">Hello</button>\r\n'), r.text);
  r = await call('edit_file', { path: 'a.html', old_text: '<p>text</p>', new_text: '<p>new</p>' });
  check('edit_file ignoring indentation', !r.error && fs.readFileSync(path.join(folder, 'a.html'), 'utf8').includes('    <p>new</p>'), r.text);
  r = await call('replace_lines', { path: 'a.html', start_line: 3, end_line: 3, new_text: '3|     <p>by line</p>' });
  check('replace_lines', !r.error && fs.readFileSync(path.join(folder, 'a.html'), 'utf8').split('\r\n')[2] === '    <p>by line</p>', r.text);
  r = await call('edit_file', { path: 'a.html', old_text: 'nothing like this', new_text: 'x' });
  check('edit_file not found gives a hint', r.error && /replace_lines/.test(r.text), r.text);

  // TV
  r = await call('tv_connect', {});
  check('tv_connect', !r.error, r.text);
  r = await call('adb', { args: 'shell getprop ro.build.version.release' });
  check('adb command', !r.error, r.text.replace('\n', ' '));
  r = await call('tv_screenshot', {});
  check('tv_screenshot', !r.error && ((r.image && r.image.length > 1000) || /asleep/.test(r.text)), `${r.text} (${r.image ? Math.round(r.image.length / 1024) : 0} KB)`);

  // Web
  r = await call('web_search', { query: 'Chromecast with Google TV' });
  check('web_search', !r.error, r.text);
  r = await call('read_webpage', { url: 'https://example.com' });
  check('read_webpage example.com', !r.error && /Example Domain/.test(r.text), r.text);
  r = await call('read_webpage', { url: 'https://en.wikipedia.org/wiki/Chromecast' });
  check('read_webpage wikipedia', !r.error && /Chromecast/.test(r.text), `${r.text.length} characters`);

  app.quit();
});
