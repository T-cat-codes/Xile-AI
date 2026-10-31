// Tools for the TV (Chromecast with Google TV) over adb Wireless debugging:
// tv_connect, tv_pair, adb, tv_screenshot. The TV is found on the network by itself.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { nativeImage } = require('electron');
const { clip } = require('../util');
const { killTree } = require('./command');

let serial = null; // the connected TV, like "192.168.1.102:40633"

// adb.exe comes with the TV Home build tools.
function adbPath() {
  const local = process.env.LOCALAPPDATA || '';
  const found = [
    path.join(local, 'TVHomeTools', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(local, 'Android', 'platform-tools', 'adb.exe'),
  ].find((p) => fs.existsSync(p));
  if (!found) throw new Error('adb.exe was not found. Run "1 - Install Android SDK parts.cmd" in the TV Home folder.');
  return found;
}

function adb(args, ctx, { binary = false, timeoutSec = 120 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(adbPath(), args, { cwd: ctx.chat.folder, windowsHide: true });
    ctx.run.proc = p;
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => killTree(p.pid), timeoutSec * 1000);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      ctx.run.proc = null;
      const buf = Buffer.concat(out);
      resolve({ code, out: binary ? buf : buf.toString(), err });
    });
  });
}

// Splits 'shell echo "a b"' into ['shell', 'echo', 'a b'].
const splitArgs = (s) => (String(s).match(/"[^"]*"|'[^']*'|\S+/g) || []).map((a) => a.replace(/^["']|["']$/g, ''));

// Uses a TV that's already connected, or finds it on the network (its port changes after
// every TV restart) and connects.
async function connect(ctx) {
  const listed = await adb(['devices'], ctx);
  const ready = listed.out.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).filter(([, state]) => state === 'device').map(([s]) => s);
  let found = ready.find((s) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(s)) || ready[0];
  if (!found) {
    const mdns = await adb(['mdns', 'services'], ctx);
    const m = mdns.out.match(/_adb-tls-connect\._tcp\s+(\d+\.\d+\.\d+\.\d+:\d+)/);
    if (!m) {
      return { text: 'No TV found. Ask the user to open on the TV: Settings → System → Developer options → Wireless debugging, and turn it on. If it was never paired, they pick "Pair device with pairing code" and tell you the address and code for tv_pair.', error: true };
    }
    const c = await adb(['connect', m[1]], ctx);
    if (!/connected to/i.test(c.out)) return { text: `Could not connect: ${(c.out + c.err).trim()}. The TV may need pairing (tv_pair).`, error: true };
    found = m[1];
  }
  serial = found;
  const model = (await adb(['-s', serial, 'shell', 'getprop', 'ro.product.model'], ctx)).out.trim();
  return { text: `Connected to the TV: ${model || 'Android TV'} (${serial}).` };
}

async function ensureConnected(ctx) {
  if (serial) return null;
  const c = await connect(ctx);
  return c.error ? c : null;
}

module.exports = [
  {
    name: 'tv_connect',
    about: 'Connect to the TV over Wireless debugging. It finds the TV by itself. Call this before other TV tools.',
    permission: 'none',
    run: (a, ctx) => connect(ctx),
  },
  {
    name: 'tv_pair',
    about: 'Pair with the TV, only when tv_connect says pairing is needed. The user reads the address and code off the TV screen.',
    inputs: { address: 'ip:port shown under "Pair device with pairing code"', code: '6-digit pairing code' },
    required: ['address', 'code'],
    permission: 'action',
    run: async (a, ctx) => {
      const r = await adb(['pair', a.address, String(a.code)], ctx);
      return { text: (r.out + r.err).trim() || 'No answer from the TV.', error: !/success/i.test(r.out) };
    },
  },
  {
    name: 'adb',
    about: 'Run an adb command on the TV, e.g. "shell input keyevent KEYCODE_HOME", "shell pm list packages -3", "install -r output\\TVHome.apk", "logcat -d -t 200".',
    inputs: { args: 'Everything after "adb"' },
    required: ['args'],
    permission: 'action',
    run: async (a, ctx) => {
      const problem = await ensureConnected(ctx);
      if (problem) return problem;
      const r = await adb(['-s', serial, ...splitArgs(a.args)], ctx, { timeoutSec: 300 });
      if (/not found|offline/i.test(r.err)) serial = null; // TV restarted; reconnect next time
      return { text: `exit code ${r.code}\n${clip(`${r.out}${r.err}`.trim() || '(no output)')}`, error: r.code !== 0 };
    },
  },
  {
    name: 'tv_screenshot',
    about: 'See what is on the TV screen right now.',
    permission: 'none',
    run: async (a, ctx) => {
      const problem = await ensureConnected(ctx);
      if (problem) return problem;
      // An asleep TV only gives a black picture, so say that instead.
      const power = await adb(['-s', serial, 'shell', 'dumpsys power | grep mWakefulness='], ctx);
      if (/Asleep|Dozing/.test(power.out)) {
        return { text: 'The TV is asleep (screen off). To wake it, use adb "shell input keyevent KEYCODE_WAKEUP" (ask the user first), then take the screenshot again.' };
      }
      const r = await adb(['-s', serial, 'exec-out', 'screencap', '-p'], ctx, { binary: true });
      const img = nativeImage.createFromBuffer(r.out);
      if (img.isEmpty()) { serial = null; return { text: `Could not get the TV picture. ${r.err.trim()}`, error: true }; }
      const small = img.getSize().width > 1280 ? img.resize({ width: 1280 }) : img;
      return { text: 'Screenshot of the TV screen. (If it is all black, the TV is playing protected video, which Android hides from screenshots.)', image: small.toPNG().toString('base64') };
    },
  },
];
