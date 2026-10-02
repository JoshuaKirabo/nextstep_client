import type { NextConfig } from "next";

// Where the Spring server lives when we're running things locally.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig =
  {
    // Letting the dev scripts load when you open the app from another device on the wifi, like your phone.
    // Allowing the whole private range instead of one IP so switching networks doesn't quietly break the page.
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],

    // Only in dev: sending /api/* over to Spring so the browser thinks it's all one site and cookies just work.
    // In production Caddy does this instead, so those requests never even reach Next.js.
    async rewrites()
      {
        if(process.env.NODE_ENV !== "development") return [];

        return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
      },
  };

export default nextConfig;
