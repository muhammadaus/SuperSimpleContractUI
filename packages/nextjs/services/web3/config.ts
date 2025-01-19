import { createPublicClient, http } from "viem";

// Create a public client that uses the connected wallet's provider
export const publicClient = createPublicClient({
  transport: http(),
});

// Let the connected wallet determine the chain
export const defaultChain = undefined; 