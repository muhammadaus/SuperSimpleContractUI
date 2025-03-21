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
  },
  // Exclude certain paths from the build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 4,
  },
  // Explicitly including only the directories we want to build
  // and excluding the blockexplorer that contains problematic imports
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'app/blockexplorer/**/*',
        'node_modules/react-copy-to-clipboard/**/*'
      ],
    },
  }
};

module.exports = nextConfig;
