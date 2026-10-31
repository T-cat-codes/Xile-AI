// Tools for seeing and using the PC screen: screenshot, click, type_text, press_keys, scroll, wait.
// The real work happens in screen.ps1 (next to this file). Positions are 0-1000 across and down.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { sleep } = require('../util');

const SHOT_FILE = path.join(os.tmpdir(), 'xile-screen.png');

function helper(action, params = {}, text = '') {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'screen.ps1'), '-Action', action];
    for (const [k, v] of Object.entries(params)) args.push(`-${k}`, String(v));
    const p = spawn('powershell.exe', args, { windowsHide: true, env: { ...process.env, XILE_TEXT: text } });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || 'screen helper failed'))));
  });
}

// Xile hides its own window while it uses the screen, so it doesn't click itself.
async function hideXile(ctx) {
  if (ctx.run.hid || ctx.win.isDestroyed() || ctx.win.isMinimized()) return;
  ctx.win.minimize();
  ctx.run.hid = true;
  await sleep(500);
}

async function screenshot(ctx) {
  await hideXile(ctx);
  const info = JSON.parse(await helper('screenshot', { Out: SHOT_FILE }));
  return { text: `Screenshot of the ${info.screenW}x${info.screenH} screen. Use 0-1000 coordinates.`, image: fs.readFileSync(SHOT_FILE).toString('base64') };
}

// Does an action, waits a moment, then returns a fresh screenshot so the AI sees the result.
async function act(ctx, what, doIt) {
  await hideXile(ctx);
  await doIt();
  await sleep(800);
  const shot = await screenshot(ctx);
  return { text: `${what}. New screenshot attached.`, image: shot.image };
}

module.exports = [
  {
    name: 'screenshot',
    about: 'Look at the PC screen. Returns a picture; positions use 0-1000 coordinates.',
    permission: 'none',
    run: (a, ctx) => screenshot(ctx),
  },
  {
    name: 'click',
    about: 'Click on the PC screen at x,y in 0-1000 coordinates (0,0 = top-left, 1000,1000 = bottom-right).',
    inputs: { x: 'number: 0-1000 from the left', y: 'number: 0-1000 from the top', button: 'left (default), right or middle', double: 'boolean: Double-click' },
    required: ['x', 'y'],
    permission: 'action',
    run: (a, ctx) => act(ctx, `Clicked at ${a.x}, ${a.y}`, () => helper('click', { X: a.x, Y: a.y, Button: a.button || 'left', Clicks: a.double ? 2 : 1 })),
  },
  {
    name: 'type_text',
    about: 'Type text with the keyboard into whatever has focus. A new line presses Enter.',
    inputs: { text: 'Text to type' },
    required: ['text'],
    permission: 'action',
    run: (a, ctx) => act(ctx, 'Typed the text', () => helper('type', {}, a.text)),
  },
  {
    name: 'press_keys',
    about: 'Press a key or shortcut, like "enter", "ctrl+s", "alt+tab", "win", "ctrl+shift+esc".',
    inputs: { keys: 'Keys joined with +' },
    required: ['keys'],
    permission: 'action',
    run: (a, ctx) => act(ctx, `Pressed ${a.keys}`, () => helper('keys', { Keys: a.keys })),
  },
  {
    name: 'scroll',
    about: 'Scroll the mouse wheel at x,y (0-1000 coordinates).',
    inputs: { x: 'number: 0-1000', y: 'number: 0-1000', direction: 'up or down', amount: 'number: Wheel clicks, default 5' },
    required: ['direction'],
    permission: 'action',
    run: (a, ctx) => act(ctx, `Scrolled ${a.direction}`, () => helper('scroll', { X: a.x ?? 500, Y: a.y ?? 500, Direction: a.direction || 'down', Amount: a.amount || 5 })),
  },
  {
    name: 'wait',
    about: 'Wait for something to load.',
    inputs: { seconds: 'number: 1 to 30' },
    required: ['seconds'],
    permission: 'none',
    run: async (a) => { await sleep(Math.min(Math.max(Number(a.seconds) || 2, 1), 30) * 1000); return { text: 'Done waiting.' }; },
  },
];
