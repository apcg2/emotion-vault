export type MoodLog = {
  id: string;
  ts: string;
  situation: string;
  thoughts: string;
  emotions: { name: string; category: string; before: number; after: number }[];
  distortions: string[];
  responses: { text: string; belief: number }[];
};
export type LogDocument = {
  format: 'emotion-logs';
  version: 1;
  logs: MoodLog[];
};
export type LogFileHandle = {
  name: string;
  getFile(): Promise<{ size: number; text(): Promise<string> }>;
  createWritable(options: {
    mode: 'exclusive';
    keepExistingData: false;
  }): Promise<{
    write(text: string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
};
const LIMIT = 16 * 1024 * 1024;
export const fileError = (error: unknown) =>
  error instanceof Error ? error.message : '文件操作失败，请重试。';
export function parseLogDocument(text: string): LogDocument {
  if (new TextEncoder().encode(text).byteLength > LIMIT)
    throw new Error('日志文件不能超过 16 MB。');
  let doc: LogDocument;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效 JSON，未修改原文件。');
  }
  const score = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
  if (
    !doc ||
    doc.format !== 'emotion-logs' ||
    doc.version !== 1 ||
    !Array.isArray(doc.logs)
  )
    throw new Error(
      '请选择新版明文日志文件；不支持旧版加密数据，也不会自动迁移。',
    );
  for (const log of doc.logs) {
    if (
      !log ||
      typeof log.id !== 'string' ||
      !log.id ||
      typeof log.ts !== 'string' ||
      !Number.isFinite(Date.parse(log.ts)) ||
      typeof log.situation !== 'string' ||
      typeof log.thoughts !== 'string' ||
      !Array.isArray(log.emotions) ||
      !log.emotions.every(
        (e) =>
          e &&
          typeof e.name === 'string' &&
          typeof e.category === 'string' &&
          score(e.before) &&
          score(e.after),
      ) ||
      !Array.isArray(log.distortions) ||
      !log.distortions.every((d) => typeof d === 'string') ||
      !Array.isArray(log.responses) ||
      !log.responses.every(
        (r) => r && typeof r.text === 'string' && score(r.belief),
      )
    )
      throw new Error('日志字段格式异常，未修改原文件。');
  }
  if (new Set(doc.logs.map((log) => log.id)).size !== doc.logs.length)
    throw new Error('日志编号重复，未修改原文件。');
  return doc;
}
const serialize = (logs: MoodLog[]) =>
  JSON.stringify({ format: 'emotion-logs', version: 1, logs }, null, 2);
async function readText(handle: LogFileHandle) {
  const file = await handle.getFile();
  if (file.size > LIMIT) throw new Error('日志文件不能超过 16 MB。');
  return file.text();
}

/** Only the explicitly selected disk file is persistent. Never accesses browser storage. */
export class LocalLogFile {
  private handle: LogFileHandle | null = null;
  private baseline = '';
  private records: MoodLog[] = [];
  private busy = false;
  private uncertain = false;
  get name() {
    return this.handle?.name ?? '';
  }
  get isBusy() {
    return this.busy;
  }
  get logs() {
    return structuredClone(this.records);
  }
  private async exclusive<T>(fn: () => Promise<T>) {
    if (this.busy) throw new Error('文件操作进行中，请稍后再试。');
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
  async open(handle: LogFileHandle) {
    return this.exclusive(async () => {
      const text = await readText(handle);
      const doc = parseLogDocument(text);
      this.handle = handle;
      this.baseline = text;
      this.records = doc.logs;
      this.uncertain = false;
      return this.logs;
    });
  }
  async create(handle: LogFileHandle) {
    return this.exclusive(async () => {
      if (await readText(handle))
        throw new Error(
          '所选文件已有内容。为防止覆盖，请选择新文件名，或使用“打开日志文件”。',
        );
      await this.write(handle, '', []);
      this.handle = handle;
      this.baseline = serialize([]);
      this.records = [];
      this.uncertain = false;
      return this.logs;
    });
  }
  private async write(
    handle: LogFileHandle,
    expected: string,
    logs: MoodLog[],
  ) {
    const text = serialize(logs);
    parseLogDocument(text);
    // Exclusive disk writer plus revision comparison protects other app tabs and external edits.
    let writer;
    try {
      writer = await handle.createWritable({
        mode: 'exclusive',
        keepExistingData: false,
      });
    } catch {
      throw new Error(
        '未获得文件写入权限，或文件正被其他页面使用。请允许保存并关闭其他编辑页面后重试。',
      );
    }
    let closing = false;
    try {
      if ((await readText(handle)) !== expected)
        throw new Error(
          '文件已被其他页面或程序修改，本次未覆盖。请重新打开文件后再操作。',
        );
      await writer.write(text);
      if ((await readText(handle)) !== expected)
        throw new Error('写入期间文件发生变化，本次未覆盖。请重新打开文件。');
      closing = true;
      await writer.close();
      if ((await readText(handle)) !== text)
        throw new Error('文件保存结果无法确认。');
    } catch (error) {
      try {
        await writer.abort();
      } catch {
        /* Already closed or failed stream. */
      }
      if (closing) {
        this.uncertain = true;
        throw new Error(
          '无法确认保存结果，请保留当前页面并检查磁盘文件；重新打开文件后再继续，勿直接重复保存。',
        );
      }
      throw error;
    }
  }
  async update(change: (logs: MoodLog[]) => MoodLog[]) {
    return this.exclusive(async () => {
      if (!this.handle) throw new Error('请先新建或打开一个本地日志文件。');
      if (this.uncertain)
        throw new Error('上次保存结果待确认，请先重新打开日志文件。');
      const next = change(this.logs).sort((a, b) => b.ts.localeCompare(a.ts));
      await this.write(this.handle, this.baseline, next);
      this.records = next;
      this.baseline = serialize(next);
      return this.logs;
    });
  }
  async append(log: MoodLog) {
    return this.update((logs) => {
      if (logs.some((item) => item.id === log.id))
        throw new Error('记录已存在，请勿重复保存。');
      return [log, ...logs];
    });
  }
  async remove(id: string) {
    return this.update((logs) => logs.filter((log) => log.id !== id));
  }
  exportText() {
    if (!this.handle) throw new Error('请先打开日志文件。');
    return serialize(this.records);
  }
}
export const localLogFile = new LocalLogFile();

type Pickers = {
  showOpenFilePicker?: (options: object) => Promise<LogFileHandle[]>;
  showSaveFilePicker?: (options: object) => Promise<LogFileHandle>;
};
export function supportsLocalFiles() {
  const w = window as Window & Pickers;
  return !!w.showOpenFilePicker && !!w.showSaveFilePicker;
}
export async function chooseLogFile(create: boolean) {
  const w = window as Window & Pickers;
  if (!supportsLocalFiles())
    throw new Error(
      '此浏览器不支持直接保存本地文件。请用最新版桌面 Chrome 或 Edge 打开 HTML。不会改用浏览器存储。',
    );
  const options = {
    types: [
      {
        description: '情绪日志 JSON',
        accept: { 'application/json': ['.json'] },
      },
    ],
    excludeAcceptAllOption: true,
  };
  // Picker must run directly from a user click, before any asynchronous file processing.
  if (create)
    return w.showSaveFilePicker!({
      ...options,
      suggestedName: 'emotion-logs.json',
    });
  const [handle] = await w.showOpenFilePicker!({ ...options, multiple: false });
  return handle;
}
