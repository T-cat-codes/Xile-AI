// Tool for running PowerShell commands.
const { spawn } = require('child_process');
const { clip } = require('../util');

const killTree = (pid) => spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });

module.exports = [
  {
    name: 'run_command',
    about: 'Run a Windows PowerShell command in the working folder and get its output.',
    inputs: { command: 'PowerShell command', timeout_seconds: 'number: Stop after this many seconds, default 120' },
    required: ['command'],
    permission: 'action',
    run: (a, ctx) => new Promise((resolve) => {
      const seconds = Math.min(Number(a.timeout_seconds) || 120, 1800);
      // -EncodedCommand avoids every problem with quotes in the command.
      const encoded = Buffer.from(String(a.command), 'utf16le').toString('base64');
      const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { cwd: ctx.chat.folder, windowsHide: true });
      ctx.run.proc = p;
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { out += d; });
      const timer = setTimeout(() => { out += `\n(stopped after ${seconds} seconds)`; killTree(p.pid); }, seconds * 1000);
      p.on('error', (e) => { clearTimeout(timer); ctx.run.proc = null; resolve({ text: `Error: ${e.message}`, error: true }); });
      p.on('close', (code) => { clearTimeout(timer); ctx.run.proc = null; resolve({ text: `exit code ${code}\n${clip(out.trim() || '(no output)')}`, error: code !== 0 }); });
    }),
  },
];

module.exports.killTree = killTree;
