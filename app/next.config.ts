import type { NextConfig } from "next";

// Static export: the app is plain HTML/JS, no server. Data lives in the browser.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
