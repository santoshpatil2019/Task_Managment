import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mellivo | Task Management",
  description: "Professional project and task management for Mellivo teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script dangerouslySetInnerHTML={{ __html: `try { var t=localStorage.getItem('mellivo-theme'); document.documentElement.dataset.theme = t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); } catch(e) { document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; }` }} />{children}</body>
    </html>
  );
}
