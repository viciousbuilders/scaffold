import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  // Runtime caches must not modify the resources of the signed Mac app.
  experimental: { isrFlushToDisk: false },
};
export default nextConfig;
