import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { openStore, DataError } from './store.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP_ID = 'emotion-vault-local-v1';
export const projectId = (root) =>
  createHash('sha256').update(resolve(root)).digest('hex');
export async function startServer({
  root = ROOT,
  port = 3001,
  dataDir = resolve(root, 'data'),
  htmlPath = resolve(root, 'dist/emotion-vault.html'),
} = {}) {
  const html = await readFile(htmlPath); // Fail before creating data if first build is missing.
  const token = randomBytes(32).toString('hex');
  let store;
  const json = (res, status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(body));
  };
  const body = async (req) => {
    if (req.headers['content-type'] !== 'application/json')
      throw new DataError('需要 JSON 请求。', 415);
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) throw new DataError('单次请求超过 1 MB。', 413);
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new DataError('请求格式错误。', 400);
    }
  };
  const payload = (value) => ({ logs: value.logs, revision: value.revision });
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    const actualPort = server.address()?.port;
    const validHosts = ['localhost:' + actualPort, '127.0.0.1:' + actualPort];
    if (
      !validHosts.includes(req.headers.host) ||
      (req.headers.origin &&
        req.headers.origin !== 'http://' + req.headers.host) ||
      (req.headers['sec-fetch-site'] &&
        !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
    ) {
      json(res, 403, { error: '仅允许本机同源访问。' });
      return;
    }
    if (!store) {
      json(res, 503, { error: '服务正在准备数据，请稍候。' });
      return;
    }
    try {
      if (req.method === 'GET' && req.url === '/api/health') {
        json(res, 200, { app: APP_ID, project: projectId(root) });
        return;
      }
      if (req.method === 'GET' && req.url === '/api/session') {
        json(res, 200, { token, dataPath: store.path });
        return;
      }
      if (req.url?.startsWith('/api/')) {
        if (req.headers['x-emotion-token'] !== token)
          throw new DataError('本地连接已失效，请刷新页面。', 403);
        if (req.url === '/api/logs' && req.method === 'GET')
          json(res, 200, payload(await store.read()));
        else if (req.url === '/api/logs' && req.method === 'POST') {
          const input = await body(req);
          json(res, 200, payload(await store.append(input?.log)));
        } else if (req.url === '/api/logs' && req.method === 'DELETE') {
          const input = await body(req);
          if (
            typeof input?.id !== 'string' ||
            typeof input?.revision !== 'string'
          )
            throw new DataError('删除参数无效。', 400);
          json(res, 200, payload(await store.remove(input.id, input.revision)));
        } else if (req.url === '/api/demo' && req.method === 'POST') {
          const input = await body(req);
          json(res, 200, payload(await store.demo(input?.logs)));
        } else json(res, 404, { error: '接口不存在。' });
        return;
      }
      if (
        req.method === 'GET' &&
        ['/', '/index.html', '/demo-data', '/demo-data/'].includes(req.url)
      ) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
      json(res, 404, { error: '页面不存在。' });
    } catch (e) {
      json(res, e instanceof DataError ? e.status : 500, {
        error:
          e instanceof DataError
            ? e.message
            : '文件读写失败。请保留当前内容，检查磁盘空间、权限和备份后刷新核对。',
      });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      done();
    });
  });
  try {
    store = await openStore(dataDir);
  } catch (e) {
    await new Promise((done) => server.close(done));
    throw e;
  }
  let closing;
  return {
    server,
    url: 'http://localhost:' + server.address().port + '/',
    dataPath: store.path,
    close() {
      closing ??= (async () => {
        await new Promise((done) => server.close(done));
        await store.close();
      })();
      return closing;
    },
  };
}
