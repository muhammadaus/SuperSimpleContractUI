// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // Expose the ALCHEMY_RPC_URL as an environment variable to the browser
  env: {
    ALCHEMY_RPC_URL: process.env.ALCHEMY_RPC_URL,
  }
};

module.exports = nextConfig;
