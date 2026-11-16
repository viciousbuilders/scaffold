import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@astral-sh/ruff-wasm-nodejs"],
  outputFileTracingIncludes: {
    "/api/python-tools": ["./node_modules/@astral-sh/ruff-wasm-nodejs/**/*"],
  },
  // Runtime caches must not modify the resources of the signed Mac app.
  experimental: { isrFlushToDisk: false },
};
export default nextConfig;
