// 偽りの廷 — ソースを1つのHTMLにまとめる
// 使い方: node build.mjs [artifact出力先]
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const JS = ['util', 'data', 'logic', 'audio', 'portrait', 'game', 'ui', 'main'];
const head = read('./src/head.html');
const css = read('./src/style.css');
const js = JS.map((f) => `/* ---- ${f}.js ---- */\n` + read(`./src/js/${f}.js`).replace(/^'use strict';\n/, '')).join('\n');
const body = `<div id="app"></div>\n<script>\n'use strict';\n(() => {\n${js}\n})();\n</script>\n`;
const inner = `${head}<style>\n${css}</style>\n${body}`;

const full = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}<style>
${css}</style>
</head>
<body>
${body}</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), full);
if (process.argv[2]) writeFileSync(process.argv[2], inner);
console.log('built index.html', (full.length / 1024).toFixed(1) + 'KB');
