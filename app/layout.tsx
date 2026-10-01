import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextStep",
  description: "Planning and scheduling built for ADHD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The intro script below sets data-intro before hydration, so React must not flag it.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/*
          Returning visitors get a short intro. Decided before first paint so the
          full entrance never starts and then gets cut off. Blocked storage counts
          as returning: the short intro is the safe default.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("nextstep:intro-seen"))document.documentElement.dataset.intro="short"}catch(e){document.documentElement.dataset.intro="short"}`,
          }}
        />
        {/*
          Clash Display (display moments) and Satoshi (everything else) —
          https://www.fontshare.com (free Fontshare license)
        */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        {/* One request per family: Fontshare drops Satoshi when both are combined in one URL. */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
