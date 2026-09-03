import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureRuntime } from './runtime.mjs';

try {
  if (process.argv.slice(2).some((arg) => arg !== '--replace'))
    throw new Error('只支持 --replace 参数。');
  await configureRuntime(
    resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    { replace: process.argv.includes('--replace') },
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
