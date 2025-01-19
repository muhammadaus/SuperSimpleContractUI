import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, http } from "viem";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { createConfig } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl, getTargetNetwork } from "~~/utils/scaffold-eth";

const targetNetwork = getTargetNetwork();

// Define supported chains explicitly for RainbowKit
const supportedChains = [
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
] as const;

// Log chain information
console.log("Supported Chains:", supportedChains.map(chain => ({
  id: chain.id,
  name: chain.name,
  network: chain.network,
})));

// Create transport configuration for all supported chains
const transports = Object.fromEntries(
  supportedChains.map(chain => [
    chain.id,
    http(
      getAlchemyHttpUrl(chain.id) || 
      chain.rpcUrls.default.http[0]
    )
  ])
);

/**
 * Wagmi config with all supported chains
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: wagmiConnectors,
  transports,
  pollingInterval: scaffoldConfig.pollingInterval,
});

// Create a public client for general use
export const publicClient = createClient({
  chain: targetNetwork,
  transport: http(
    getAlchemyHttpUrl(targetNetwork.id) || 
    targetNetwork.rpcUrls.default.http[0]
  ),
});
