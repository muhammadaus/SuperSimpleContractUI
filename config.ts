import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// Create a public client for interacting with the blockchain
export const client = createPublicClient({
  chain: sepolia,
  // Use a public RPC provider that doesn't require authentication
  transport: http('https://rpc.sepolia.org'),
}) 