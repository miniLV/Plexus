/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plexus is meant to run locally only; never expose externally.
  experimental: {},
  // Allow direct import from the workspace package without bundling.
  transpilePackages: ["@plexus/core"],
};

export default nextConfig;
