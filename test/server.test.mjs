import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLocalServer } from '../scripts/serve.mjs';

function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, ...options },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    req.once('error', reject);
    req.end();
  });
}

test('static server serves both routes and assets, with no source or mutation endpoints', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'emotion-server-'));
  const directory = join(temporary, '中文 project space');
  await mkdir(join(directory, 'assets'), { recursive: true });
  const html =
    '<!doctype html><html lang="zh-CN"><title>情绪知了</title><div id="root"></div></html>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets/app.js'), 'console.log("synthetic")');
  await writeFile(join(directory, 'assets/app.css'), 'body { color: green; }');
  await writeFile(join(directory, 'favicon.svg'), '<svg/>');
  await writeFile(join(directory, '.env'), 'SYNTHETIC_TEST_VALUE');
  await writeFile(join(temporary, 'outside.js'), 'SYNTHETIC_TEST_VALUE');
  const server = createLocalServer(directory);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  try {
    await t.test(
      'main route, direct demo route, query and HEAD stay usable',
      async () => {
        for (const path of [
          '/',
          '/index.html',
          '/demo-data',
          '/demo-data/',
          '/?v=2',
        ]) {
          const result = await request(port, path, {
            headers: { Host: `localhost:${port}` },
          });
          assert.equal(result.status, 200, path);
          assert.equal(result.body, html);
          assert.match(result.headers['content-type'], /text\/html/);
          assert.equal(result.headers['cache-control'], 'no-store');
        }
        const head = await request(port, '/', { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(head.body, '');
        assert.equal(
          Number(head.headers['content-length']),
          Buffer.byteLength(html),
        );
      },
    );
    await t.test(
      'assets have correct MIME types and missing files are not HTML fallbacks',
      async () => {
        for (const [path, type] of [
          ['/assets/app.js', 'text/javascript'],
          ['/assets/app.css', 'text/css'],
          ['/favicon.svg', 'image/svg+xml'],
        ]) {
          const result = await request(port, path);
          assert.equal(result.status, 200);
          assert.ok(result.headers['content-type'].startsWith(type));
          assert.equal(result.headers['x-content-type-options'], 'nosniff');
        }
        for (const path of ['/assets/missing.js', '/unknown', '/api/logs'])
          assert.equal((await request(port, path)).status, 404, path);
      },
    );
    await t.test(
      'rejects foreign hosts, writes, malformed paths and traversal',
      async () => {
        assert.equal(
          (
            await request(port, '/', {
              headers: { Host: `example.com:${port}` },
            })
          ).status,
          403,
        );
        assert.equal(
          (await request(port, '/', { method: 'POST' })).status,
          405,
        );
        assert.equal((await request(port, '/%ZZ')).status, 400);
        for (const path of [
          '/.env',
          '/package.json',
          '/app/page.tsx',
          '/assets/../.env',
          '/assets/%2e%2e/%2e%2e/outside.js',
          '/assets/%5c..%5coutside.js',
          '/assets/app.js%3Asecret',
          '/assets/app.js%00',
          '//example.com/',
        ]) {
          const result = await request(port, path);
          assert.equal(result.status, 404, path);
          assert.ok(!result.body.includes('SYNTHETIC_TEST_VALUE'));
        }
      },
    );
    // Windows may require elevated permission to create symlinks. No permission change for tests.
    await t.test(
      'does not follow symlinks outside the build directory',
      { skip: process.platform === 'win32' },
      async () => {
        await symlink(
          join(temporary, 'outside.js'),
          join(directory, 'assets/link.js'),
        );
        assert.equal((await request(port, '/assets/link.js')).status, 404);
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
});
