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
export const LIMIT = 16 * 1024 * 1024;
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
      '日志文件格式不受支持，未修改原文件。',
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
export const serialize = (logs: MoodLog[]) =>
  JSON.stringify({ format: 'emotion-logs', version: 1, logs }, null, 2);
