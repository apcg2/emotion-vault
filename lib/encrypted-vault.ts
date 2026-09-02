import {
  isValidPin,
  PRIVACY_PIN_KEY,
  readPinCredential,
  verifyPin,
} from './privacy-pin';

export const VAULT_KEY = 'moodflow_encrypted_vault_v1';
export const LEGACY_LOG_KEY = 'moodflow_logs';
const ITERATIONS = 600_000;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type MoodLog = {
  id: string;
  ts: string;
  situation: string;
  thoughts: string;
  emotions: { name: string; category: string; before: number; after: number }[];
  distortions: string[];
  responses: { text: string; belief: number }[];
};
type Cipher = { iv: string; data: string };
type SealedLog = Cipher & { id: string; ts: string; key: string };
type Vault = {
  version: 1;
  id: string;
  salt: string;
  iterations: number;
  publicKey: string;
  privateKey: Cipher;
  records: SealedLog[];
  legacyDigest: string | null;
};
export type VaultSession = {
  id: string;
  privateKey: CryptoKey;
  logs: MoodLog[];
};
const encode = (s: string) => new TextEncoder().encode(s);
const b64 = (v: ArrayBuffer | Uint8Array) => {
  const bytes = new Uint8Array(v);
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const bytes = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const fail = (message: string): never => {
  throw new Error(message);
};
export const vaultError = (e: unknown) =>
  e instanceof Error ? e.message : '操作失败，请重试。';
export function assertEncryptionAvailable() {
  if (!globalThis.crypto?.subtle || !globalThis.navigator?.locks)
    fail(
      '此浏览器无法安全加密。请使用最新版 Chrome、Edge、Firefox 或 Safari，通过 localhost 或 HTTPS 打开。不会改为明文保存。',
    );
}
function readVault(storage: Store): Vault | null {
  const raw = storage.getItem(VAULT_KEY);
  if (raw === null) return null;
  let v: Vault;
  try {
    v = JSON.parse(raw);
  } catch {
    return fail('加密数据无法读取，请勿清除浏览器数据。');
  }
  if (
    !v ||
    v.version !== 1 ||
    typeof v.id !== 'string' ||
    typeof v.salt !== 'string' ||
    v.iterations !== ITERATIONS ||
    typeof v.publicKey !== 'string' ||
    typeof v.privateKey?.iv !== 'string' ||
    typeof v.privateKey?.data !== 'string' ||
    !Array.isArray(v.records) ||
    !v.records.every(
      (r) =>
        r &&
        ['id', 'ts', 'iv', 'data', 'key'].every(
          (k) => typeof r[k as keyof SealedLog] === 'string',
        ),
    ) ||
    new Set(v.records.map((r) => r.id)).size !== v.records.length ||
    !(v.legacyDigest === null || typeof v.legacyDigest === 'string')
  )
    return fail('加密数据格式异常，请勿清除浏览器数据。');
  return v;
}
function validateLogs(value: unknown): MoodLog[] {
  if (!Array.isArray(value)) return fail('日志格式异常，未修改原始数据。');
  const validScore = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
  for (const l of value) {
    if (
      !l ||
      !['string', 'number'].includes(typeof l.id) ||
      !String(l.id) ||
      typeof l.ts !== 'string' ||
      !Number.isFinite(Date.parse(l.ts)) ||
      typeof l.situation !== 'string' ||
      typeof l.thoughts !== 'string' ||
      !Array.isArray(l.emotions) ||
      !l.emotions.every(
        (e: MoodLog['emotions'][number]) =>
          e &&
          typeof e.name === 'string' &&
          typeof e.category === 'string' &&
          validScore(e.before) &&
          validScore(e.after),
      ) ||
      !Array.isArray(l.distortions) ||
      !l.distortions.every((d: unknown) => typeof d === 'string') ||
      !Array.isArray(l.responses) ||
      !l.responses.every(
        (r: MoodLog['responses'][number]) =>
          r && typeof r.text === 'string' && validScore(r.belief),
      )
    )
      return fail('日志格式异常，未修改原始数据。');
  }
  const logs = value.map((l) => ({ ...l, id: String(l.id) })) as MoodLog[];
  if (new Set(logs.map((l) => l.id)).size !== logs.length)
    return fail('日志编号重复，未修改原始数据。');
  return logs;
}
export function encryptionMode(storage: Store): 'setup' | 'unlock' {
  assertEncryptionAvailable();
  return readVault(storage) || readPinCredential(storage) ? 'unlock' : 'setup';
}
export function hasVault(storage: Store) {
  return !!readVault(storage);
}
export function calendarRecords(storage: Store): { ts: string }[] {
  const vault = readVault(storage);
  if (vault) return vault.records.map((r) => ({ ts: r.ts }));
  const raw = storage.getItem(LEGACY_LOG_KEY);
  return (raw === null ? [] : validateLogs(JSON.parse(raw))).map((r) => ({
    ts: r.ts,
  }));
}
async function pinKey(pin: string, salt: string) {
  const material = await crypto.subtle.importKey(
    'raw',
    encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: bytes(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function seal(
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
  context: string,
): Promise<Cipher> {
  const iv = random(12);
  return {
    iv: b64(iv),
    data: b64(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: encode(context) },
        key,
        data,
      ),
    ),
  };
}
async function unseal(key: CryptoKey, c: Cipher, context: string) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(c.iv), additionalData: encode(context) },
    key,
    bytes(c.data),
  );
}
const privateContext = (v: Vault) =>
  JSON.stringify(['moodflow-private-v1', v.id, v.publicKey]);
const recordContext = (v: Vault, r: { id: string; ts: string }) =>
  JSON.stringify(['moodflow-record-v1', v.id, r.id, r.ts]);
async function publicKey(v: Vault) {
  return crypto.subtle.importKey(
    'spki',
    bytes(v.publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['wrapKey'],
  );
}
async function sealLog(v: Vault, log: MoodLog): Promise<SealedLog> {
  validateLogs([log]);
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  // Only the calendar date is public; exact time stays inside the encrypted log.
  const d = new Date(log.ts);
  const meta = {
    id: log.id,
    ts: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`,
  };
  return {
    ...meta,
    ...(await seal(key, encode(JSON.stringify(log)), recordContext(v, meta))),
    key: b64(
      await crypto.subtle.wrapKey('raw', key, await publicKey(v), 'RSA-OAEP'),
    ),
  };
}
async function openLogs(v: Vault, privateKey: CryptoKey) {
  const logs: MoodLog[] = [];
  for (const record of v.records) {
    const key = await crypto.subtle.unwrapKey(
      'raw',
      bytes(record.key),
      privateKey,
      'RSA-OAEP',
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const [log] = validateLogs([
      JSON.parse(
        new TextDecoder().decode(
          await unseal(key, record, recordContext(v, record)),
        ),
      ),
    ]);
    if (log.id !== record.id) fail('记录校验失败。');
    logs.push(log);
  }
  return logs.sort((a, b) => b.ts.localeCompare(a.ts));
}
const digest = async (s: string) =>
  b64(await crypto.subtle.digest('SHA-256', encode(s)));
// All tabs of this origin share this lock; writes always reread the latest envelope.
async function exclusive<T>(fn: () => Promise<T>) {
  assertEncryptionAvailable();
  return navigator.locks.request('moodflow-encrypted-vault', fn);
}
function persist(storage: Store, vault: Vault) {
  const raw = JSON.stringify(vault);
  try {
    storage.setItem(VAULT_KEY, raw);
  } catch {
    return fail(
      '保存失败：本地空间不足或存储被禁用。原有记录未覆盖，请保留当前页面。',
    );
  }
  if (storage.getItem(VAULT_KEY) !== raw)
    fail('保存校验失败，请保留当前页面。');
}
async function finishMigration(storage: Store, v: Vault) {
  const raw = storage.getItem(LEGACY_LOG_KEY);
  if (raw !== null) {
    if (!v.legacyDigest || (await digest(raw)) !== v.legacyDigest)
      fail(
        '检测到旧页面新增的明文日志。为避免丢失，已保留所有数据，请关闭旧页面并处理迁移冲突。',
      );
    if (storage.getItem(LEGACY_LOG_KEY) !== raw)
      fail('旧页面正在修改日志，已保留原数据，请关闭旧页面后重试。');
    storage.removeItem(LEGACY_LOG_KEY);
  }
  storage.removeItem(PRIVACY_PIN_KEY);
}
export async function unlockVault(
  storage: Store,
  pin: string,
  expectedMode: 'setup' | 'unlock',
  active = () => true,
): Promise<VaultSession> {
  if (!isValidPin(pin)) return fail('请输入四位数字密码。');
  return exclusive(async () => {
    if (!active()) return fail('操作已取消。');
    if (encryptionMode(storage) !== expectedMode)
      fail('密码状态已变化，请关闭弹窗后重新进入。');
    let v = readVault(storage);
    let privateKey: CryptoKey;
    if (v) {
      try {
        const raw = await unseal(
          await pinKey(pin, v.salt),
          v.privateKey,
          privateContext(v),
        );
        privateKey = await crypto.subtle.importKey(
          'pkcs8',
          raw,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['unwrapKey'],
        );
      } catch {
        return fail(
          '密码不正确，或加密数据已损坏。请重试；不要清除浏览器数据。',
        );
      }
    } else {
      const legacyPin = readPinCredential(storage);
      if (legacyPin && !(await verifyPin(pin, legacyPin)))
        return fail('密码不正确，请重新输入。');
      const legacyRaw = storage.getItem(LEGACY_LOG_KEY);
      const logs =
        legacyRaw === null ? [] : validateLogs(JSON.parse(legacyRaw));
      const pair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['wrapKey', 'unwrapKey'],
      );
      v = {
        version: 1,
        id: crypto.randomUUID(),
        salt: b64(random(16)),
        iterations: ITERATIONS,
        publicKey: b64(await crypto.subtle.exportKey('spki', pair.publicKey)),
        privateKey: { iv: '', data: '' },
        records: [],
        legacyDigest: legacyRaw === null ? null : await digest(legacyRaw),
      };
      const rawPrivate = await crypto.subtle.exportKey(
        'pkcs8',
        pair.privateKey,
      );
      v.privateKey = await seal(
        await pinKey(pin, v.salt),
        new Uint8Array(rawPrivate),
        privateContext(v),
      );
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        await unseal(
          await pinKey(pin, v.salt),
          v.privateKey,
          privateContext(v),
        ),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['unwrapKey'],
      );
      for (const log of logs) v.records.push(await sealLog(v, log));
      const verified = await openLogs(v, privateKey);
      if (verified.length !== logs.length) fail('迁移校验失败，已保留旧数据。');
      if (!active()) return fail('操作已取消。');
      if (
        readVault(storage) ||
        storage.getItem(LEGACY_LOG_KEY) !== legacyRaw ||
        JSON.stringify(readPinCredential(storage)) !== JSON.stringify(legacyPin)
      )
        return fail('旧页面的数据发生变化，请关闭旧页面后重试。');
      persist(storage, v); // Atomic single-key write before removing any plaintext.
    }
    let logs: MoodLog[];
    try {
      logs = await openLogs(v, privateKey);
    } catch {
      return fail('记录解密校验失败，未删除或覆盖任何日志。');
    }
    if (!active()) return fail('操作已取消。');
    await finishMigration(storage, v);
    return { id: v.id, privateKey, logs };
  });
}
export async function appendLog(storage: Store, log: MoodLog) {
  return exclusive(async () => {
    const v = readVault(storage);
    if (!v) return fail('请先设置加密密码，再保存日志。');
    if (
      storage.getItem(LEGACY_LOG_KEY) !== null ||
      storage.getItem(PRIVACY_PIN_KEY) !== null
    )
      return fail('旧数据迁移尚未完成，请先解锁历史记录后再保存。');
    if (v.records.some((r) => r.id === log.id))
      return fail('此记录已存在，请勿重复保存。');
    v.records.push(await sealLog(v, log));
    persist(storage, v);
  });
}
export async function deleteLog(
  storage: Store,
  session: VaultSession,
  id: string,
) {
  return exclusive(async () => {
    const v = readVault(storage);
    if (!v || v.id !== session.id) return fail('加密状态已变化，请重新解锁。');
    // Authenticate all current records before a destructive operation.
    const logs = await openLogs(v, session.privateKey);
    v.records = v.records.filter((r) => r.id !== id);
    persist(storage, v);
    return logs.filter((r) => r.id !== id);
  });
}

/** Atomic, repeatable import of explicitly marked sample records only. */
export async function importDemoLogs(storage: Store, logs: MoodLog[]) {
  validateLogs(logs);
  if (
    !logs.every(
      (log) =>
        log.id.startsWith('moodflow-demo-v1-') &&
        log.situation.startsWith('【模拟数据】'),
    )
  )
    return fail('只允许导入明确标注的模拟日志。');
  return exclusive(async () => {
    const v = readVault(storage);
    if (
      !v ||
      storage.getItem(LEGACY_LOG_KEY) !== null ||
      storage.getItem(PRIVACY_PIN_KEY) !== null
    )
      return fail(
        '请先返回首页，输入密码完成加密初始化或旧数据迁移，再导入模拟数据。',
      );
    const pending = logs.filter(
      (log) => !v.records.some((record) => record.id === log.id),
    );
    for (const log of pending) v.records.push(await sealLog(v, log));
    if (pending.length) persist(storage, v);
    return pending.length;
  });
}
