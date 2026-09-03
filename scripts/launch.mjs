import { access, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { assertRuntime, configuredNode } from './runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? 'rundll32.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () =>
    console.log('无法自动打开浏览器，请手动访问：' + url),
  );
  child.unref();
}
async function main() {
  const configured = await configuredNode(root);
  if (configured) {
    let selected;
    try {
      selected = await realpath(configured);
    } catch {
      throw new Error(
        '配置的 Node 路径已失效，请用 Node 24 执行 scripts/configure-runtime.mjs --replace。',
      );
    }
    if (selected !== (await realpath(process.execPath))) {
      const child = spawn(
        selected,
        [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
        { stdio: 'inherit' },
      );
      const stop = (signal) => {
        child.kill(signal);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      try {
        process.exitCode = await new Promise((done, reject) => {
          child.once('error', reject);
          child.once('exit', (code) => done(code ?? 1));
        });
      } finally {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
      }
      return;
    }
  }
  assertRuntime();
  console.log(
    '运行环境：Node ' + process.versions.node + ' · ' + process.execPath,
  );
  if (
    process.argv.slice(2).some((arg) => !['--check', '--no-open'].includes(arg))
  )
    throw new Error('不支持的启动参数。');
  try {
    await access(resolve(root, 'dist/emotion-vault.html'));
  } catch {
    throw new Error(
      '尚未构建页面。请在项目目录执行 npm ci 和 npm run build，之后再双击启动文件。',
    );
  }
  if (process.argv.includes('--check')) {
    console.log('启动检查通过：Node.js 和已构建页面就绪。');
    return;
  }
  const { startServer, APP_ID, projectId } = await import('./server.mjs');
  const url = 'http://localhost:3001/';
  let running;
  try {
    const response = await fetch(url + 'api/health', {
      signal: AbortSignal.timeout(1200),
    });
    if (response.ok) running = await response.json();
  } catch {
    /* A free port is normal on first launch. */
  }
  if (running?.app === APP_ID && running.project === projectId(root)) {
    console.log('本项目已在运行：' + url);
    if (!process.argv.includes('--no-open')) openBrowser(url);
    return;
  }
  let app;
  try {
    app = await startServer();
  } catch (e) {
    if (e.code === 'EADDRINUSE')
      throw new Error(
        '端口 3001 已被其他程序占用。请确认并自行关闭占用程序后重试；不会自动结束任何进程。',
      );
    throw e;
  }
  console.log('情绪知了已启动：' + app.url);
  console.log('日志文件：' + app.dataPath);
  console.log(
    '使用时请保留此窗口。结束使用请按 Ctrl+C，等待保存完成后关闭窗口。',
  );
  console.log('日志与自动备份均为明文，请勿上传 data 目录。');
  const stop = () => {
    void app.close().then(
      () => {
        process.exitCode = 0;
      },
      (e) => {
        console.error(e.message);
        process.exitCode = 1;
      },
    );
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  if (!process.argv.includes('--no-open')) openBrowser(app.url);
}
try {
  await main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
