import { create } from 'zustand';
import { Chain } from "viem/chains";
import * as chains from "viem/chains";
import scaffoldConfig from '@/scaffold.config';

interface NetworkStore {
  targetNetwork: Chain | null;
  setTargetNetwork: (network: Chain) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  targetNetwork: null,
  setTargetNetwork: (network) => set({ targetNetwork: network }),
}));

export const setTargetNetwork = (network: Chain) => {
  useNetworkStore.getState().setTargetNetwork(network);
};

export type TChainAttributes = {
  name: string;
  color?: string;
};

// Mapping of chainId to RPC chain name and format followed by alchemy and infura
export const RPC_CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(chains).map(([_, chain]) => {
    return [chain.id, chain.name];
  })
);

export function getAlchemyHttpUrl(chainId: number) {
  const chainNames = Object.keys(chains);

  const targetChainArr = chainNames.filter(chainName => {
    const wagmiChain = chains[chainName as keyof typeof chains];
    return wagmiChain.id === chainId;
  });

  if (targetChainArr.length === 0) {
    return "";
  }

  const targetChain = targetChainArr[0] as keyof typeof chains;
  const chain = chains[targetChain];

  if (!chain?.rpcUrls?.default?.http) {
    return "";
  }

  // Replace with Alchemy URL if using Alchemy
  if (scaffoldConfig.alchemyApiKey) {
    const networkName = chain.name.toLowerCase();
    return `https://${networkName}.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`;
  }

  // Return default RPC URL if no Alchemy key
  return chain.rpcUrls.default.http[0];
}

export function getTargetNetwork(): chains.Chain & TChainAttributes {
  const network = useNetworkStore.getState().targetNetwork;
  if (!network) {
    return {
      ...chains.mainnet,
      name: chains.mainnet.name,
      color: "#1E40AF", // Default color
    };
  }
  return {
    ...network,
    name: network.name,
    color: "#1E40AF", // Default color
  };
}

/**
 * Gives the block explorer URL for a given address.
 */
export function getBlockExplorerAddressLink(chain: chains.Chain, address: string) {
  const blockExplorerBaseURL = chain.blockExplorers?.default?.url;
  if (!blockExplorerBaseURL) {
    return `https://etherscan.io/address/${address}`;
  }
  return `${blockExplorerBaseURL}/address/${address}`;
}

/**
 * Gives the block explorer transaction URL.
 */
export function getBlockExplorerTxLink(chain: chains.Chain, txnHash: string) {
  const blockExplorerBaseURL = chain.blockExplorers?.default?.url;
  if (!blockExplorerBaseURL) {
    return "";
  }
  return `${blockExplorerBaseURL}/tx/${txnHash}`;
}

// Add this new function to get all target networks
export function getAllTargetNetworks(): Chain[] {
  const configNetworks = scaffoldConfig.targetNetwork;
  return Array.isArray(configNetworks) ? configNetworks : [configNetworks];
}
