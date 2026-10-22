// Outil de traduction : enveloppe les textes français visibles de l'appli dans tr(…) (idempotent).
// Usage : node scripts/i18n-wrap.cjs [--write]   puis   node scripts/i18n-keys.cjs   pour lister les textes à traduire.
// Ne touche pas aux textes en arabe (dhikr, invocations), aux routes, identifiants, URL ni au logo « nissali ».
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const { parse } = require(path.join(root, 'node_modules/@babel/parser'));

const SRC = path.join(root, 'src');
const I18N = path.join(SRC, 'lib/i18n.js');
const SKIP_FILES = new Set([I18N, path.join(SRC, 'lib/format.js')]);
const ATTR_RE = /(label|title|hint|placeholder|message|subtitle|description|caption|^text$|^what$|^unit$|^suffix$|^sub$|^empty$|Label$|Hint$|Text$)/;
const KEYS = new Set(['label', 'title', 'subtitle', 'sub', 'hint', 'text', 'placeholder', 'description', 'note', 'body', 'detail', 'big', 'what', 'empty', 'cta', 'button', 'question', 'answer', 'error', 'info', 'tagline', 'heading', 'help', 'section', 'name']);
const CALLS = new Set(['toast', 'confirm', 'ask', 'confirmAction', 'askConfirm', 'notify', 'setError', 'patch', 'patchSettings', 'run', 'save', 'setInfo', 'setMessage', 'fail']);
const BRAND = new Set(['nissali', 'Nissali', 'NissaPlace', 'Français', 'English']);

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const letters = (s) => (s.match(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]/g) || []).length;
function translatable(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (letters(v) < 2 || ARABIC.test(v) || BRAND.has(v)) return false;
  if (/^(\/|https?:|mailto:|tel:|#|\.)/.test(v)) return false;
  if (/^[MLHVCSQTAZmlhvcsqtaz][MLHVCSQTAZmlhvcsqtaz\d\s.,\-{}]*$/.test(v)) return false; // tracés SVG
  if (/^[a-z0-9_.\-/:]+$/.test(v)) return false;
  if (/^[A-Z0-9_:\-]+$/.test(v) && !/\s/.test(v) && v.length <= 4) return false;
  if (!/\s/.test(v) && /_/.test(v)) return false;
  if (/^[A-Za-z]+\.[A-Za-z.]+$/.test(v)) return false;
  if (/^[?&]|=|@/.test(v)) return false;
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(v)) return false;
  if (/^[a-z0-9{}_\-]+$/.test(v)) return false;
  return true;
}
const prose = (s) => translatable(s) && (/\s/.test(s.trim()) || /^[A-ZÀ-Ý]/.test(s.trim()));

function listFiles(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) listFiles(p, out);
    else if (/\.(jsx?)$/.test(f) && !SKIP_FILES.has(p) && !p.includes(`${path.sep}i18n${path.sep}`)) out.push(p);
  }
  return out;
}

let files = 0;
let total = 0;
for (const file of listFiles(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const edits = [];
  const text = (n) => src.slice(n.start, n.end);
  function code(n) {
    if (!n) return '';
    if (n.type === 'StringLiteral' && translatable(n.value)) return `tr(${JSON.stringify(n.value)})`;
    if (n.type === 'TemplateLiteral') {
      const key = n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? `{${i}}` : '')).join('');
      const plain = n.quasis.map((q) => q.value.cooked).join(' ');
      if (!translatable(plain)) {
        let out = '`';
        n.quasis.forEach((q, i) => {
          out += q.value.raw;
          if (i < n.expressions.length) out += '${' + code(n.expressions[i]) + '}';
        });
        return out + '`';
      }
      return n.expressions.length ? `tr(${JSON.stringify(key)}, [${n.expressions.map(code).join(', ')}])` : `tr(${JSON.stringify(key)})`;
    }
    if (n.type === 'ConditionalExpression') {
      const c = code(n.consequent);
      const a = code(n.alternate);
      if (c === text(n.consequent) && a === text(n.alternate)) return text(n);
      return `(${text(n.test)} ? ${c} : ${a})`;
    }
    if (n.type === 'LogicalExpression') {
      const r = code(n.right);
      const l = n.operator === '&&' ? text(n.left) : code(n.left);
      if (r === text(n.right) && l === text(n.left)) return text(n);
      return `(${l} ${n.operator} ${r})`;
    }
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'plural' && n.arguments[1]?.type === 'StringLiteral' && translatable(n.arguments[1].value)) {
      return `plural(${text(n.arguments[0])}, tr(${JSON.stringify(n.arguments[1].value)})${n.arguments.slice(2).map((a) => `, ${text(a)}`).join('')})`;
    }
    return text(n);
  }
  const done = new Set();
  function replace(n) {
    if (!n || done.has(n)) return;
    if (n.type === 'ConditionalExpression') return void (replace(n.consequent), replace(n.alternate));
    if (n.type === 'LogicalExpression') return void (replace(n.right), n.operator !== '&&' && replace(n.left));
    if (n.type === 'ParenthesizedExpression') return replace(n.expression);
    if (!['StringLiteral', 'TemplateLiteral', 'CallExpression'].includes(n.type)) return;
    if (n.type === 'CallExpression' && !(n.callee.type === 'Identifier' && n.callee.name === 'plural')) return;
    const out = code(n);
    if (out !== text(n)) {
      edits.push({ start: n.start, end: n.end, out });
      done.add(n);
    }
  }
  const excluded = new Set();
  function walk(node, parent) {
    if (!node || typeof node.type !== 'string' || done.has(node)) return;
    switch (node.type) {
      case 'CallExpression': {
        const c = node.callee;
        if (c.type === 'Identifier' && c.name === 'tr') return; // déjà traduit
        const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? `${c.object.name || ''}.${c.property.name}` : '';
        if (/^(api|sendOrQueue)\b/.test(name)) for (const a of node.arguments) if (a.type === 'ObjectExpression') excluded.add(a);
        if (CALLS.has(name) || name === 'Alert.alert') node.arguments.slice(0, 2).forEach(replace);
        if (name === 'plural') replace(node);
        break;
      }
      case 'JSXText': {
        const v = node.value;
        if (letters(v) >= 2 && !ARABIC.test(v) && !BRAND.has(v.trim())) {
          const lead = v.match(/^\s*/)[0];
          const trail = v.match(/\s*$/)[0];
          const core = v.trim().replace(/\s*\n\s*/g, ' ');
          edits.push({ start: node.start, end: node.end, out: `${lead}{tr(${JSON.stringify(core)})}${trail}` });
        }
        return;
      }
      case 'JSXAttribute': {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (ATTR_RE.test(name) && node.value) {
          if (node.value.type === 'StringLiteral' && translatable(node.value.value)) {
            edits.push({ start: node.value.start, end: node.value.end, out: `{tr(${JSON.stringify(node.value.value)})}` });
            return;
          }
          if (node.value.type === 'JSXExpressionContainer') replace(node.value.expression);
        }
        break;
      }
      case 'JSXExpressionContainer':
        if (parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) replace(node.expression);
        break;
      case 'NewExpression':
        if (node.callee.type === 'Identifier' && node.callee.name === 'Error' && node.arguments[0]) replace(node.arguments[0]);
        break;
      case 'ObjectProperty': {
        const k = node.key.type === 'Identifier' ? node.key.name : node.key.type === 'StringLiteral' ? node.key.value : '';
        if (KEYS.has(k) && !node.computed && parent && !excluded.has(parent)) {
          if (k === 'name' && !(node.value.type === 'StringLiteral' && prose(node.value.value))) break;
          replace(node.value);
        }
        break;
      }
      case 'ObjectExpression': {
        const props = node.properties;
        if (
          props.length >= 2 &&
          !excluded.has(node) &&
          props.every((p) => p.type === 'ObjectProperty' && !p.computed && p.value.type === 'StringLiteral' && (translatable(p.value.value) || letters(p.value.value) < 2)) &&
          props.some((p) => translatable(p.value.value) && /[A-ZÀ-Ö\s]/.test(p.value.value))
        ) {
          props.forEach((p) => replace(p.value));
        }
        break;
      }
      case 'ReturnStatement':
        replace(node.argument);
        break;
      case 'ArrowFunctionExpression':
        if (node.body && node.body.type !== 'BlockStatement') replace(node.body);
        break;
      case 'VariableDeclarator': {
        const init = node.init;
        if (!init || node.id.type !== 'Identifier') break;
        if (/(label|title|text|message|sub|hint|msg|phrase|summary)$/i.test(node.id.name)) replace(init);
        else if (init.type === 'ConditionalExpression' || init.type === 'LogicalExpression') {
          // const why = cond ? 'ton nifas' : 'tes règles' : on ne traduit que de vraies phrases
          const leaves = [];
          const collect = (n) => (n.type === 'ConditionalExpression' ? (collect(n.consequent), collect(n.alternate)) : n.type === 'LogicalExpression' ? (collect(n.left), collect(n.right)) : leaves.push(n));
          collect(init);
          if (leaves.some((l) => l.type === 'StringLiteral' && /\s/.test(l.value.trim()) && translatable(l.value))) replace(init);
        } else if ((init.type === 'StringLiteral' && prose(init.value) && /\s/.test(init.value.trim())) || init.type === 'TemplateLiteral') replace(init);
        break;
      }
      case 'ArrayExpression':
        if (node.elements.length >= 2 && node.elements.every((e) => e && e.type === 'StringLiteral' && translatable(e.value))) node.elements.forEach(replace);
        else if (node.elements.some((e) => e && e.type === 'StringLiteral' && /\s/.test(e.value.trim()) && translatable(e.value))) {
          // tuples d'affichage : ['user', 'Mon profil public', 'Ce que voient les sœurs', () => …]
          node.elements.forEach((e) => e && ((e.type === 'StringLiteral' && prose(e.value)) || e.type === 'TemplateLiteral' || e.type === 'ConditionalExpression') && replace(e));
        }
        break;
      default:
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, node));
      else if (v && typeof v.type === 'string') walk(v, node);
    }
  }
  walk(ast.program, null);
  if (!edits.length) continue;
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const e of edits) if (!kept.length || e.start >= kept[kept.length - 1].end) kept.push(e);
  let out = src;
  for (const e of [...kept].reverse()) out = out.slice(0, e.start) + e.out + out.slice(e.end);
  if (!/import \{[^}]*\btr\b[^}]*\} from ['"][^'"]*i18n['"]/.test(out)) {
    let rel = path.relative(path.dirname(file), I18N).replace(/\.js$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    const imports = [...out.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm)];
    const line = `import { tr } from '${rel}';`;
    const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    out = `${out.slice(0, at)}\n${line}${out.slice(at)}`;
  }
  files += 1;
  total += kept.length;
  if (WRITE) fs.writeFileSync(file, out);
  else for (const e of kept) console.log(`${path.relative(root, file)}: ${e.out.slice(0, 140)}`);
}
console.log({ files, edits: total, written: WRITE });
