import { type MoodLog, parseLogDocument, serialize } from './log-document.ts';

/** Memory-only connection. No browser persistence or fallback storage. */
export class ServerLogs {
  private token = '';
  private revision = '';
  private records: MoodLog[] = [];
  private pending = false;
  private connected = false;
  dataPath = '';
  private readonly fetcher: typeof fetch;
  constructor(fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.fetcher = fetcher;
  }
  get logs() {
    return structuredClone(this.records);
  }
  get isBusy() {
    return this.pending;
  }
  private async request(path: string, method = 'GET', body?: unknown) {
    const response = await this.fetcher(path, {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Emotion-Token': this.token,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || '本地服务请求失败。');
    return value;
  }
  private accept(value: { logs: MoodLog[]; revision: string }) {
    if (typeof value.revision !== 'string')
      throw new Error('本地服务返回了无效数据。');
    this.records = parseLogDocument(serialize(value.logs)).logs;
    this.revision = value.revision;
    return this.logs;
  }
  async load() {
    if (this.pending) throw new Error('正在保存，请稍候再重新读取。');
    this.connected = false;
    if (typeof location !== 'undefined' && location.protocol === 'file:')
      throw new Error(
        '请双击项目中的“启动.cmd”（Windows）或“启动.command”（Mac），不要直接打开 HTML。',
      );
    try {
      const session = await this.request('/api/session');
      if (
        typeof session.token !== 'string' ||
        typeof session.dataPath !== 'string'
      )
        throw new Error('服务信息无效。');
      this.token = session.token;
      this.dataPath = session.dataPath;
      const logs = this.accept(await this.request('/api/logs'));
      this.connected = true;
      return logs;
    } catch (e) {
      throw new Error(
        '无法读取本地日志，请确认启动窗口仍在运行，然后重新读取。' +
          (e instanceof Error ? e.message : ''),
      );
    }
  }
  private async write(path: string, method: string, body: unknown) {
    if (!this.connected)
      throw new Error('请先返回首页重新读取日志，核对上次操作结果后再继续。');
    if (this.pending) throw new Error('正在保存，请勿重复操作。');
    this.pending = true;
    try {
      return this.accept(await this.request(path, method, body));
    } catch (e) {
      // A lost response may follow a successful disk write. Never blindly retry.
      this.connected = false;
      throw new Error(
        (e instanceof Error ? e.message : '保存结果无法确认。') +
          ' 请保留当前内容，返回首页重新读取并核对记录后再操作。',
      );
    } finally {
      this.pending = false;
    }
  }
  append(log: MoodLog) {
    return this.write('/api/logs', 'POST', { log });
  }
  remove(id: string) {
    return this.write('/api/logs', 'DELETE', { id, revision: this.revision });
  }
  demo(logs: MoodLog[]) {
    return this.write('/api/demo', 'POST', { logs });
  }
  exportText() {
    return serialize(this.records);
  }
}
export const serverLogs = new ServerLogs();
