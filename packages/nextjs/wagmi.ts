import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';

// This file is kept for compatibility with existing imports
// but we're moving away from wagmi to viem directly

/**
 * Create a wallet client using the injected provider
 */
export const createInjectedClient = (address: `0x${string}`) => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum provider found');
  }
  
  return createWalletClient({
    account: address,
    transport: custom(window.ethereum),
  });
};

// Export a dummy config for compatibility
export const config = {
  autoConnect: true,
}; 