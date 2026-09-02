import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const APP_URL = 'http://localhost:3001/';
const ROUTES = new Set(['/', '/index.html', '/demo-data', '/demo-data/']);
const PUBLIC_FILES = new Set(['/favicon.svg', '/og.png']);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

// Serve only the built UI. No API, database, uploads, or browser-data access.
export function createLocalServer(directory = resolve(PROJECT_ROOT, 'dist')) {
  const root = realpath(directory);
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, message) => {
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    // A loopback bind plus Host validation prevents serving via a rebound domain.
    const port = server.address()?.port;
    const host = request.headers.host?.toLowerCase();
    if (host !== `localhost:${port}` && host !== `127.0.0.1:${port}`) {
      reply(403, '仅允许本机 localhost 访问。');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      reply(405, '不支持此请求方法。');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    } catch {
      reply(400, '无效地址。');
      return;
    }
    if (
      !pathname.startsWith('/') ||
      /[\\\0:]/.test(pathname) ||
      pathname.split('/').some((part) => part.startsWith('.'))
    ) {
      reply(404, '页面不存在。');
      return;
    }
    const file = ROUTES.has(pathname) ? 'index.html' : pathname.slice(1);
    if (
      !ROUTES.has(pathname) &&
      !PUBLIC_FILES.has(pathname) &&
      !/^\/assets\/[\w./-]+$/.test(pathname)
    ) {
      reply(404, '页面不存在。');
      return;
    }
    try {
      const base = await root;
      const target = await realpath(resolve(base, file));
      const within = relative(base, target);
      if (
        within === '..' ||
        within.startsWith(`..${sep}`) ||
        isAbsolute(within) ||
        !(await stat(target)).isFile()
      ) {
        reply(404, '页面不存在。');
        return;
      }
      const data = await readFile(target);
      response.writeHead(200, {
        'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
        'Content-Length': data.length,
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      reply(
        error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,
        '无法读取网页文件，请重新构建后重试。',
      );
    }
  });
  // A missing build is reported by startServer before listening.
  root.catch(() => {});
  return server;
}

export async function startServer() {
  const directory = resolve(PROJECT_ROOT, 'dist');
  try {
    await stat(resolve(directory, 'index.html'));
  } catch {
    throw new Error(
      '尚未完成首次构建。请在项目文件夹运行 npm ci 和 npm run build。',
    );
  }
  const server = createLocalServer(directory);
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(3001, '127.0.0.1', ready);
  });
  const stop = () => server.close(() => process.exit(0));
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.once(signal, stop);
  console.log(`情绪知了已就绪：${APP_URL}\n停止服务请按 Ctrl+C。`);
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const flags = process.argv.slice(2);
  // Accept the previous documented command, but never silently change the origin.
  if (
    flags.length &&
    !(flags.length === 2 && flags[0] === '--port' && flags[1] === '3001')
  ) {
    console.error('访问地址固定为 localhost:3001。请使用 npm start。');
    process.exitCode = 1;
  } else {
    startServer().catch((error) => {
      console.error(
        error.code === 'EADDRINUSE'
          ? '端口 3001 已被占用。请使用双击启动文件进入已运行的网页，或先停止原服务。'
          : error.message,
      );
      process.exitCode = 1;
    });
  }
}
