// The list of every tool the AI can use.
//
// HOW TO ADD A TOOL:
//   1. Open the file in this folder that fits (or copy files.js to make a new one).
//   2. Add an object like this to its list:
//        {
//          name: 'my_tool',                       // lowercase_with_underscores
//          about: 'What it does, for the AI.',
//          inputs: { path: 'File path', count: 'number: How many' },  // "number:" / "boolean:" set the type
//          required: ['path'],
//          permission: 'none',                    // 'none' = never asks, 'edit' = file change, 'action' = asks first
//          run: async (input, ctx) => ({ text: 'what happened' }),   // may also return image (base64 PNG)
//        }
//   3. If it's a new file, add it to GROUPS below. Then click "Restart app".
// Also add an icon and label for it in ui/state.js (TOOL_LABELS).
const GROUPS = [
  require('./files'),
  require('./command'),
  require('./screen'),
  require('./tv'),
  require('./web'), // these have needsInternet: true and switch off with "Allow web browsing"
];

const all = () => GROUPS.flat();
const active = (settings) => all().filter((t) => settings.webAccess || !t.needsInternet);
const find = (name) => all().find((t) => t.name === name);

// The tool list in the format Ollama wants.
function forOllama(settings) {
  return active(settings).map((t) => {
    const properties = {};
    for (const [key, text] of Object.entries(t.inputs || {})) {
      const m = text.match(/^(number|boolean):\s*(.*)$/);
      properties[key] = { type: m ? m[1] : 'string', description: m ? m[2] : text };
    }
    return { type: 'function', function: { name: t.name, description: t.about, parameters: { type: 'object', properties, required: t.required || [] } } };
  });
}

module.exports = { active, find, forOllama };
