'use client';

import React, { useEffect, useRef } from 'react';
import type { MoodLog } from '@/lib/local-file';

export function LogDetail({
  log,
  onBack,
}: {
  log: MoodLog;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <article className="log-detail">
      <button className="back-link" onClick={onBack}>
        ← 返回历史记录
      </button>
      <header>
        <h1 className="page-title" tabIndex={-1} ref={heading}>
          日志详情
        </h1>
        <p className="detail-meta">
          <time dateTime={log.ts}>
            {new Intl.DateTimeFormat('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date(log.ts))}
          </time>
          <span>只读</span>
        </p>
      </header>
      <section className="card detail-section">
        <h2>1 · 情境</h2>
        <p className="detail-text">{log.situation || '未填写'}</p>
      </section>
      <section className="card detail-section">
        <h2>2 · 情绪与变化</h2>
        {log.emotions.length ? (
          <ul className="detail-emotions">
            {log.emotions.map((emotion, i) => (
              <li key={`${emotion.name}-${i}`}>
                <div>
                  <strong>{emotion.name}</strong>
                  <small>{emotion.category}</small>
                </div>
                <p>
                  之前 {emotion.before}% → 之后 {emotion.after}%
                </p>
                <span>
                  {emotion.after < emotion.before
                    ? `降低 ${emotion.before - emotion.after}%`
                    : emotion.after > emotion.before
                      ? `升高 ${emotion.after - emotion.before}%`
                      : '持平'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-text">未记录情绪</p>
        )}
      </section>
      <section className="card detail-section">
        <h2>3 · 自动思维</h2>
        <p className="detail-text">{log.thoughts || '未填写'}</p>
      </section>
      <section className="card detail-section">
        <h2>4 · 认知扭曲</h2>
        {log.distortions.length ? (
          <ul className="detail-tags">
            {log.distortions.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="detail-text">未选择</p>
        )}
      </section>
      <section className="card detail-section">
        <h2>5 · 积极回应</h2>
        {log.responses.length ? (
          <ol className="detail-responses">
            {log.responses.map((response, i) => (
              <li key={i}>
                <p className="detail-text">{response.text || '未填写'}</p>
                <small>相信程度 {response.belief}%</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-text">未填写</p>
        )}
      </section>
    </article>
  );
}
