import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http } from "viem";
import { mainnet, sepolia, polygon, polygonMumbai, arbitrum, optimism, base, hardhat } from "wagmi/chains";
import { createConfig } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

// Create a single-item array with the target network
const targetNetworks: Chain[] = [scaffoldConfig.targetNetwork];

// Map of supported chains for easy lookup
const supportedChains: { [key: number]: Chain } = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  80001: polygonMumbai,
  42161: arbitrum,
  10: optimism,
  8453: base,
  31337: hardhat,
};

// Filter target networks to only include supported chains
const validTargetNetworks = targetNetworks.map((network: Chain) => {
  const supportedChain = supportedChains[network.id];
  if (!supportedChain) {
    console.warn(`Chain ${network.id} is not supported by wagmi. Using custom configuration.`);
    return network;
  }
  return supportedChain;
});

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = validTargetNetworks.find((network: Chain) => network.id === 1)
  ? validTargetNetworks
  : ([...validTargetNetworks, mainnet] as const);

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors,
  ssr: true,
  client({ chain }) {
    let rpcFallbacks = [http()];

    const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
    if (alchemyHttpUrl) {
      rpcFallbacks = [http(alchemyHttpUrl), http()];
    }

    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== hardhat.id
        ? {
            pollingInterval: scaffoldConfig.pollingInterval,
          }
        : {}),
    });
  },
});
