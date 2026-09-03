import assert from 'node:assert/strict';
import test from 'node:test';
import { ServerLogs } from '../lib/server-client.ts';

const sample = {
  id: 'synthetic',
  ts: '2026-09-01T08:00:00Z',
  situation: '测试',
  thoughts: '',
  emotions: [],
  distortions: [],
  responses: [],
};
void test('client loads without picker and blocks blind retry after a lost write response', async () => {
  let writes = 0,
    saved = [],
    revision = 'one';
  const client = new ServerLogs(async (path, options) => {
    if (path === '/api/session')
      return Response.json({
        token: 'test-token',
        dataPath: '/synthetic/data/logs.json',
      });
    assert.equal(options.headers['X-Emotion-Token'], 'test-token');
    if (options.method === 'POST') {
      writes++;
      saved = [sample];
      revision = 'two';
      throw new Error('Lost response');
    }
    if (options.method === 'DELETE') {
      assert.equal(JSON.parse(options.body).revision, 'two');
      saved = [];
    }
    return Response.json({ logs: saved, revision });
  });
  assert.deepEqual(await client.load(), []);
  await assert.rejects(client.append(sample), /重新读取/);
  assert.deepEqual(client.logs, []);
  await assert.rejects(client.append(sample), /重新读取/);
  assert.equal(writes, 1);
  assert.deepEqual(await client.load(), [sample]);
  assert.deepEqual(await client.remove(sample.id), []);
});
void test('failed load retains last known snapshot but never allows writes', async () => {
  let fail = false;
  const client = new ServerLogs(async (path) => {
    if (fail) throw new Error('offline');
    return Response.json(
      path === '/api/session'
        ? { token: 'token', dataPath: '/test' }
        : { logs: [sample], revision: 'one' },
    );
  });
  await client.load();
  fail = true;
  await assert.rejects(client.load(), /无法读取/);
  assert.deepEqual(client.logs, [sample]);
  await assert.rejects(client.remove(sample.id), /重新读取/);
});
