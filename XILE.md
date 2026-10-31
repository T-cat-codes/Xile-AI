# Xile AI: map of this app

Xile AI is the user's own desktop AI app (Electron + plain JavaScript, no frameworks).
It runs AI models with Ollama on this PC. Every file is small and does one job.

## I want to change... → edit this file

| Want to change | File |
|---|---|
| Colors, fonts, text size, rounded corners | `ui/theme.css` |
| Look of the left sidebar (chat list) | `ui/sidebar.css` |
| Look of messages, tool steps, Yes/No questions | `ui/chat.css` |
| Look of the chat box, + button, send button | `ui/composer.css` |
| Look of the right panel cards | `ui/panel.css` |
| Where things are on screen (add/move buttons, text) | `ui/index.html` |
| What sidebar buttons do (New chat, chat list, Edit Xile AI itself) | `ui/sidebar.js` |
| How messages and tool steps show up | `ui/chat.js` |
| Sending, pictures (paste / drag / +), model picker | `ui/composer.js` |
| Right panel (folder, context bar, usage, settings) | `ui/panel.js` |
| Starter buttons on a new chat, tool icons and labels | `ui/state.js` |
| What the AI is told (its rules, personality) | `app/prompt.js` |
| Settings and their defaults | `app/settings.js` |
| File tools (read, edit, replace_lines, write, search) | `app/tools/files.js` |
| PowerShell command tool | `app/tools/command.js` |
| Screen tools (screenshot, click, type, keys, scroll) | `app/tools/screen.js` + `app/tools/screen.ps1` |
| TV tools (tv_connect, adb, tv_screenshot) | `app/tools/tv.js` |
| Web tools (web_search, read_webpage) | `app/tools/web.js` |
| Add a brand-new tool | instructions at the top of `app/tools/index.js` |
| The agent loop (steps, permissions, stuck check) | `app/agent.js` |
| Talking to Ollama | `app/ollama.js` |
| Saving chats / usage numbers / undo backups | `app/chats.js` / `app/usage.js` / `app/backups.js` |
| Connecting a window button to the app | `preload.js` (one line) + `main.js` (one `ipcMain.handle`) |

## After a change
- Changed something in `ui/` → user clicks **Reload window** (or presses Ctrl+R).
- Changed something in `app/`, `main.js` or `preload.js` → user clicks **Restart app**.

## Rules
- One small change at a time. Read the file first, then use replace_lines with the line numbers.
- Keep the style of the code around it. Each file has a comment at the top saying what it does.
- Every file change has an Undo button in the chat (copies are kept in `%APPDATA%\xile-ai\backups`).
- Never delete the user's chats or settings (they're in `%APPDATA%\xile-ai`, not in this folder).
- Don't touch `node_modules/` (downloaded parts) or `scripts/` (setup) unless asked.

## Other folders
- `scripts/setup.ps1` (run by `Setup Xile AI.cmd`): installs Electron, makes the icon and shortcuts.
- `scripts/restart.ps1`: closes and reopens Xile AI. `scripts/find-adb.ps1`: checks the TV link.
- `icon.png` / `icon.ico`: the app icon. To use your own: replace icon.png, delete icon.ico, run setup.
