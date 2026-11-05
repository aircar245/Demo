import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { QueryProvider } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

// 注：暂用系统字体栈（globals.css 中定义），避免服务器无法访问 Google Fonts。
// 阶段1 确定 Figma 指定字体后，再换成本地字体文件或可访问的字体源。

export const metadata: Metadata = {
  title: "CNSS 2026",
  description: "CNSS 2026 CTF 竞赛平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" style={{ backgroundColor: 'var(--ow-bg)', color: 'var(--ow-text)' }}>
        <QueryProvider>
          <ThemeProvider />
          <Navbar />
          <main className="flex-1">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
