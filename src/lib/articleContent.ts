// Article bodies are stored two ways: older ones as HTML, newer ones as Markdown. The page
// injects whatever it is given as HTML, so a Markdown article used to display its own ## and **
// as literal characters. This converts Markdown to HTML and leaves HTML articles untouched.
//
// Deliberately small: headings, bold, italic, links, lists, tables, rules and paragraphs. No
// raw HTML is allowed through from a Markdown body, so a stray < in an article cannot inject
// markup.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s: string) =>
  escapeHtml(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

export function looksLikeHtml(body: string): boolean {
  return /<(p|div|h[1-6]|ul|ol|table|section|article|strong|br)\b/i.test(body.slice(0, 600));
}

export function articleToHtml(body: string): string {
  if (!body) return '';
  if (looksLikeHtml(body)) return body;

  const out: string[] = [];
  let list: string[] | null = null;
  let table: string[][] | null = null;

  const closeList = () => { if (list) { out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`); list = null; } };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push(
      `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    );
    table = null;
  };
  const closeAll = () => { closeList(); closeTable(); };

  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();

    if (!line) { closeAll(); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { closeAll(); out.push('<hr />'); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { closeAll(); // ## becomes h2: the page heading is the h1, so article sections sit directly under it.
      const n = Math.min(Math.max(heading[1].length, 2), 6); out.push(`<h${n}>${inline(heading[2])}</h${n}>`); continue; }

    if (/^\|.*\|$/.test(line)) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // the separator row
      closeList();
      (table ||= []).push(cells);
      continue;
    }
    closeTable();

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) { (list ||= []).push(bullet[1]); continue; }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) { (list ||= []).push(numbered[1]); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeAll();
  return out.join('\n');
}
