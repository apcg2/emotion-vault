import { mkdir, lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { LIMIT, parseLogDocument, serialize } from '../lib/log-document.ts';

export const revisionOf = (text) =>
  createHash('sha256').update(text).digest('hex');
export class DataError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}
async function regular(path, directory = false) {
  const stat = await lstat(path);
  if (
    stat.isSymbolicLink() ||
    !(directory ? stat.isDirectory() : stat.isFile())
  )
    throw new DataError('数据路径不能是链接或特殊文件，请检查 data 目录。');
  return stat;
}
async function exclusiveFile(path, text) {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(text, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
}
export async function openStore(directory) {
  const dir = resolve(directory),
    path = join(dir, 'logs.json'),
    lock = join(dir, '.server.lock');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await regular(dir, true);
  const lockId = JSON.stringify({ pid: process.pid, id: randomUUID() });
  try {
    await exclusiveFile(lock, lockId);
  } catch (e) {
    if (e.code === 'EEXIST')
      throw new DataError(
        'data 目录已锁定。请先关闭原服务；异常退出后的处理方法见 README，不会自动删除锁或日志。',
      );
    throw e;
  }
  let queue = Promise.resolve(),
    closed = false,
    initialized = false,
    closing;
  const release = async () => {
    if ((await readFile(lock, 'utf8')) === lockId) await unlink(lock);
  };
  const read = async () => {
    await regular(dir, true);
    const info = await regular(path);
    if (info.size > LIMIT)
      throw new DataError('日志文件超过 16 MB，未修改数据。');
    const text = await readFile(path, 'utf8');
    try {
      return {
        text,
        logs: parseLogDocument(text).logs,
        revision: revisionOf(text),
      };
    } catch {
      throw new DataError(
        '日志文件损坏或格式不支持，已停止读写。请保留原文件，检查 data/backups 中的备份。',
      );
    }
  };
  try {
    try {
      await regular(path);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      try {
        await exclusiveFile(path, serialize([]));
      } catch (created) {
        if (created.code !== 'EEXIST') throw created;
      }
    }
    await read();
    initialized = true;
  } finally {
    if (!initialized) await release();
  }
  const serial = (fn) => {
    if (closed) return Promise.reject(new DataError('服务正在关闭。', 503));
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const save = async (current, logs) => {
    const text = serialize(logs.sort((a, b) => b.ts.localeCompare(a.ts)));
    try {
      parseLogDocument(text);
    } catch {
      throw new DataError('日志字段无效或总大小超过限制。', 400);
    }
    if (text === current.text) return current;
    const backups = join(dir, 'backups');
    await mkdir(backups, { recursive: true, mode: 0o700 });
    await regular(backups, true);
    const temp = join(dir, '.logs-' + randomUUID() + '.tmp');
    try {
      await exclusiveFile(
        join(backups, 'logs-' + Date.now() + '-' + randomUUID() + '.json'),
        current.text,
      );
      await exclusiveFile(temp, text);
      if ((await read()).revision !== current.revision)
        throw new DataError(
          '日志文件已被外部程序修改，本次未覆盖。请刷新后重试。',
          409,
        );
      await rename(temp, path);
      const result = await read();
      if (result.text !== text)
        throw new DataError('无法确认保存结果，请刷新核对后再操作。');
      return result;
    } finally {
      await unlink(temp).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    }
  };
  return {
    path,
    read: () => serial(read),
    append: (log) =>
      serial(async () => {
        try {
          parseLogDocument(serialize([log]));
        } catch {
          throw new DataError('日志字段无效。', 400);
        }
        const current = await read(),
          prior = current.logs.find((item) => item.id === log.id);
        if (prior) {
          if (JSON.stringify(prior) === JSON.stringify(log)) return current;
          throw new DataError('日志编号冲突，未覆盖原记录。', 409);
        }
        return save(current, [...current.logs, log]);
      }),
    remove: (id, revision) =>
      serial(async () => {
        const current = await read();
        if (revision !== current.revision)
          throw new DataError('记录已发生变化，请刷新后再确认删除。', 409);
        return save(
          current,
          current.logs.filter((log) => log.id !== id),
        );
      }),
    demo: (logs) =>
      serial(async () => {
        try {
          parseLogDocument(serialize(logs));
        } catch {
          throw new DataError('模拟数据格式错误。', 400);
        }
        if (
          !logs.every(
            (log) =>
              log.id.startsWith('moodflow-demo-v1-') &&
              log.situation.startsWith('【模拟数据】'),
          )
        )
          throw new DataError('只允许明确标注的模拟记录。', 400);
        const current = await read();
        return save(current, [
          ...current.logs,
          ...logs.filter(
            (log) => !current.logs.some((item) => item.id === log.id),
          ),
        ]);
      }),
    close() {
      closed = true;
      closing ??= queue.then(release);
      return closing;
    },
  };
}
