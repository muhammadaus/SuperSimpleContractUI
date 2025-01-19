import { createPublicClient, createWalletClient, custom, http } from "viem";
import { mainnet } from "viem/chains";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";
import scaffoldConfig from "~~/scaffold.config";

// Create public client for reading data
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(getAlchemyHttpUrl(mainnet.id)),
});

// Create wallet client for writing data (when MetaMask is available)
export const getWalletClient = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return createWalletClient({
      chain: mainnet,
      transport: custom(window.ethereum),
    });
  }
  return null;
};

// Export default chain configuration
export const defaultChain = mainnet; 