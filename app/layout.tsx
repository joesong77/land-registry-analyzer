import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '土地謄本清冊',
  description: '在瀏覽器本機解析台灣土地登記謄本，整理地主、持分與產權風險。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
