// Tools for the internet: web_search and read_webpage. They switch off with "Allow web browsing".
// Pages load in a hidden browser window, so sites that need JavaScript work too.
const { BrowserWindow } = require('electron');
const { sleep, clip } = require('../util');

async function withPage(url, script, timeoutMs = 25000) {
  const w = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: 'persist:xile-web', images: false } });
  const userAgent = w.webContents.getUserAgent().replace(/ (Electron|xile-ai)\/\S+/g, '');
  try {
    const load = w.loadURL(url, { userAgent }).catch((e) => { if (!/ERR_ABORTED/.test(e.message)) throw e; });
    await Promise.race([load, sleep(timeoutMs).then(() => { throw new Error('The page took too long to load.'); })]);
    await sleep(1500);
    return await w.webContents.executeJavaScript(script);
  } finally {
    w.destroy();
  }
}

// Backup way to read a page when the hidden window can't: download the HTML and strip the tags.
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36' } });
  const html = await res.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const text = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');
  return { title: title.trim(), text: text.trim() };
}

module.exports = [
  {
    name: 'web_search',
    about: 'Search the internet. Returns titles, links and short snippets.',
    inputs: { query: 'What to search for' },
    required: ['query'],
    permission: 'none',
    needsInternet: true,
    run: async (a) => {
      const results = await withPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(a.query)}`, `
        [...document.querySelectorAll('.result')].slice(0, 8).map((r) => {
          const link = r.querySelector('a.result__a');
          if (!link) return null;
          let href = link.href;
          try { href = new URL(href).searchParams.get('uddg') || href; } catch {}
          return { title: link.innerText.trim(), url: href, snippet: (r.querySelector('.result__snippet')?.innerText || '').trim() };
        }).filter(Boolean)`);
      if (!results.length) return { text: 'No results (or the search site blocked the request). Try other words.', error: true };
      return { text: results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n') };
    },
  },
  {
    name: 'read_webpage',
    about: 'Open a web page and get its text.',
    inputs: { url: 'Full address starting with http' },
    required: ['url'],
    permission: 'none',
    needsInternet: true,
    run: async (a) => {
      if (!/^https?:\/\//i.test(a.url)) throw new Error('The address must start with http:// or https://');
      let page;
      try {
        page = await withPage(a.url, '({ title: document.title, text: document.body ? document.body.innerText : "" })');
        if (!page.text.trim()) throw new Error('empty page');
      } catch {
        page = await fetchText(a.url);
      }
      return { text: clip(`${page.title}\n${a.url}\n\n${page.text.replace(/\n{3,}/g, '\n\n')}`, 16000) };
    },
  },
];
