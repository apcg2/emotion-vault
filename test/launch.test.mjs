import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

void test('native launcher supports Unicode/spaces directory and runs from a different cwd', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'emotion-launch-中文 空格-'));
  try {
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, 'dist'));
    await copyFile(
      new URL('../scripts/launch.mjs', import.meta.url),
      join(dir, 'scripts/launch.mjs'),
    );
    await writeFile(
      join(dir, 'dist/emotion-vault.html'),
      '<html>synthetic</html>',
    );
    const cmdBytes = await readFile(new URL('../启动.cmd', import.meta.url));
    assert.ok(
      cmdBytes.every((byte) => byte < 128),
      'Windows launcher must remain ASCII',
    );
    assert.ok(
      cmdBytes.includes(Buffer.from('\r\n')),
      'Windows ZIP must contain CRLF',
    );
    assert.doesNotMatch(cmdBytes.toString(), /(?<!\r)\n/);
    const name = process.platform === 'win32' ? '启动.cmd' : '启动.command';
    await copyFile(new URL('../' + name, import.meta.url), join(dir, name));
    const result =
      process.platform === 'win32'
        ? spawnSync(
            'cmd.exe',
            ['/d', '/s', '/c', '""' + join(dir, name) + '" --check"'],
            {
              cwd: tmpdir(),
              encoding: 'utf8',
              timeout: 15_000,
              windowsVerbatimArguments: true,
            },
          )
        : spawnSync('zsh', [join(dir, name), '--check'], {
            cwd: tmpdir(),
            encoding: 'utf8',
            timeout: 15_000,
          });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /Node.js/);
    await rm(join(dir, 'dist/emotion-vault.html'));
    const missing = spawnSync(
      process.execPath,
      [join(dir, 'scripts/launch.mjs'), '--check'],
      { encoding: 'utf8', timeout: 15_000 },
    );
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /npm ci/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
