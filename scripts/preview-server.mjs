/**
 * Servidor estático mínimo para previsualizar los mockups en el navegador.
 * Uso: npm run preview  ->  http://127.0.0.1:8099/design/mockup-dashboard.html
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.PREVIEW_ROOT ?? '.');
const port = Number(process.env.PREVIEW_PORT ?? 8099);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);

      if (!file.startsWith(root)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      if ((await stat(file)).isDirectory()) {
        file = path.join(file, 'index.html');
      }

      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': types[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Preview: http://127.0.0.1:${port}/design/mockup-dashboard.html`);
  });
