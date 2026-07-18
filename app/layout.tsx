import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhyMorph | Cause & Effect Lab",
  description:
    "GPT-5.6が学習テーマを、原因と結果を操作できる因果シミュレーションへ変換する教育アプリ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "WhyMorph | Cause & Effect Lab",
    description: "「なぜ？」を、操作できる学びへ。",
    images: ["/og.png"],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhyMorph | Cause & Effect Lab",
    description: "「なぜ？」を、操作できる学びへ。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#101316",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
