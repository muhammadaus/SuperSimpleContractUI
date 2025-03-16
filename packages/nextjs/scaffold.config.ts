import { sepolia } from 'viem/chains';

// Create a custom Sepolia configuration with multiple RPC URLs for fallback
const customSepolia = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: {
      ...sepolia.rpcUrls.default,
      http: [
        // Add multiple RPC URLs for fallback
        'https://eth-sepolia.g.alchemy.com/v2/demo',
        'https://rpc.sepolia.org',
        'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura key
        'https://rpc2.sepolia.org',
      ],
    },
  },
};

const scaffoldConfig = {
  targetNetwork: customSepolia,
  alchemyApiKey: process.env.ALCHEMY_API_KEY || '',
};

export default scaffoldConfig;
