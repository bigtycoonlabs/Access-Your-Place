// Extracts user-facing English strings from the portal source for the Spanish dictionary.
// Usage: node scripts/i18n/extract.cjs > strings.json
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOTS = [
  'src/pages/InvestorPortal.tsx', 'src/pages/InvestorLogin.tsx', 'src/pages/InvestorResetPassword.tsx',
  'src/pages/LandlordPortal.tsx', 'src/pages/LandlordLogin.tsx', 'src/pages/LandlordResetPassword.tsx',
  'src/pages/StaffWorkspace.tsx', 'src/pages/StaffLogin.tsx', 'src/pages/StaffResetPassword.tsx',
  'src/pages/ProPortal.tsx',
  'src/components/investor', 'src/components/landlord', 'src/components/staff',
  // Site chrome shown around the sign-in pages.
  // Messages the landlord and sign-in functions send back, which the portals display.
  'supabase/functions/manage-landlord-portal/index.ts', 'supabase/functions/landlord-auth/index.ts',
  'supabase/functions/staff-login/index.ts',
  'src/components/Header.tsx', 'src/components/Footer.tsx', 'src/components/SkipLinks.tsx',
];
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'description']);
const PROPS = new Set(['error', 'note', 'label', 'title', 'description', 'desc', 'does', 'hint', 'text', 'message', 'placeholder', 'name', 'subtitle', 'heading', 'cta', 'tooltip', 'helper', 'empty', 'note']);

// `cond && 'Text'` and `err || 'Text'` show the text; `x === 'Text'` only compares with it.
const isFallbackOp = (b) => [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(b.operatorToken.kind);
const files = [];
for (const r of ROOTS) {
  if (!fs.existsSync(r)) continue;
  if (fs.statSync(r).isDirectory()) {
    for (const f of fs.readdirSync(r)) if (/\.tsx?$/.test(f)) files.push(path.join(r, f));
  } else files.push(r);
}

const out = new Map(); // text -> Set(files)
const templates = new Map();
const looksEnglish = (s) => /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_.\-/]+$/.test(s) && !/^(https?:|\/|#|@|bg-|text-|flex|w-|h-|p-|m-)/.test(s) && !/[{}<>;=]/.test(s);
const add = (s, f) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 600 || !looksEnglish(s)) return;
  if (!out.has(s)) out.set(s, new Set());
  out.get(s).add(f);
};
const addTemplate = (node, f) => {
  // `Logged in as ${name}` -> "Logged in as {0}"
  let i = 0;
  let s = node.head.text;
  for (const span of node.templateSpans) s += `{${i++}}` + span.literal.text;
  s = s.replace(/\s+/g, ' ').trim();
  if (!looksEnglish(s.replace(/\{\d+\}/g, ''))) return;
  if (s.replace(/\{\d+\}/g, '').trim().length < 3) return;
  if (!templates.has(s)) templates.set(s, new Set());
  templates.get(s).add(f);
};

for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n) => {
    if (ts.isJsxText(n)) add(n.text, f);
    else if (ts.isJsxAttribute(n) && n.initializer && ATTRS.has(n.name.getText())) {
      const init = n.initializer;
      if (ts.isStringLiteral(init)) add(init.text, f);
      else if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text, f);
      }
    } else if (ts.isJsxExpression(n) && n.expression) {
      const e = n.expression;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text, f);
      if (ts.isTemplateExpression(e)) addTemplate(e, f);
      if (ts.isConditionalExpression(e)) for (const b of [e.whenTrue, e.whenFalse]) {
        if (ts.isStringLiteral(b) || ts.isNoSubstitutionTemplateLiteral(b)) add(b.text, f);
        if (ts.isTemplateExpression(b)) addTemplate(b, f);
      }
    } else if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && PROPS.has(n.name.text)) {
      const e = n.initializer;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text, f);
      if (ts.isTemplateExpression(e)) addTemplate(e, f);
    } else if (ts.isStringLiteral(n) && n.parent && !(ts.isBinaryExpression(n.parent) && !isFallbackOp(n.parent))
      && /^[A-Z0-9][^]*[a-z]/.test(n.text) && / /.test(n.text) && !/^[0-9][0-9a-z]* /.test(n.text.replace(/^1 [a-z]/, "x")) && !ts.isImportDeclaration(n.parent)
      && !(ts.isCallExpression(n.parent) && /^(invoke|from|select|rpc|getItem|setItem|removeItem|eq|order|includes|get|test|match|replace|split|querySelector|getElementById|log|error|warn|info)$/.test(n.parent.expression.getText().split('.').pop()))) {
      // Sentence-like string anywhere else (toast text, error messages, ternaries in variables).
      add(n.text, f);
    } else if (ts.isTemplateExpression(n) && n.parent && !ts.isJsxExpression(n.parent) && (/^[A-Z]/.test(n.head.text) || (n.head.text === '' && /^ [a-z]+ [a-z]/.test(n.templateSpans[0].literal.text))) && / /.test(n.head.text + n.templateSpans.map(s => s.literal.text).join(''))) {
      addTemplate(n, f);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}

const result = {
  files: files.length,
  strings: [...out.keys()].sort(),
  templates: [...templates.keys()].sort(),
};
process.stdout.write(JSON.stringify(result, null, 1));
