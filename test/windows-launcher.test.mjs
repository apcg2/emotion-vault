import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrapper = new URL('../启动.cmd', import.meta.url);

test('Windows bootstrap uses ASCII and CRLF, with archive-safe Git attributes', async () => {
  const bytes = await readFile(wrapper);
  assert.ok(
    [...bytes].every((byte) => byte < 128),
    'CMD parser must not depend on Unicode decoding',
  );
  assert.ok(bytes.includes(Buffer.from('\r\n')));
  assert.doesNotMatch(bytes.toString(), /(?<!\r)\n|\r(?!\n)/);
  const attr = execFileSync('git', ['check-attr', 'text', '--', '启动.cmd'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(attr, /text: unset/);
});

test(
  'Windows cmd handles missing Node, PATH, fallback installs and special-character paths',
  { skip: process.platform !== 'win32', timeout: 60_000 },
  async (t) => {
    const temporary = await mkdtemp(join(tmpdir(), 'emotion-windows-'));
    const project = join(temporary, '中文 project & test!');
    const programFiles = join(temporary, 'Program Files');
    await mkdir(join(project, 'scripts'), { recursive: true });
    await copyFile(wrapper, join(project, '启动.cmd'));
    const marker = 'EMOTION_WRAPPER_RESULT=';
    // Exercise the batch file without opening a browser, listening or accessing user data.
    await writeFile(
      join(project, 'scripts/launch.mjs'),
      `console.log(${JSON.stringify(marker)} + JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})); process.exit(Number(process.env.EMOTION_TEST_EXIT || 0));`,
    );
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (
        [
          'path',
          'programfiles',
          'programw6432',
          'localappdata',
          'nvm_symlink',
          'emotion_node',
        ].includes(key.toLowerCase())
      )
        delete env[key];
    }
    Object.assign(env, {
      Path: join(process.env.SystemRoot, 'System32'),
      ProgramFiles: programFiles,
      ProgramW6432: join(temporary, 'missing-program-files'),
      LocalAppData: join(temporary, 'missing-local-app-data'),
      NVM_SYMLINK: join(temporary, 'missing-nvm'),
    });
    const run = (overrides) =>
      spawnSync(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', `""${join(project, '启动.cmd')}" --no-open <nul"`],
        {
          cwd: temporary,
          env: { ...env, ...overrides },
          windowsVerbatimArguments: true,
          encoding: 'utf8',
          timeout: 15_000,
        },
      );
    const verify = (result, status) => {
      assert.ifError(result.error);
      assert.equal(result.status, status, result.stdout + result.stderr);
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /not recognized|syntax.*incorrect/i,
      );
    };
    try {
      await t.test(
        'Node missing: clear instructions, no accidental commands',
        () => {
          const result = run();
          verify(result, 1);
          assert.match(result.stdout, /Node.js was not found/);
          assert.match(result.stdout, /npm.cmd ci/);
        },
      );
      await t.test(
        'Node on PATH: correct project directory and forwarded arguments',
        () => {
          const result = run({
            Path: `${dirname(process.execPath)};${env.Path}`,
          });
          verify(result, 0);
          const line = result.stdout
            .split(/\r?\n/)
            .find((line) => line.startsWith(marker));
          assert.ok(line, result.stdout);
          assert.deepEqual(JSON.parse(line.slice(marker.length)), {
            cwd: project,
            args: ['--no-open'],
          });
        },
      );
      await t.test('nonzero application exit is preserved', () => {
        verify(
          run({
            Path: `${dirname(process.execPath)};${env.Path}`,
            EMOTION_TEST_EXIT: '7',
          }),
          7,
        );
      });
      await t.test(
        'Node installed but absent from PATH: finds Program Files',
        async () => {
          await mkdir(join(programFiles, 'nodejs'), { recursive: true });
          await copyFile(
            process.execPath,
            join(programFiles, 'nodejs/node.exe'),
          );
          const result = run();
          verify(result, 0);
          assert.ok(result.stdout.includes(marker), result.stdout);
        },
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  },
);
