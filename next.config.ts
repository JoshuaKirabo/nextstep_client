import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server's scripts load when the app is opened from this machine's LAN address.
  allowedDevOrigins: ["172.22.225.103"],
};

export default nextConfig;
