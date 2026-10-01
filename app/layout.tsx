import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Fallback for the tagline on non-Apple devices, where SF Pro isn't available.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "NextStep",
  description: "Planning and scheduling built for ADHD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The intro script below sets data-intro before hydration, so React must not flag it.
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
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
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600&f[]=satoshi@400,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
