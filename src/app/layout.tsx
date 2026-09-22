import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bamboo Weave Studio",
  description: "Parametric bamboo weave pattern editor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
