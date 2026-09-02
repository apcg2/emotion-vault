import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(
  new URL('../components/log-detail.tsx', import.meta.url),
  'utf8',
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(
    /from ['"]react['"]/g,
    `from ${JSON.stringify(import.meta.resolve('react'))}`,
  );
const { LogDetail } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const log = {
  id: 'synthetic',
  ts: '2026-09-02T08:00:00Z',
  situation: '测试情境',
  thoughts: '测试想法',
  emotions: [
    { name: '担忧', category: '焦虑', before: 80, after: 30 },
    { name: '愤怒', category: '愤怒', before: 20, after: 40 },
    { name: '其他', category: '其他', before: 50, after: 50 },
  ],
  distortions: ['心理过滤'],
  responses: [{ text: '测试回应', belief: 75 }],
};
const render = (value) =>
  renderToStaticMarkup(
    React.createElement(LogDetail, { log: value, onBack: () => {} }),
  );
void test('read-only detail contains all saved fields, all emotions, and no editing controls', () => {
  const html = render(log);
  for (const text of [
    '测试情境',
    '测试想法',
    '担忧',
    '焦虑',
    '心理过滤',
    '测试回应',
    '相信程度 75%',
    '降低 50%',
    '升高 20%',
    '持平',
    '只读',
    '返回历史记录',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(
    html,
    /<(input|textarea|select|form)\b|contenteditable|保存|编辑/,
  );
  assert.equal((html.match(/<button\b/g) || []).length, 1);
});
void test('empty fields are explicitly represented', () => {
  const html = render({
    ...log,
    situation: '',
    thoughts: '',
    emotions: [],
    distortions: [],
    responses: [],
  });
  assert.ok(html.includes('未记录情绪'));
  assert.ok(html.includes('未选择'));
  assert.equal((html.match(/未填写/g) || []).length, 3);
});
void test('saved text is escaped rather than interpreted as markup', () => {
  const html = render({
    ...log,
    situation: '<script>alert(1)</script>\n第二行',
  });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('第二行'));
  assert.doesNotMatch(html, /<script>/);
});
