import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  readdir,
  rm,
  writeFile,
  chmod,
  realpath,
} from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  configureRuntime,
  configuredNode,
  assertRuntime,
} from '../scripts/runtime.mjs';

const windows = process.platform === 'win32';
const launcher = windows ? '启动.cmd' : '启动.command';
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'emotion-runtime-中文 空格-'));
  for (const folder of ['scripts', 'lib', 'dist', '专用 Node 24', 'old-node'])
    await mkdir(join(dir, folder));
  for (const file of [
    'launch.mjs',
    'runtime.mjs',
    'configure-runtime.mjs',
    'server.mjs',
    'store.mjs',
  ])
    await copyFile(
      new URL('../scripts/' + file, import.meta.url),
      join(dir, 'scripts', file),
    );
  await copyFile(
    new URL('../lib/log-document.ts', import.meta.url),
    join(dir, 'lib/log-document.ts'),
  );
  await copyFile(
    new URL('../' + launcher, import.meta.url),
    join(dir, launcher),
  );
  await writeFile(
    join(dir, 'dist/emotion-vault.html'),
    '<html>isolated launcher fixture</html>',
  );
  const node24 = join(dir, '专用 Node 24', windows ? 'node.exe' : 'node');
  await copyFile(process.execPath, node24);
  await chmod(node24, 0o755);
  const setup = spawnSync(
    node24,
    [join(dir, 'scripts/configure-runtime.mjs')],
    { encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(setup.status, 0, setup.stderr);
  const oldDir = process.env.EMOTION_TEST_NODE22
    ? dirname(process.env.EMOTION_TEST_NODE22)
    : join(dir, 'old-node');
  if (!process.env.EMOTION_TEST_NODE22) {
    // Local fallback probe: any accidental PATH-node invocation must fail.
    const shadow = join(oldDir, windows ? 'node.cmd' : 'node');
    await writeFile(
      shadow,
      windows
        ? '@echo off\r\necho WRONG_PATH_NODE\r\nexit /b 22\r\n'
        : '#!/bin/sh\necho WRONG_PATH_NODE\nexit 22\n',
    );
    await chmod(shadow, 0o755);
  }
  const env = { ...process.env };
  const pathKey =
    Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = oldDir + (windows ? ';' : ':') + (env[pathKey] || '');
  const command = windows ? 'cmd.exe' : '/bin/zsh';
  const args = (flag) =>
    windows
      ? ['/d', '/s', '/c', '""' + join(dir, launcher) + '" ' + flag + '"']
      : [join(dir, launcher), flag];
  const options = { cwd: tmpdir(), env, windowsVerbatimArguments: windows };
  return { dir, node24: await realpath(node24), command, args, options };
}
void test('project binding defeats competing PATH node, including Unicode binary paths; stale config fails closed', async () => {
  const f = await fixture();
  try {
    if (process.env.EMOTION_TEST_NODE22)
      assert.match(
        spawnSync(process.env.EMOTION_TEST_NODE22, ['--version'], {
          encoding: 'utf8',
        }).stdout,
        /^v22\./,
      );
    const result = spawnSync(f.command, f.args('--check'), {
      ...f.options,
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /Node 24\./);
    assert.ok(result.stdout.includes(f.node24));
    assert.doesNotMatch(result.stdout, /WRONG_PATH_NODE/);
    const current = await readFile(join(f.dir, '.local/node-path.txt'), 'utf8');
    await configureRuntime(f.dir); // Building with a different Node must not silently change this binding.
    assert.equal(
      await readFile(join(f.dir, '.local/node-path.txt'), 'utf8'),
      current,
    );
    if (process.env.EMOTION_TEST_NODE22) {
      const direct = spawnSync(
        process.env.EMOTION_TEST_NODE22,
        [join(f.dir, 'scripts/launch.mjs'), '--check'],
        { encoding: 'utf8', timeout: 15_000 },
      );
      assert.equal(direct.status, 0, direct.stderr + direct.stdout);
      assert.ok(direct.stdout.includes(f.node24));
    }
    await writeFile(
      join(f.dir, '.local/node-path.txt'),
      join(f.dir, 'missing-node') + '\n',
    );
    const missing = spawnSync(f.command, f.args('--check'), {
      ...f.options,
      input: '\n',
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.equal(missing.status, 1, missing.stderr + missing.stdout);
    assert.match(missing.stdout, /configure-runtime/);
    assert.doesNotMatch(missing.stdout, /WRONG_PATH_NODE/);
    await assert.rejects(configureRuntime(f.dir), /不可用/);
    await configureRuntime(f.dir, { replace: true });
    assert.equal(await configuredNode(f.dir), await realpath(process.execPath));
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});
void test('runtime validation rejects old versions and malformed bindings', async () => {
  assert.throws(() => assertRuntime('22.20.0'), /Node.js 24/);
  const dir = await mkdtemp(join(tmpdir(), 'emotion-bad-runtime-'));
  try {
    await mkdir(join(dir, '.local'));
    for (const value of ['', 'node\n', '/absolute\nsecond line\n']) {
      await writeFile(join(dir, '.local/node-path.txt'), value);
      await assert.rejects(configuredNode(dir), /配置无效/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
void test(
  'CI: native launcher actually starts the server with Node 22 on PATH and project Node 24 bound',
  { skip: !process.env.EMOTION_TEST_NODE22, timeout: 40_000 },
  async () => {
    // Only CI provides this variable. Never inspect or occupy a user's local port 3001.
    const f = await fixture();
    let child, pid, exited;
    try {
      child = spawn(f.command, f.args('--no-open'), {
        ...f.options,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      exited = once(child, 'exit');
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      const output = [];
      await new Promise((done, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error('Launcher did not become ready: ' + output.join('')),
            ),
          15_000,
        );
        const fail = (e) => {
          clearTimeout(timer);
          reject(e);
        };
        child.once('error', fail);
        child.once('exit', (code) =>
          fail(new Error('Early exit ' + code + ': ' + output.join(''))),
        );
        child.stdout.on('data', (chunk) => {
          output.push(chunk.toString());
          if (output.join('').includes('情绪知了已启动：')) {
            clearTimeout(timer);
            done();
          }
        });
        child.stderr.on('data', (chunk) => output.push(chunk.toString()));
      });
      pid = JSON.parse(
        await readFile(join(f.dir, 'data/.server.lock'), 'utf8'),
      ).pid;
      assert.ok(output.join('').includes(f.node24));
      const response = await fetch('http://localhost:3001/');
      assert.equal(response.status, 200);
      assert.match(await response.text(), /isolated launcher fixture/);
      assert.deepEqual(
        JSON.parse(await readFile(join(f.dir, 'data/logs.json'), 'utf8')).logs,
        [],
      );
      assert.deepEqual((await readdir(join(f.dir, 'data'))).sort(), [
        '.server.lock',
        'logs.json',
      ]);
    } finally {
      if (!pid) {
        try {
          pid = JSON.parse(
            await readFile(join(f.dir, 'data/.server.lock'), 'utf8'),
          ).pid;
        } catch {
          /* May fail before starting. */
        }
      }
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch (e) {
          assert.equal(e.code, 'ESRCH');
        }
      }
      if (child && child.exitCode === null) {
        child.stdin.end('\n');
        if (!pid) child.kill();
      }
      if (exited) await exited;
      await rm(f.dir, { recursive: true, force: true });
    }
  },
);
