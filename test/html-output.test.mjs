import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { buildHtml } from '../scripts/build-html.mjs';

void test('build produces one offline HTML in a Unicode/spaces path, with no module or external assets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'emotion-html-中文 空格-'));
  try {
    const target = await buildHtml(dir);
    assert.deepEqual(await readdir(dir), ['emotion-vault.html']);
    const html = await readFile(target, 'utf8');
    assert.match(html, /<title>情绪知了<\/title>/);
    assert.match(html, /href="data:image\/svg\+xml;base64,/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /id="third-party-notices" hidden/);
    assert.match(html, /Permission is hereby granted/);
    for (const name of [
      'react@19',
      'recharts@3',
      '@base-ui/react@1',
      'tailwindcss@4',
      'lucide-react@',
    ])
      assert.ok(html.includes(name), `Missing license: ${name}`);
    assert.doesNotMatch(
      html,
      /<(?:script|link)\b[^>]*(?:src|href)=["'](?!data:)[^"']+["']/i,
    );
    assert.doesNotMatch(html, /<script[^>]*type=["']module/);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new Script(scripts[0][1]));
    const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1])
      .join('\n');
    assert.ok(css.length > 1000);
    assert.doesNotMatch(css, /@import\b|url\(\s*["']?(?!data:)[^\s"')]/i);
    for (const text of [
      '记录情绪日志',
      '历史记录',
      '情绪分析',
      '认知扭曲',
      '新建日志文件',
      '打开日志文件',
      'emotion-logs',
      '#demo-data',
    ])
      assert.ok(html.includes(text), text);
    assert.ok(Buffer.byteLength(html) < 2 * 1024 * 1024);
    assert.doesNotMatch(
      scripts[0][1],
      /localStorage|sessionStorage|indexedDB|moodflow_encrypted_vault|PBKDF2|RSA-OAEP|设置四位数字密码/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true }); // Only this test's mkdtemp directory.
  }
});
