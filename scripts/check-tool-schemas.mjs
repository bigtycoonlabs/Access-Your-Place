// Guards the OpenAI tool-schema limits that silently 400 the whole tools payload.
//
// A single over-long description does not fail one tool -- it rejects the ENTIRE request,
// which drops Penny to her no-tools fallback. She then says "the tools are unavailable",
// which reads to a person like the platform is broken. That is exactly what happened:
// record_closing carried a 1,049-character description against a 1,024 limit.
//
// Nothing caught it. tsc, deno check and esbuild all pass on a string that is 25 characters
// too long, because it is perfectly valid TypeScript.
import { readFileSync } from 'node:fs';

const LIMITS = { description: 1024, name: 64, tools: 128 };
const src = readFileSync('supabase/functions/penny-staff-chat/index.ts', 'utf8');

const start = src.indexOf('const TOOLS');
let depth = 0, end = start;
for (let i = src.indexOf('[', start); i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const arr = src.slice(start, end);

const blocks = arr.split(/\n {2}\{\n {4}type: 'function',/);
const problems = [];
let count = 0;

for (const b of blocks) {
  const name = b.match(/name: '([a-z_]+)'/)?.[1];
  if (!name) continue;
  count++;
  if (name.length > LIMITS.name) problems.push(`${name}: name is ${name.length} chars (max ${LIMITS.name})`);
  const desc = b.match(/description:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  if (desc && desc.length > LIMITS.description) {
    problems.push(`${name}: description is ${desc.length} chars (max ${LIMITS.description})`);
  }
}

if (count > LIMITS.tools) problems.push(`${count} tools declared (max ${LIMITS.tools})`);

if (problems.length) {
  console.error('TOOL SCHEMA VIOLATIONS -- these reject the whole tools payload:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`tool schemas ok: ${count} tools, all within limits`);
