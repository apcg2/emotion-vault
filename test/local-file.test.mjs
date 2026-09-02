import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalLogFile, parseLogDocument } from '../lib/local-file.ts';

const sample = (id = 'synthetic-1') => ({
  id,
  ts: '2026-09-02T12:34:56Z',
  situation: '仅用于测试的情境🔒',
  thoughts: '<script>测试</script>',
  emotions: [{ name: '担忧', category: '焦虑', before: 80, after: 30 }],
  distortions: ['心理过滤'],
  responses: [{ text: '积极回应', belief: 60 }],
});
class FakeFile {
  name = '合成测试.json';
  text = '';
  writing = false;
  denied = false;
  failWrite = false;
  failClose = false;
  afterWrite = null;
  afterClose = null;
  async getFile() {
    return { size: Buffer.byteLength(this.text), text: async () => this.text };
  }
  async createWritable(options) {
    assert.deepEqual(options, { mode: 'exclusive', keepExistingData: false });
    if (this.denied || this.writing) throw new Error('Denied');
    this.writing = true;
    let pending = '';
    return {
      write: async (text) => {
        if (this.failWrite) throw new Error('Disk full');
        pending = text;
        this.afterWrite?.();
      },
      close: async () => {
        this.writing = false;
        if (this.failClose) throw new Error('Close failed');
        this.text = pending;
        this.afterClose?.();
      },
      abort: async () => {
        this.writing = false;
      },
    };
  }
}
void test('starts empty without browser storage; explicit create, append, reopen and delete persist plaintext', async () => {
  const handle = new FakeFile(),
    app = new LocalLogFile();
  assert.deepEqual(app.logs, []);
  assert.equal(app.name, '');
  await assert.rejects(app.append(sample()), /先新建/);
  await app.create(handle);
  assert.deepEqual(parseLogDocument(handle.text).logs, []);
  await app.append(sample());
  assert.ok(handle.text.includes('仅用于测试的情境'));
  assert.deepEqual(app.logs, [sample()]);
  const reopened = new LocalLogFile();
  assert.deepEqual(reopened.logs, []);
  assert.deepEqual(await reopened.open(handle), [sample()]);
  await reopened.remove(sample().id);
  assert.deepEqual(parseLogDocument(handle.text).logs, []);
});
void test('creating over any nonempty file is refused and current file selection is preserved', async () => {
  const app = new LocalLogFile(),
    old = new FakeFile(),
    other = new FakeFile();
  await app.create(old);
  await app.append(sample());
  other.text = 'user-owned text';
  await assert.rejects(app.create(other), /已有内容/);
  assert.equal(other.text, 'user-owned text');
  assert.deepEqual(app.logs, [sample()]);
  await app.append(sample('next'));
  assert.equal(parseLogDocument(old.text).logs.length, 2);
});
void test('invalid, encrypted, duplicate or oversized files never replace the selected document', async () => {
  const app = new LocalLogFile(),
    handle = new FakeFile();
  await app.create(handle);
  await app.append(sample());
  const invalid = new FakeFile();
  for (const text of [
    '{',
    '{}',
    JSON.stringify({ format: 'emotion-vault-backup', version: 1 }),
    JSON.stringify({ format: 'emotion-logs', version: 2, logs: [] }),
    JSON.stringify({
      format: 'emotion-logs',
      version: 1,
      logs: [sample(), sample()],
    }),
    JSON.stringify({
      format: 'emotion-logs',
      version: 1,
      logs: [{ ...sample(), emotions: [{ before: 200 }] }],
    }),
    'x'.repeat(16 * 1024 * 1024 + 1),
  ]) {
    invalid.text = text;
    await assert.rejects(app.open(invalid));
    assert.equal(invalid.text, text);
    assert.deepEqual(app.logs, [sample()]);
  }
});
void test('permission and pre-commit write failures keep the old file and in-memory records', async () => {
  const app = new LocalLogFile(),
    file = new FakeFile();
  await app.create(file);
  await app.append(sample());
  const before = file.text;
  file.denied = true;
  await assert.rejects(app.append(sample('denied')), /权限/);
  file.denied = false;
  file.failWrite = true;
  await assert.rejects(app.remove(sample().id), /Disk full/);
  assert.equal(file.text, before);
  assert.deepEqual(app.logs, [sample()]);
  assert.equal(file.writing, false);
  file.failWrite = false;
  await app.append(sample('retry'));
  assert.equal(app.logs.length, 2);
});
void test('external edits before and during a save are refused without overwriting them', async () => {
  const app = new LocalLogFile(),
    file = new FakeFile();
  await app.create(file);
  const initial = file.text;
  file.text = initial + '\n';
  await assert.rejects(app.append(sample()), /其他页面/);
  assert.equal(file.text, initial + '\n');
  await app.open(file);
  file.afterWrite = () => {
    file.text += '\n';
  };
  await assert.rejects(app.append(sample()), /文件发生变化/);
  assert.equal(file.text, initial + '\n\n');
  assert.deepEqual(app.logs, []);
  assert.equal(file.writing, false);
});
void test('uncertain close or readback failures block retry until the file is explicitly reopened', async () => {
  for (const failure of ['failClose', 'afterClose']) {
    const app = new LocalLogFile(),
      file = new FakeFile();
    await app.create(file);
    if (failure === 'failClose') file.failClose = true;
    else
      file.afterClose = () => {
        file.text += '\n';
      };
    await assert.rejects(app.append(sample()), /无法确认/);
    assert.deepEqual(app.logs, []);
    await assert.rejects(app.append(sample('next')), /待确认/);
    file.failClose = false;
    file.afterClose = null;
    await app.open(file);
    await app.append(sample('next'));
    assert.ok(app.logs.some((log) => log.id === 'next'));
  }
});
void test('concurrent app instances cannot overwrite another instance with a stale snapshot', async () => {
  const file = new FakeFile(),
    one = new LocalLogFile(),
    two = new LocalLogFile();
  await one.create(file);
  await two.open(file);
  const results = await Promise.allSettled([
    one.append(sample('one')),
    two.append(sample('two')),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(parseLogDocument(file.text).logs.length, 1);
  await two.open(file);
  await two.append(sample('three'));
  assert.equal(parseLogDocument(file.text).logs.length, 2);
});
void test('snapshots are isolated, duplicate or malformed additions leave the original unchanged', async () => {
  const app = new LocalLogFile(),
    file = new FakeFile();
  await app.create(file);
  await app.append(sample());
  app.logs[0].situation = 'mutation';
  assert.equal(app.logs[0].situation, sample().situation);
  const before = file.text;
  await assert.rejects(app.append(sample()), /已存在/);
  await assert.rejects(app.append({ ...sample('bad'), ts: 'invalid' }), /格式/);
  assert.equal(file.text, before);
  assert.deepEqual(parseLogDocument(app.exportText()).logs, [sample()]);
});
void test('a real disk JSON in a Unicode/spaces folder survives new application instances', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'emotion-disk-中文 空格-'));
  const path = join(dir, 'logs.json');
  try {
    await writeFile(path, '');
    const handle = {
      name: 'logs.json',
      async getFile() {
        const text = await readFile(path, 'utf8');
        return { size: Buffer.byteLength(text), text: async () => text };
      },
      async createWritable() {
        const staging = join(dir, 'staging.json');
        return {
          write: (text) => writeFile(staging, text),
          close: () => rename(staging, path),
          abort: () => rm(staging, { force: true }),
        };
      },
    };
    const first = new LocalLogFile();
    await first.create(handle);
    await first.append(sample());
    const second = new LocalLogFile();
    assert.deepEqual(await second.open(handle), [sample()]);
    await second.remove(sample().id);
    assert.deepEqual(parseLogDocument(await readFile(path, 'utf8')).logs, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
