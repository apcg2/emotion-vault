import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const APP_URL = 'http://localhost:3001/';
export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

export function checkRuntime(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    major < 22 ||
    (major === 22 && minor < 13)
  ) {
    throw new Error(
      `Node.js ${version} 版本过低，请安装 Node.js 24（项目已验证 24.16.0）。`,
    );
  }
}

export function serverCommand(root = PROJECT_ROOT) {
  const cli = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const config = join(root, 'dist', 'server', 'wrangler.json');
  if (!existsSync(join(root, 'package.json')))
    throw new Error(
      '未找到项目，请将启动文件留在原项目文件夹内，不要单独移出。',
    );
  if (!existsSync(cli))
    throw new Error(
      '尚未完成首次安装。请在项目文件夹运行 npm ci，再运行 npm run build，然后重新双击启动文件。',
    );
  if (!existsSync(config))
    throw new Error(
      '尚未完成首次构建。请在项目文件夹运行 npm run build，然后重新双击启动文件。',
    );
  // Invoke Node directly: no npm.cmd shell quoting, global CLI, or package download.
  return {
    command: process.execPath,
    args: [
      cli,
      'dev',
      '--config',
      config,
      '--ip',
      '127.0.0.1',
      '--port',
      '3001',
    ],
    cwd: root,
  };
}

export function probeServer(url = APP_URL, timeoutMs = 1500) {
  return new Promise((resolveProbe) => {
    let settled = false;
    const finish = (state) => {
      if (!settled) {
        settled = true;
        resolveProbe(state);
      }
    };
    const request = http.get(url, { agent: false }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 512_000) {
          finish('occupied');
          response.destroy();
        }
      });
      response.on('end', () =>
        finish(
          response.statusCode === 200 &&
            /<title>\s*情绪知了\s*<\/title>/i.test(body)
            ? 'app'
            : 'occupied',
        ),
      );
      response.on('error', () => finish('occupied'));
      response.on('aborted', () => finish('occupied'));
    });
    request.setTimeout(timeoutMs, () => {
      finish('occupied');
      request.destroy();
    });
    request.on('error', (error) =>
      finish(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'),
    );
  });
}

export function browserCommand(platform = process.platform) {
  if (platform === 'darwin')
    return { command: '/usr/bin/open', args: [APP_URL] };
  // The empty title is required by Windows start; the URL is a constant, not user input.
  if (platform === 'win32')
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/c', 'start', '', APP_URL],
    };
  return { command: 'xdg-open', args: [APP_URL] };
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolveRun() : reject(new Error(`退出码 ${code}`)),
    );
  });
}

async function openBrowser(enabled) {
  if (!enabled) return;
  try {
    const { command, args } = browserCommand();
    await run(command, args);
  } catch {
    console.log(
      `浏览器未能自动打开，请手动访问 ${APP_URL}（本地服务不受影响）。`,
    );
  }
}

export async function waitUntilReady({
  probe = probeServer,
  exited = () => false,
  stopping = () => false,
  timeoutMs = 60_000,
  intervalMs = 300,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopping()) return false;
    if (exited())
      throw new Error(
        '本地服务启动失败，请查看窗口中的错误信息。不会自动切换端口或关闭其他程序。',
      );
    if ((await probe()) === 'app') {
      if (exited()) throw new Error('本地服务已退出，请重新启动。');
      return true;
    }
    await delay(intervalMs);
  }
  throw new Error(
    '等待本地服务超过 60 秒，已停止本次启动。请查看错误信息后重试；不要反复安装或更改端口。',
  );
}

export async function launch({ open = true } = {}) {
  checkRuntime();
  console.log('情绪知了 · 本地启动');
  console.log(`项目位置：${PROJECT_ROOT}`);
  const existing = await probeServer();
  if (existing === 'app') {
    console.log(`网页已在运行，直接打开 ${APP_URL}`);
    await openBrowser(open);
    return;
  }
  if (existing === 'occupied')
    throw new Error(
      '端口 3001 已被其他程序占用，或服务正在启动但尚未就绪。请稍后重试；不会关闭其他程序，也不会换地址。',
    );

  const { command, args, cwd } = serverCommand();
  console.log('正在启动，请稍候…');
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: process.platform !== 'win32',
    windowsHide: true,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_WRITE_LOGS: 'false',
      WRANGLER_LOG_PATH: join(cwd, '.wrangler', 'logs'),
      MINIFLARE_REGISTRY_PATH: join(cwd, '.wrangler', 'registry'),
    },
  });
  let ended = false;
  let failure;
  let stopping = false;
  let stopPromise;
  const closed = new Promise((resolveClosed) => {
    child.once('error', (error) => {
      ended = true;
      failure = error;
      resolveClosed(1);
    });
    child.once('exit', (code) => {
      ended = true;
      resolveClosed(code ?? 0);
    });
  });
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = (async () => {
      if (ended || !child.pid) return;
      if (process.platform === 'win32') {
        // Only terminate the process tree created by this launcher, never a process found on a port.
        try {
          await run('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
        } catch {
          child.kill();
        }
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          /* Already stopped. */
        }
        let timer;
        await Promise.race([
          closed,
          new Promise((r) => {
            timer = setTimeout(r, 3000);
          }),
        ]);
        clearTimeout(timer);
        if (!ended) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            /* Already stopped. */
          }
        }
      }
      await closed;
    })();
    return stopPromise;
  };
  const onSignal = () => {
    void stop();
  };
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const signal of signals) process.on(signal, onSignal);
  try {
    const ready = await waitUntilReady({
      exited: () => ended,
      stopping: () => stopping,
    });
    if (ready && !stopping) {
      console.log(
        `\n已就绪：${APP_URL}\n请保留此窗口。停止服务请按 Ctrl+C；只关闭网页不会停止服务。\n请使用原来的浏览器查看已有日志，不需要重新设置密码。`,
      );
      await openBrowser(open);
    }
    const code = await closed;
    if (failure) throw failure;
    if (code !== 0 && !stopping)
      throw new Error(`本地服务异常退出（${code}），请查看上方提示。`);
  } finally {
    await stop();
    for (const signal of signals) process.off(signal, onSignal);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => flag !== '--no-open')) {
    console.error('用法：node scripts/launch.mjs [--no-open]');
    process.exitCode = 1;
  } else {
    launch({ open: !flags.includes('--no-open') }).catch((error) => {
      console.error(`\n启动未完成：${error.message}`);
      process.exitCode = 1;
    });
  }
}
