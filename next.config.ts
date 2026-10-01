import type { NextConfig } from "next";

// Where the Spring server runs during local development
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // Lets the dev server's scripts load when the app is opened from a LAN address (e.g. on a phone).
  // Whole private ranges rather than one IP, so switching networks doesn't silently break the page.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],

  // Dev only: forward /api/* to Spring so the browser sees one origin (cookies just work).
  // In production Caddy routes /api/* to Spring before requests ever reach Next.js.
  async rewrites()
    {
      if(process.env.NODE_ENV !== "development")
        {
          return [];
        }

      return [
        { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      ];
    },
};

export default nextConfig;
