import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { openStore } from '../scripts/store.mjs';
import { startServer } from '../scripts/server.mjs';
import { parseLogDocument, serialize } from '../lib/log-document.ts';

const sample = (id = 'synthetic-1') => ({
  id,
  ts: '2026-09-01T08:00:00Z',
  situation: '合成测试',
  thoughts: '测试想法',
  emotions: [{ name: '担忧', category: '焦虑', before: 70, after: 30 }],
  distortions: ['心理过滤'],
  responses: [{ text: '客观回应', belief: 80 }],
});
const closers = new WeakMap();
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'emotion-server-中文 空格-'));
  closers.set(t, []);
  t.after(async () => {
    for (const close of closers.get(t)) await close();
    await rm(dir, { recursive: true, force: true }); // Only this test's own temporary directory.
  });
  return dir;
}
void test('disk store persists append/delete across restarts, backs up each mutation and prevents stale deletes', async (t) => {
  const dir = await fixture(t);
  const store = await openStore(dir);
  closers.get(t).push(() => store.close());
  assert.deepEqual((await store.read()).logs, []);
  const first = await store.append(sample());
  assert.equal((await store.append(sample())).revision, first.revision);
  await assert.rejects(
    store.append({ ...sample(), situation: '冲突' }),
    /冲突/,
  );
  await Promise.all([
    store.append(sample('two')),
    store.append(sample('three')),
  ]);
  await assert.rejects(store.remove('two', first.revision), /发生变化/);
  const latest = await store.read();
  assert.equal(latest.logs.length, 3);
  const saved = await store.remove('two', latest.revision);
  assert.equal(saved.logs.length, 2);
  assert.equal((await readdir(join(dir, 'backups'))).length, 4);
  assert.equal(
    (await readdir(dir)).filter((name) => name.endsWith('.tmp')).length,
    0,
  );
  await store.close();
  const reopened = await openStore(dir);
  assert.deepEqual((await reopened.read()).logs, saved.logs);
  await reopened.close();
});
void test('invalid or damaged data is never replaced; backups failure leaves original intact', async (t) => {
  const dir = await fixture(t),
    path = join(dir, 'logs.json');
  await writeFile(path, 'broken');
  await assert.rejects(openStore(dir), /损坏/);
  assert.equal(await readFile(path, 'utf8'), 'broken');
  await writeFile(path, serialize([]));
  const store = await openStore(dir);
  closers.get(t).push(() => store.close());
  await assert.rejects(
    store.append({ ...sample(), emotions: [{ before: 101 }] }),
    /字段/,
  );
  await writeFile(join(dir, 'backups'), 'blocked');
  await assert.rejects(store.append(sample()));
  assert.equal(await readFile(path, 'utf8'), serialize([]));
  await writeFile(path, 'externally corrupted');
  await assert.rejects(store.append(sample()), /损坏/);
  assert.equal(await readFile(path, 'utf8'), 'externally corrupted');
});
void test('second server and stale locks fail closed without resetting logs', async (t) => {
  const dir = await fixture(t);
  const store = await openStore(dir);
  await assert.rejects(openStore(dir), /锁定/);
  await store.close();
  await writeFile(join(dir, '.server.lock'), '{"pid":99999999}');
  await assert.rejects(openStore(dir), /锁定/);
  assert.equal(
    await readFile(join(dir, '.server.lock'), 'utf8'),
    '{"pid":99999999}',
  );
});
void test('validation rejects duplicate IDs, encrypted format and invalid scores', () => {
  assert.throws(
    () => parseLogDocument(serialize([sample(), sample()])),
    /重复/,
  );
  assert.throws(() => parseLogDocument('{"ciphertext":"old"}'));
  assert.throws(() =>
    parseLogDocument(
      serialize([{ ...sample(), responses: [{ text: 'x', belief: -1 }] }]),
    ),
  );
});
void test('HTTP API uses loopback, same-origin token protection, disk persistence and no static data exposure', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'dist'));
  await writeFile(
    join(root, 'dist/emotion-vault.html'),
    '<html>synthetic fixture</html>',
  );
  const app = await startServer({ root, port: 0 });
  closers.get(t).push(() => app.close());
  assert.equal(app.server.address().address, '127.0.0.1');
  const base = app.url;
  const session = await (await fetch(base + 'api/session')).json();
  const headers = {
    'Content-Type': 'application/json',
    'X-Emotion-Token': session.token,
  };
  assert.equal(session.dataPath, join(root, 'data/logs.json'));
  assert.equal((await fetch(base + 'api/logs')).status, 403);
  assert.equal(
    (
      await fetch(base + 'api/session', {
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
  const hostileHost = await new Promise((done, reject) => {
    const req = request(
      base + 'api/session',
      { headers: { Host: 'evil.example' } },
      (res) => {
        res.resume();
        done(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(hostileHost, 403);
  assert.equal(
    (
      await fetch(base + 'api/session', {
        headers: { 'Sec-Fetch-Site': 'cross-site' },
      })
    ).status,
    403,
  );
  for (const path of [
    'data/logs.json',
    'scripts/server.mjs',
    'package.json',
    '.git/config',
  ])
    assert.equal((await fetch(base + path)).status, 404);
  const html = await fetch(base);
  assert.match(
    html.headers.get('content-security-policy'),
    /frame-ancestors 'none'/,
  );
  assert.equal(html.headers.get('access-control-allow-origin'), null);
  assert.match(await html.text(), /synthetic fixture/);
  // Every caller below supplies POST, PUT or DELETE, never GET.
  const write = (method, value) =>
    // oxlint-disable-next-line unicorn/no-invalid-fetch-options
    fetch(base + 'api/logs', { method, headers, body: JSON.stringify(value) });
  const saved = await (await write('POST', { log: sample() })).json();
  assert.equal(saved.logs.length, 1);
  assert.equal(
    parseLogDocument(await readFile(session.dataPath, 'utf8')).logs.length,
    1,
  );
  assert.equal((await write('PUT', { logs: [] })).status, 404);
  assert.equal((await write('POST', { log: {} })).status, 400);
  assert.equal(
    (await write('DELETE', { id: sample().id, revision: 'stale' })).status,
    409,
  );
  assert.equal(
    (
      await fetch(base + 'api/demo', {
        method: 'POST',
        headers,
        body: JSON.stringify({ logs: [sample()] }),
      })
    ).status,
    400,
  );
  const deleted = await (
    await write('DELETE', { id: sample().id, revision: saved.revision })
  ).json();
  assert.deepEqual(deleted.logs, []);
  await app.close();
  const reopened = await startServer({ root, port: 0 });
  closers.get(t).push(() => reopened.close());
  const newSession = await (await fetch(reopened.url + 'api/session')).json();
  assert.notEqual(newSession.token, session.token);
  assert.deepEqual(
    parseLogDocument(await readFile(session.dataPath, 'utf8')).logs,
    [],
  );
});
void test('missing build does not create a data directory', async (t) => {
  const root = await fixture(t);
  await assert.rejects(startServer({ root, port: 0 }), /ENOENT/);
  assert.deepEqual(await readdir(root), []);
});
