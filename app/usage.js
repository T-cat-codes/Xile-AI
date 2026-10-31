// Counts tokens, replies and time for the Usage card. Saved in %APPDATA%\xile-ai\usage.json.
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('./util');

const FILE = path.join(DATA_DIR, 'usage.json');
const today = () => new Date().toLocaleDateString('en-CA');
const empty = () => ({ in: 0, out: 0, requests: 0, seconds: 0 });

function add(inTokens, outTokens, seconds) {
  const u = readJson(FILE, { days: {}, total: empty() });
  const day = (u.days[today()] ||= empty());
  for (const t of [day, u.total]) { t.in += inTokens; t.out += outTokens; t.requests += 1; t.seconds += seconds; }
  writeJson(FILE, u);
}

function get() {
  const u = readJson(FILE, { days: {}, total: empty() });
  return { today: u.days[today()] || empty(), total: u.total };
}

module.exports = { add, get };
