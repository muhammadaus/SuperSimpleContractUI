// Using viem instead of ethers
import type { Account, Transport, Chain } from 'viem';
import { getWalletKit } from './walletConnectUtils';

// Wallet type enum
export enum WalletType {
  WALLET_CONNECT = 'WalletConnect',
  INJECTED = 'Injected',
}

/**
 * WalletMeta for WalletConnect or Injected wallets.
 */
export interface WalletMeta {
  type: WalletType;
  /**
   * The agent string of the wallet, for use with analytics/debugging.
   */
  agent: string;
  /**
   * The name of the wallet, for use with UI.
   */
  name?: string;
  description?: string;
  url?: string;
  icons?: string[];
}

/**
 * Check if a provider is a WalletConnect provider
 */
export function isWalletConnectProvider(provider: any): boolean {
  return !!(provider as any).isWalletConnect;
}

/**
 * Get metadata for an injected wallet provider
 */
export function getInjectedMeta(provider: any): WalletMeta {
  const properties = Object.getOwnPropertyNames(provider);

  const names =
    properties
      .filter((name) => name.match(/^is.*$/) && (provider as Record<string, unknown>)[name] === true)
      .map((name) => name.slice(2)) ?? [];

  // Many wallets spoof MetaMask by setting `isMetaMask` along with their own identifier,
  // so we sort MetaMask last so that these wallets' names come first.
  names.sort((a, b) => (a === 'MetaMask' ? 1 : b === 'MetaMask' ? -1 : 0));

  // Coinbase Wallet can be connected through an extension or a QR code
  if (properties.includes('qrUrl') && provider['qrUrl']) {
    names.push('qrUrl');
  }

  return {
    type: WalletType.INJECTED,
    agent: [...names, '(Injected)'].join(' '),
    name: names[0] || 'Unknown Wallet',
  };
}

/**
 * Detect wallet type from window.ethereum
 */
export function detectWalletType(): WalletType | undefined {
  if (typeof window === 'undefined' || !window.ethereum) {
    return undefined;
  }

  if (isWalletConnectProvider(window.ethereum)) {
    return WalletType.WALLET_CONNECT;
  }

  return WalletType.INJECTED;
}

/**
 * Get wallet metadata from window.ethereum
 */
export function getWalletMetadata(): WalletMeta | undefined {
  if (typeof window === 'undefined' || !window.ethereum) {
    return undefined;
  }

  if (isWalletConnectProvider(window.ethereum)) {
    const provider = window.ethereum as any;
    const metadata = provider.session?.peer.metadata;
    return {
      type: WalletType.WALLET_CONNECT,
      agent: metadata ? `${metadata.name} (WalletConnect)` : '(WalletConnect)',
      ...metadata,
    };
  } else {
    return getInjectedMeta(window.ethereum as any);
  }
}

/**
 * Connect to wallet and return address
 */
export async function connectWallet(): Promise<string | undefined> {
  if (typeof window === 'undefined' || !window.ethereum) {
    console.error("No Ethereum wallet detected");
    return undefined;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return undefined;
  } catch (error) {
    console.error("Error connecting wallet:", error);
    throw error;
  }
}

/**
 * Connect to wallet using WalletConnect
 * @param uri WalletConnect URI (from QR code)
 */
export async function connectWithWalletConnect(uri: string): Promise<string | undefined> {
  try {
    // Get WalletKit instance
    const walletKit = await getWalletKit();
    
    // Pair with the dapp
    await walletKit.pair({ uri });
    
    // The actual connection will happen through the session_proposal event
    // which is handled in the walletConnectUtils.ts file
    
    // For now, we'll return undefined and let the session_proposal handler
    // take care of the connection
    return undefined;
  } catch (error) {
    console.error("Error connecting with WalletConnect:", error);
    throw error;
  }
}

/**
 * Switch to a specific network
 */
export async function switchNetwork(chainId: number): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return false;
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      console.log('Network not available in wallet');
    }
    console.error('Failed to switch networks:', error);
    return false;
  }
} 