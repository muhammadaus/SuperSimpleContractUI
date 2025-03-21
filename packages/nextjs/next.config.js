// @ts-check
const path = require('path');

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
    
    // Add aliases for mock modules to replace scaffold-eth dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      '~~/hooks/scaffold-eth': path.resolve(__dirname, './mocks/hooks/scaffold-eth'),
      '~~/utils/scaffold-eth/common': path.resolve(__dirname, './mocks/utils/scaffold-eth/common'),
      '~~/components/scaffold-eth': path.resolve(__dirname, './mocks/components/scaffold-eth'),
      '@/utils/scaffold-eth/contract': path.resolve(__dirname, './mocks/utils/scaffold-eth/contract'),
      '@/utils/scaffold-eth/notification': path.resolve(__dirname, './mocks/utils/scaffold-eth/notification'),
      '@/utils/scaffold-eth/networks': path.resolve(__dirname, './mocks/utils/scaffold-eth/networks'),
      '@/utils/scaffold-eth/contractsData': path.resolve(__dirname, './mocks/utils/scaffold-eth/contractsData'),
      '@/scaffold.config': path.resolve(__dirname, './mocks/scaffold.config'),
      'react-copy-to-clipboard': path.resolve(__dirname, './mocks/react-copy-to-clipboard'),
      'usehooks-ts': path.resolve(__dirname, './mocks/usehooks-ts'),
      '@purecontractlabs/appkit': path.resolve(__dirname, './mocks/appkit'),
    };
    
    return config;
  },
  // Expose the ALCHEMY_RPC_URL as an environment variable to the browser
  env: {
    ALCHEMY_RPC_URL: process.env.ALCHEMY_RPC_URL,
  },
  // Exclude certain paths from the build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Use standalone mode for better compatibility with Vercel
  output: 'standalone',
  // For image optimization
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@rainbow-me/rainbowkit',
    '@wagmi/core',
    '@wagmi/connectors',
  ],
};

module.exports = nextConfig;
