// Merges translated chunks into src/i18n/es.json and checks them.
// Usage: node scripts/i18n/merge.cjs <dir with strings.json and es0..esN.json>
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const src = JSON.parse(fs.readFileSync(path.join(dir, 'strings.json'), 'utf8'));
const merged = {};
for (const f of fs.readdirSync(dir).filter((f) => /^es\d+\.json$/.test(f)).sort()) {
  Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
// Reviewer corrections win over first drafts.
for (const f of fs.readdirSync(dir).filter((f) => /^fix\d+\.json$/.test(f)).sort()) {
  Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
const KEEP_ENGLISH = new Set(['BA', 'BR', 'BR /', 'BD', 'sqft', 'sq ft', 'mo', '/mo']);
const ph = (s) => [...new Set(s.match(/\{\d+\}/g) || [])].sort().join(',');
const problems = [];
const out = { strings: {}, templates: {} };
for (const [kind, list] of [['strings', src.strings], ['templates', src.templates]]) {
  for (const en of list) {
    const es = merged[en];
    if (typeof es !== 'string' || !es.trim()) { problems.push(`missing: ${en}`); continue; }
    if (kind === 'templates' && ph(en) !== ph(es)) { problems.push(`placeholders: ${en} -> ${es}`); continue; }
    if (es === en) continue; // unchanged (names, codes): no entry needed
    // A placeholder glued to a word ("document{1}") carries an English plural ending, which no
    // Spanish sentence can absorb. Those stay English until the code passes a plain count.
    if (kind === 'templates' && /[A-Za-z]\{\d+\}/.test(en)) continue;
    // Unit abbreviations sit right after a number ("3BR"); a Spanish word there reads "3hab.".
    if (KEEP_ENGLISH.has(en.trim())) continue;
    out[kind][en.replace(/\s+/g, ' ').trim()] = es.trim();
  }
}
fs.writeFileSync('src/i18n/es.json', JSON.stringify(out, null, 0) + '\n');
console.log(`strings ${Object.keys(out.strings).length}, templates ${Object.keys(out.templates).length}, problems ${problems.length}`);
if (problems.length) { console.log(problems.slice(0, 30).join('\n')); process.exitCode = 1; }
