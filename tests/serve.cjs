// Local QA server only. GitHub Pages serves the production static files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const prefix = '/salary-increase-portfolio/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const relative = pathname.slice(prefix.length) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || relative.startsWith('.') || relative.includes('node_modules')) { res.writeHead(403).end(); return; }
  let stat;
  try { stat = fs.statSync(file); }
  catch { res.writeHead(404).end(); return; }
  if (!stat.isFile()) { res.writeHead(404).end(); return; }
  let start = 0, end = stat.size - 1;
  const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  let status = 200;
  if (req.headers.range) {
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!range) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
    start = Number(range[1]);
    if (range[2]) end = Math.min(Number(range[2]), end);
    if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    status = 206;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
  res.on('close', () => stream.destroy());
}).listen(4173, '127.0.0.1', () => console.log('Portfolio QA server: http://127.0.0.1:4173/salary-increase-portfolio/'));
