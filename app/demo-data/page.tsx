'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { localLogFile, fileError } from '@/lib/local-file';
import { previousWeekDemoLogs } from '@/lib/demo-logs';

export default function DemoDataPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const running = useRef(false);
  return (
    <main className="min-h-screen bg-[#F5F3EF] text-[#1F2937]">
      <div className="app-shell">
        <a className="back-link" href="#home">
          ← 返回首页
        </a>
        <h1 className="page-title">近一周模拟数据</h1>
        <section className="card detail-section">
          <p className="detail-text">
            添加今天之前 7
            天、每天一条的模拟日志，包含不同情绪、变化幅度、认知扭曲和积极回应。所有记录标注“模拟数据”，会参与历史与分析展示，可在历史记录中逐条删除。
          </p>
          <p className="detail-text">
            请先在首页新建或打开日志文件；仅在你点击后写入明文模拟记录，不重复导入相同日期的数据。
          </p>
          <Button
            className="save-button"
            disabled={busy || done}
            onClick={async () => {
              if (running.current) return;
              running.current = true;
              setBusy(true);
              setMessage('');
              try {
                const logs = previousWeekDemoLogs();
                let added = 0;
                await localLogFile.update((existing) => {
                  const pending = logs.filter(
                    (log) => !existing.some((item) => item.id === log.id),
                  );
                  added = pending.length;
                  return [...existing, ...pending];
                });
                const date = (ts: string) =>
                  new Date(ts).toLocaleDateString('zh-CN');
                setMessage(
                  `已保存 ${added} 条模拟日志（${date(logs[0].ts)} 至 ${date(logs[6].ts)}）。${7 - added} 条已有模拟日志未重复添加。`,
                );
                setDone(true);
              } catch (e) {
                setMessage(fileError(e));
              } finally {
                running.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? '写入文件中…' : '添加此前一周模拟数据'}
          </Button>
          {message && <output className="notice">{message}</output>}
        </section>
      </div>
    </main>
  );
}
