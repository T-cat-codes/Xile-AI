// Turns the AI's replies into formatted text: code blocks, headings, lists, bold, italic, links.

function inlineMd(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function renderMarkdown(text) {
  let html = '';
  text.split(/```/).forEach((part, i) => {
    if (i % 2 === 1) { // inside ``` code ```
      const nl = part.indexOf('\n');
      html += `<pre><code>${escapeHtml((nl >= 0 ? part.slice(nl + 1) : part).replace(/\n$/, ''))}</code></pre>`;
      return;
    }
    let list = null;
    let para = [];
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flush = () => { if (para.length) { html += `<p>${para.map(inlineMd).join('<br>')}</p>`; para = []; } };
    for (const line of part.split('\n')) {
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flush(); closeList(); html += `<h${m[1].length + 2}>${inlineMd(m[2])}</h${m[1].length + 2}>`; }
      else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { flush(); if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += `<li>${inlineMd(m[1])}</li>`; }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flush(); if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += `<li>${inlineMd(m[1])}</li>`; }
      else if (!line.trim()) { flush(); closeList(); }
      else { closeList(); para.push(line); }
    }
    flush();
    closeList();
  });
  return html;
}
