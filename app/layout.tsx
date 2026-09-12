import './styles.css';
export const metadata = { title: '오늘의 한국어', description: '个人韩语口语学习系统' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
