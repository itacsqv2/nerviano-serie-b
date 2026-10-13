/**
 * Server statico di sviluppo che serve dist/ con gli header di vercel.json, per provare la CSP in locale
 * (astro preview non applica vercel.json). Uso: npx tsx scripts/dev/server-csp.ts [porta]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { RADICE } from '../lib/file.ts';

const DIST = path.join(RADICE, 'dist');
const vercel = JSON.parse(fs.readFileSync(path.join(RADICE, 'vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const TIPI: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.avif': 'image/avif', '.txt': 'text/plain' };
const porta = Number(process.argv[2] ?? 4322);

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  let file = path.join(DIST, url);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  const trovato = fs.existsSync(file);
  if (!trovato) file = path.join(DIST, '404.html');
  for (const regola of vercel.headers) {
    const re = new RegExp(`^${regola.source.replace('(.*)', '.*')}$`);
    if (re.test(url)) for (const h of regola.headers) res.setHeader(h.key, h.value);
  }
  res.setHeader('Content-Type', TIPI[path.extname(file)] ?? 'application/octet-stream');
  res.statusCode = trovato ? 200 : 404;
  fs.createReadStream(file).pipe(res);
}).listen(porta, () => console.log(`dist/ con gli header di vercel.json su http://localhost:${porta}/`));
