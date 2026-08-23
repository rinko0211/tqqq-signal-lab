import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tqqq-signal-lab.sunnyground0203.chatgpt.site"),
  title: "TQQQ Signal Lab",
  description: "毎日判断し、売買を厳選する中期TQQQポジション管理システム。",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "TQQQ Signal Lab",
    description: "毎日判断し、売買を厳選する中期TQQQポジション管理システム。",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TQQQ Signal Lab",
    description: "毎日判断し、売買を厳選する中期TQQQポジション管理システム。",
    images: ["/og.png"],
  },
  icons: {
    icon: [{url:"/favicon.svg"},{url:"/icon-192.png",sizes:"192x192",type:"image/png"}],
    shortcut: "/favicon.svg",
    apple: [{url:"/icon-192.png",sizes:"192x192",type:"image/png"}],
  },
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"TQQQ Signal Lab"},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
