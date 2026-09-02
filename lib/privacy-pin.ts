export const PRIVACY_PIN_KEY = 'moodflow_privacy_pin_v1';
const ITERATIONS = 210_000;
export type PinCredential = {
  version: 1;
  salt: string;
  hash: string;
};

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) =>
  Uint8Array.from(value.match(/.{2}/g) || [], (byte) =>
    Number.parseInt(byte, 16),
  );
export const isValidPin = (pin: string) => /^[0-9]{4}$/.test(pin);

export function readPinCredential(
  storage: Pick<Storage, 'getItem'>,
): PinCredential | null {
  const raw = storage.getItem(PRIVACY_PIN_KEY);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object')
    throw new Error('Invalid PIN credential');
  const credential = value as Partial<PinCredential>;
  if (
    credential.version !== 1 ||
    typeof credential.salt !== 'string' ||
    !/^[a-f0-9]{32}$/.test(credential.salt) ||
    typeof credential.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(credential.hash)
  )
    throw new Error('Invalid PIN credential');
  return credential as PinCredential;
}

async function derivePin(pin: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: unhex(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    256,
  );
  return hex(new Uint8Array(bits));
}

export async function createPinCredential(pin: string): Promise<PinCredential> {
  if (!isValidPin(pin)) throw new Error('PIN must contain four digits');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { version: 1, salt, hash: await derivePin(pin, salt) };
}

export async function verifyPin(
  pin: string,
  credential: PinCredential,
): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const hash = await derivePin(pin, credential.salt);
  let mismatch = hash.length ^ credential.hash.length;
  for (let i = 0; i < hash.length; i++)
    mismatch |= hash.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  return mismatch === 0;
}
