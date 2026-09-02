import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: '情绪知了',
  description: '本地运行的伯恩斯五步情绪日志与趋势分析。',
  openGraph: { title: '情绪知了', description: '记录情绪，观察变化。', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
