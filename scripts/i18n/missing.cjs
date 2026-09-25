// Lists portal strings that have no Spanish yet.
//
// The portals are translated by src/i18n/domTranslator.ts from src/i18n/es.json. New English
// in the portals shows in English until it is added there. To add it:
//   node scripts/i18n/missing.cjs > missing.json     (strings and templates with no entry)
//   translate them, then add to es.json under "strings" (plain text) or "templates"
//   ({0}, {1} for the dynamic parts, e.g. "Sent {0} by {1}.").
// Write whole sentences in code (`${n} things need you`, not `thing${s}`) so they can be
// translated as sentences.
const { execFileSync } = require('child_process');
const path = require('path');
const out = JSON.parse(execFileSync('node', [path.join(__dirname, 'extract.cjs')], { maxBuffer: 64 << 20 }).toString());
const es = require(path.join(__dirname, '../../src/i18n/es.json'));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const missing = {
  strings: out.strings.filter((s) => !(norm(s) in es.strings)),
  templates: out.templates.filter((s) => !(norm(s) in es.templates) && !/[A-Za-z]\{\d+\}/.test(s)),
};
process.stdout.write(JSON.stringify(missing, null, 1) + '\n');
process.stderr.write(`${missing.strings.length} strings and ${missing.templates.length} templates without Spanish (many are names, codes or CSS that need none).\n`);
