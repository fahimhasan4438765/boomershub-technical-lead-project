import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "BoomersHub Voice AI Console",
  description: "Operations console for the BoomersHub Voice AI Agent platform."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}

