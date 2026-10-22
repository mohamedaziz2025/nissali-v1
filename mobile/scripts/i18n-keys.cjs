// Liste les textes passés à tr(…) dans l'appli et ceux qui manquent dans les dictionnaires anglais et arabe.
// Usage : node scripts/i18n-keys.cjs [--missing]
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const keys = new Map();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f)) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/\btr\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)) {
        const lit = m[1][0] === "'" ? `"${m[1].slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"` : m[1];
        const key = JSON.parse(lit);
        if (!keys.has(key)) keys.set(key, path.relative(root, p));
      }
    }
  }
})(path.join(root, 'src'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/ar.json'), 'utf8'));
const missing = [...keys].filter(([k]) => !(k in en) || !(k in ar));
if (process.argv.includes('--missing')) for (const [k, f] of missing) console.log(JSON.stringify(k), '·', f);
console.log(`${keys.size} textes, ${missing.length} sans traduction`);
