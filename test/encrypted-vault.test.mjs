import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { previousWeekDemoLogs } from '../lib/demo-logs.ts';
import { createPinCredential, PRIVACY_PIN_KEY } from '../lib/privacy-pin.ts';

// Run the actual browser-independent implementation with Node's Web Crypto and Web Locks.
const source = (
  await readFile(new URL('../lib/encrypted-vault.ts', import.meta.url), 'utf8')
).replace(
  "'./privacy-pin'",
  JSON.stringify(new URL('../lib/privacy-pin.ts', import.meta.url).href),
);
const {
  appendLog,
  calendarRecords,
  deleteLog,
  importDemoLogs,
  encryptionMode,
  unlockVault,
  VAULT_KEY,
  LEGACY_LOG_KEY,
} = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`
);

test('sample import adds precisely seven prior days, is repeatable and preserves existing logs on quota failure', async () => {
  const logs = previousWeekDemoLogs(new Date(2026, 8, 2));
  assert.equal(logs.length, 7);
  assert.equal(logs[0].id, 'moodflow-demo-v1-2026-08-26');
  assert.equal(logs[6].id, 'moodflow-demo-v1-2026-09-01');
  const s = new MemoryStore();
  await unlockVault(s, '0042', 'setup');
  await appendLog(s, sample());
  const before = s.getItem(VAULT_KEY);
  s.failWrite = true;
  await assert.rejects(importDemoLogs(s, logs));
  assert.equal(s.getItem(VAULT_KEY), before);
  s.failWrite = false;
  assert.equal(await importDemoLogs(s, logs), 7);
  assert.equal(await importDemoLogs(s, logs), 0);
  const restored = (await unlockVault(s, '0042', 'unlock')).logs;
  assert.equal(restored.length, 8);
  assert.deepEqual(restored.find(l => l.id === sample().id), sample());
  assert.ok(!s.getItem(VAULT_KEY).includes('模拟数据'));
});
class MemoryStore {
  data = new Map();
  failWrite = false;
  failRemove = false;
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrite) throw new Error('Quota');
    this.data.set(key, value);
  }
  removeItem(key) {
    if (this.failRemove) throw new Error('Interrupted');
    this.data.delete(key);
  }
}
const sample = (id = 'synthetic-1') => ({
  id,
  ts: '2026-09-02T09:43:12.000Z',
  situation: '测试情境🔒'.repeat(1000),
  thoughts: '私密想法，不应出现于存储',
  emotions: [{ name: '测试情绪', category: '其他', before: 80, after: 35 }],
  distortions: ['心理过滤'],
  responses: [{ text: '测试回应', belief: 70 }],
});
async function legacyStore() {
  const s = new MemoryStore();
  s.setItem(LEGACY_LOG_KEY, JSON.stringify([sample()]));
  s.setItem(PRIVACY_PIN_KEY, JSON.stringify(await createPinCredential('0042')));
  return s;
}

test('new vault encrypts every sensitive field, appends while locked, and decrypts losslessly', async () => {
  const s = new MemoryStore();
  assert.equal(encryptionMode(s), 'setup');
  const session = await unlockVault(s, '0042', 'setup');
  assert.equal(session.privateKey.extractable, false);
  await appendLog(s, sample()); // No PIN or private key is passed to append.
  const raw = s.getItem(VAULT_KEY);
  for (const secret of [
    '测试情境',
    '私密想法',
    '测试情绪',
    '心理过滤',
    '测试回应',
    '09:43:12',
  ])
    assert.ok(!raw.includes(secret));
  assert.deepEqual((await unlockVault(s, '0042', 'unlock')).logs, [sample()]);
  assert.equal(calendarRecords(s).length, 1);
  assert.equal(s.getItem(LEGACY_LOG_KEY), null);
  assert.equal(s.getItem(PRIVACY_PIN_KEY), null);
  await assert.rejects(unlockVault(s, '0043', 'unlock'), /密码不正确/);
  assert.equal(s.getItem(VAULT_KEY), raw);
});
test('existing PIN gates migration; plaintext and old fast verifier removed only after verification', async () => {
  const s = await legacyStore();
  const before = new Map(s.data);
  await assert.rejects(unlockVault(s, '9999', 'unlock'), /密码不正确/);
  assert.deepEqual(s.data, before);
  const session = await unlockVault(s, '0042', 'unlock');
  assert.deepEqual(session.logs, [sample()]);
  assert.equal(s.getItem(LEGACY_LOG_KEY), null);
  assert.equal(s.getItem(PRIVACY_PIN_KEY), null);
});
test('failed quota migration and cancellation preserve all old data', async () => {
  const s = await legacyStore();
  const before = new Map(s.data);
  s.failWrite = true;
  await assert.rejects(unlockVault(s, '0042', 'unlock'), /保存失败/);
  assert.deepEqual(s.data, before);
  s.failWrite = false;
  await assert.rejects(
    unlockVault(s, '0042', 'unlock', () => false),
    /取消/,
  );
  assert.deepEqual(s.data, before);
});
test('interrupted cleanup safely resumes after PIN; conflicting legacy writes are never removed', async () => {
  const s = await legacyStore();
  s.failRemove = true;
  await assert.rejects(unlockVault(s, '0042', 'unlock'));
  assert.ok(s.getItem(VAULT_KEY));
  assert.ok(s.getItem(LEGACY_LOG_KEY));
  await assert.rejects(appendLog(s, sample('next')), /迁移尚未完成/);
  s.failRemove = false;
  const legacy = s.getItem(LEGACY_LOG_KEY);
  s.setItem(LEGACY_LOG_KEY, JSON.stringify([sample(), sample('old-tab')]));
  await assert.rejects(unlockVault(s, '0042', 'unlock'), /迁移冲突/);
  assert.equal(JSON.parse(s.getItem(LEGACY_LOG_KEY)).length, 2);
  s.setItem(LEGACY_LOG_KEY, legacy);
  assert.equal((await unlockVault(s, '0042', 'unlock')).logs.length, 1);
  assert.equal(s.getItem(LEGACY_LOG_KEY), null);
});
test('concurrent appends retain all records and deletion retains unrelated records', async () => {
  const s = new MemoryStore();
  const session = await unlockVault(s, '0042', 'setup');
  await Promise.all(
    Array.from({ length: 6 }, (_, i) => appendLog(s, sample(String(i)))),
  );
  assert.equal((await unlockVault(s, '0042', 'unlock')).logs.length, 6);
  const remaining = await deleteLog(s, session, '2');
  assert.equal(remaining.length, 5);
  assert.ok(remaining.every((l) => l.id !== '2'));
  const before = s.getItem(VAULT_KEY);
  s.failWrite = true;
  await assert.rejects(deleteLog(s, session, '3'), /保存失败/);
  assert.equal(s.getItem(VAULT_KEY), before);
});
test('tampering with ciphertext or authenticated date refuses unlock without changing storage', async () => {
  const s = new MemoryStore();
  await unlockVault(s, '0042', 'setup');
  await appendLog(s, sample());
  const original = s.getItem(VAULT_KEY);
  for (const field of ['data', 'ts', 'key']) {
    const v = JSON.parse(original);
    v.records[0][field] = field === 'ts' ? '2000-01-01T12:00:00' : 'AAAA';
    s.setItem(VAULT_KEY, JSON.stringify(v));
    const tampered = s.getItem(VAULT_KEY);
    await assert.rejects(unlockVault(s, '0042', 'unlock'), /解密校验失败/);
    assert.equal(s.getItem(VAULT_KEY), tampered);
  }
});
test('malformed data does not reset the vault, and duplicate setup cannot overwrite keys', async () => {
  const s = new MemoryStore();
  s.setItem(VAULT_KEY, '{broken');
  assert.throws(() => encryptionMode(s));
  await assert.rejects(unlockVault(s, '0042', 'setup'));
  assert.equal(s.getItem(VAULT_KEY), '{broken');
  const clean = new MemoryStore();
  const outcomes = await Promise.allSettled([
    unlockVault(clean, '0042', 'setup'),
    unlockVault(clean, '9999', 'setup'),
  ]);
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  await unlockVault(clean, '0042', 'unlock');
});
test('legacy numeric IDs migrate without loss; invalid schemas are not overwritten', async () => {
  const s = new MemoryStore();
  s.setItem(LEGACY_LOG_KEY, JSON.stringify([sample(123)]));
  assert.deepEqual((await unlockVault(s, '0042', 'setup')).logs, [
    sample('123'),
  ]);
  const invalid = new MemoryStore();
  invalid.setItem(LEGACY_LOG_KEY, '{"unexpected":true}');
  await assert.rejects(unlockVault(invalid, '0042', 'setup'), /日志格式异常/);
  assert.equal(invalid.getItem(VAULT_KEY), null);
  assert.equal(invalid.getItem(LEGACY_LOG_KEY), '{"unexpected":true}');
});
