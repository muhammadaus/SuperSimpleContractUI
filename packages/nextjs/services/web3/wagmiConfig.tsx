import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl, getTargetNetwork } from "~~/utils/scaffold-eth";
import * as chains from "viem/chains";

const targetNetwork = getTargetNetwork();

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
const enabledChains = targetNetwork.id === mainnet.id 
  ? [targetNetwork] 
  : [targetNetwork, mainnet] as const;

// Create transport configuration for each chain
const transports = Object.fromEntries(
  enabledChains.map(chain => [
    chain.id,
    http(
      getAlchemyHttpUrl(chain.id) || 
      chain.rpcUrls.default.http[0]
    )
  ])
);

/**
 * Wagmi config
 */
export const wagmiConfig = createConfig({
  chains: enabledChains,
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
