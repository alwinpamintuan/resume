import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import type { AddressInfo } from 'node:net';

/** Local artifact server used by exports and audits, never deployed. */
export async function serveDist(port = 0) {
  const root = resolve('dist');
  const mime: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xml': 'application/xml', '.txt': 'text/plain' };
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = resolve(root, `.${path}`);
      if (!file.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
