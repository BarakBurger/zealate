/**
 * Local development server for the API. Data goes to ./data instead of S3. The web app's Vite
 * dev server proxies /api here (web/vite.config.ts).
 */
import http from 'node:http';
import path from 'node:path';
import { handle } from './app.js';
import { localStorage } from './storage.js';

const PORT = Number(process.env.API_PORT || 8787);
const storage = localStorage(path.resolve(process.env.DATA_DIR || 'data'));
const secret = process.env.SESSION_SECRET || 'local-dev-only-secret-change-me';

http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const chunks: Buffer[] = [];
  for await (const ch of req) chunks.push(ch as Buffer);
  const out = await handle({
    method: req.method || 'GET', path: url.pathname, query: url.searchParams,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])),
    body: Buffer.concat(chunks),
  }, { storage, secret, secureCookies: false });
  res.writeHead(out.status, out.headers);
  res.end(out.body);
}).listen(PORT, () => console.log(`zealate api on http://localhost:${PORT}`));
