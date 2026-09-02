import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import net from 'node:net';
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  APP_URL,
  browserCommand,
  checkRuntime,
  probeServer,
  serverCommand,
  waitUntilReady,
} from '../scripts/launch.mjs';

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    await callback(url);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('requires a supported Node version', () => {
  for (const version of ['22.13.0', '24.16.0', '26.0.0'])
    assert.doesNotThrow(() => checkRuntime(version));
  for (const version of ['18.20.0', '20.19.0', '22.12.0', 'invalid'])
    assert.throws(() => checkRuntime(version), /Node.js/);
});

test('browser commands always open the same localhost origin, including Windows empty title', () => {
  assert.equal(APP_URL, 'http://localhost:3001/');
  assert.deepEqual(browserCommand('darwin'), {
    command: '/usr/bin/open',
    args: [APP_URL],
  });
  assert.deepEqual(browserCommand('win32').args, [
    '/d',
    '/c',
    'start',
    '',
    APP_URL,
  ]);
});

test('distinguishes this app, unrelated pages, redirects, broken replies and free ports', async () => {
  for (const [status, body, expected] of [
    [200, '<!doctype html><title>情绪知了</title>', 'app'],
    [200, '<title>Other app</title>', 'occupied'],
    [302, '<title>情绪知了</title>', 'occupied'],
    [500, '<title>情绪知了</title>', 'occupied'],
  ]) {
    await withServer(
      (_, response) => {
        response.writeHead(status);
        response.end(body);
      },
      async (url) => {
        assert.equal(await probeServer(url), expected);
      },
    );
  }
  await withServer(
    (_, response) => response.destroy(),
    async (url) => assert.equal(await probeServer(url), 'occupied'),
  );
  await withServer(
    () => {},
    async (url) => assert.equal(await probeServer(url, 30), 'occupied'),
  );
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  assert.equal(await probeServer(`http://127.0.0.1:${port}/`), 'free');
});

test('first-use messages are explicit; paths with Chinese and spaces are passed as individual arguments', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'emotion-launch-test-'));
  const root = join(temporary, '中文 project space');
  try {
    assert.throws(() => serverCommand(root), /未找到项目/);
    await mkdir(root);
    await writeFile(join(root, 'package.json'), '{}');
    assert.throws(() => serverCommand(root), /缺少本地启动服务/);
    await mkdir(join(root, 'scripts'));
    await writeFile(join(root, 'scripts/serve.mjs'), '');
    assert.throws(() => serverCommand(root), /首次构建/);
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/index.html'), '<title>情绪知了</title>');
    const command = serverCommand(root);
    assert.equal(command.command, process.execPath);
    assert.equal(command.cwd, root);
    assert.equal(command.args[0], join(root, 'scripts/serve.mjs'));
    assert.equal(command.args.length, 1);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('waits for readiness, stops on child failure/cancellation, and has a timeout', async () => {
  let attempts = 0;
  assert.equal(
    await waitUntilReady({
      probe: async () => (++attempts > 2 ? 'app' : 'free'),
      intervalMs: 1,
      timeoutMs: 100,
    }),
    true,
  );
  assert.equal(attempts, 3);
  await assert.rejects(waitUntilReady({ exited: () => true }), /启动失败/);
  assert.equal(await waitUntilReady({ stopping: () => true }), false);
  await assert.rejects(
    waitUntilReady({ probe: async () => 'free', intervalMs: 1, timeoutMs: 10 }),
    /超过/,
  );
});

test('both wrappers use their own directory and preserve failures; macOS wrapper is executable', async () => {
  const mac = await readFile(
    new URL('../启动.command', import.meta.url),
    'utf8',
  );
  const win = await readFile(new URL('../启动.cmd', import.meta.url), 'utf8');
  assert.ok(mac.includes('cd "$EMOTION_ROOT"'));
  assert.ok(mac.includes('"$EMOTION_ROOT/scripts/launch.mjs"'));
  assert.ok(win.includes('pushd "%~dp0"'));
  assert.ok(win.includes('"%EMOTION_NODE%" "%~dp0scripts\\launch.mjs"'));
  assert.ok(win.includes('exit /b %EMOTION_EXIT%'));
  for (const source of [mac, win])
    assert.doesNotMatch(
      source,
      /NODE_OPTIONS\s*=|bypass|xattr\s+-d|npm\s+install/,
    );
  if (process.platform !== 'win32')
    assert.ok(
      (await stat(new URL('../启动.command', import.meta.url))).mode & 0o100,
    );
});
