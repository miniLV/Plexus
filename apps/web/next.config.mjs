import path from "node:path";

const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plexus is meant to run locally only; never expose externally.
  experimental: {},
  turbopack: {
    root: repoRoot,
  },
  // Allow direct import from the workspace package without bundling.
  transpilePackages: ["plexus-agent-config-core"],
};

export default nextConfig;
