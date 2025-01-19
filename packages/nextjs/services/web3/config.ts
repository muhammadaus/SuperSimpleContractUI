import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";
import scaffoldConfig from "~~/scaffold.config";

// Create a public client
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(getAlchemyHttpUrl(mainnet.id)),
});

// Export chain configuration
export const defaultChain = mainnet; 