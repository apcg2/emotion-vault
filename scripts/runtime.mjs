import {
  readFile,
  mkdir,
  realpath,
  lstat,
  open,
  rename,
  unlink,
} from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
export function assertRuntime(version = process.versions.node) {
  if (Number(version.replace(/^v/, '').split('.')[0]) < 24)
    throw new Error(
      '需要 Node.js 24 或更高版本。请用 Node 24 的完整路径运行 scripts/configure-runtime.mjs，不必切换系统 Node。',
    );
}
export async function configuredNode(root) {
  let text;
  try {
    text = await readFile(resolve(root, '.local/node-path.txt'), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  const path = text.replace(/\r?\n$/, '');
  if (
    !isAbsolute(path) ||
    /[\r\n"]/.test(path) ||
    path.includes(String.fromCharCode(0))
  )
    throw new Error(
      '本机 Node 路径配置无效，请用 Node 24 重新运行 scripts/configure-runtime.mjs --replace。',
    );
  return path;
}
async function verify(path) {
  try {
    const { stdout } = await execute(path, ['--version'], {
      timeout: 5000,
      windowsHide: true,
    });
    if (!/^v\d+\.\d+\.\d+\s*$/.test(stdout)) throw new Error('Invalid version');
    assertRuntime(stdout.trim());
  } catch {
    throw new Error(
      '配置的 Node 不可用或版本不足。请用可独立运行的 Node 24 执行 scripts/configure-runtime.mjs --replace。',
    );
  }
}
export async function configureRuntime(root, { replace = false } = {}) {
  assertRuntime();
  const candidate = await realpath(process.execPath);
  if (/[\r\n"]/.test(candidate))
    throw new Error('Node 安装路径不能包含换行或双引号。');
  const dir = resolve(root, '.local'),
    target = resolve(dir, 'node-path.txt');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (!(await lstat(dir)).isDirectory())
    throw new Error('.local 必须是普通目录，不能是符号链接。');
  try {
    if (!(await lstat(target)).isFile())
      throw new Error('Node 配置不能是符号链接或特殊文件。');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const existing = replace ? undefined : await configuredNode(root);
  const selected = existing || candidate;
  await verify(selected);
  if (!existing) {
    const temp = resolve(dir, '.node-path-' + randomUUID() + '.tmp');
    try {
      const file = await open(temp, 'wx', 0o600);
      try {
        await file.writeFile(selected + '\n', 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temp, target);
    } finally {
      await unlink(temp).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    }
  }
  console.log('项目 Node 已固定为：' + selected);
  console.log(
    '配置仅保存在本机 .local/node-path.txt，不修改系统 PATH，也不上传 GitHub。',
  );
  return selected;
}
