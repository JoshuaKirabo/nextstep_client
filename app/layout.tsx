import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "NextStep", description: "Planning and scheduling built for ADHD" };

export default function RootLayout({ children }: LayoutProps<"/">)
  {
    return (
      // The intro script below sets data-intro before React loads, so this stops React from complaining about it.
      <html lang="en" className="h-full antialiased" suppressHydrationWarning>
        <head>
          {/*
            Returning visitors get the short intro. Deciding this before anything shows up so
            the full entrance never starts and then gets cut off halfway. If storage is blocked
            we treat them as returning since the short intro is the safe bet.
          */}
          <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("nextstep:intro-seen"))document.documentElement.dataset.intro="short"}catch(e){document.documentElement.dataset.intro="short"}` }} />
          {/*
            Clash Display for the big headings and Satoshi for everything else,
            both free from https://www.fontshare.com
          */}
          <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
          {/* Loading each font on its own because Fontshare drops Satoshi if you ask for both in one URL. */}
          <link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600&display=swap" rel="stylesheet" />
          <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500&display=swap" rel="stylesheet" />
        </head>
        <body className="flex min-h-full flex-col">{children}</body>
      </html>
    );
  }
