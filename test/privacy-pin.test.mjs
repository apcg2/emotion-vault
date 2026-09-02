import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPinCredential,
  isValidPin,
  PRIVACY_PIN_KEY,
  readPinCredential,
  verifyPin,
} from '../lib/privacy-pin.ts';

void test('only exactly four numeric digits are accepted, including leading zeroes', () => {
  assert.equal(isValidPin('0042'), true);
  for (const value of ['', '123', '12345', '12a4', ' 1234', '１２３４'])
    assert.equal(isValidPin(value), false);
});

void test('credential persists without the plain PIN; valid and wrong PINs differ', async () => {
  const credential = await createPinCredential('0042');
  const saved = new Map([[PRIVACY_PIN_KEY, JSON.stringify(credential)]]);
  const restored = readPinCredential({
    getItem: (key) => saved.get(key) ?? null,
  });
  assert.deepEqual(Object.keys(restored).sort(), ['hash', 'salt', 'version']);
  assert.equal(restored.salt.length, 32);
  assert.equal(restored.hash.length, 64);
  assert.equal(await verifyPin('0042', restored), true);
  assert.equal(await verifyPin('0043', restored), false);
  assert.equal(await verifyPin('42', restored), false);
});

void test('the same PIN uses a fresh salt for each setup', async () => {
  const first = await createPinCredential('1234');
  const second = await createPinCredential('1234');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  await assert.rejects(createPinCredential('abc1'));
});

void test('only absence starts setup; malformed or inaccessible storage fails closed', () => {
  assert.equal(readPinCredential({ getItem: () => null }), null);
  for (const raw of [
    '',
    'broken',
    'null',
    '{}',
    '{"version":2}',
    '{"version":1,"salt":"bad","hash":"bad"}',
  ]) {
    assert.throws(() => readPinCredential({ getItem: () => raw }));
  }
  assert.throws(() =>
    readPinCredential({
      getItem: () => {
        throw new Error('Storage denied');
      },
    }),
  );
});
