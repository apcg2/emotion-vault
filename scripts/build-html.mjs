import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildHtml(outDir = resolve(root, 'dist')) {
  const result = await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      copyPublicDir: false,
      cssCodeSplit: false,
      lib: {
        entry: resolve(root, 'app/main.tsx'),
        name: 'EmotionVault',
        formats: ['iife'],
      },
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap(
    (item) => item.output,
  );
  const scripts = output.filter((item) => item.type === 'chunk');
  const styles = output.filter(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
  );
  if (
    scripts.length !== 1 ||
    scripts[0].imports.length ||
    scripts[0].dynamicImports.length ||
    output.length !== scripts.length + styles.length
  ) {
    throw new Error(
      'Single-file build must not require external chunks or assets.',
    );
  }
  const script = scripts[0].code.replace(/<\/script/gi, '<\\/script');
  const css = styles
    .map((item) => String(item.source))
    .join('\n')
    .replace(/<\/style/gi, '<\\/style');
  const icon = await readFile(resolve(root, 'public/favicon.svg'));
  const template = await readFile(resolve(root, 'index.html'), 'utf8');
  const html = template
    .replace(
      '<head>',
      `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`,
    )
    .replace(
      'href="/favicon.svg"',
      `href="data:image/svg+xml;base64,${icon.toString('base64')}"`,
    )
    .replace('</head>', () => `<style>${css}</style>\n</head>`)
    .replace(
      '<script type="module" src="/app/main.tsx"></script>',
      () => `<script>${script}</script>`,
    );
  if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?!data:)[^"']+["']/i.test(html))
    throw new Error('External runtime resource remains in HTML.');
  await mkdir(outDir, { recursive: true });
  const target = resolve(outDir, 'emotion-vault.html');
  await writeFile(target, html);
  console.log(
    `Single-file HTML: ${target} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`,
  );
  return target;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await buildHtml();
}
