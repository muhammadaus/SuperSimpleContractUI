import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Define your project configuration
// You need to get a project ID from https://cloud.walletconnect.com/
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Define metadata for your application
const metadata = {
  name: 'PureContracts',
  description: 'Secure and transparent smart contract interactions',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://purecontracts.com',
  icons: ['https://purecontracts.com/logo.png'], // Replace with your actual logo URL
};

// Create ethers adapter
const ethersAdapter = new EthersAdapter();

// Define supported networks - must use the format [AppKitNetwork, ...AppKitNetwork[]]
export const networks = [mainnet, arbitrum, sepolia] as [AppKitNetwork, ...AppKitNetwork[]];

/**
 * Initialize AppKit for the application
 * This should be called once at the application startup
 */
export function initializeAppKit() {
  if (typeof window === 'undefined') return;
  
  if (!projectId) {
    console.error('WalletConnect Project ID is not defined. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment variables.');
    console.error('Get a project ID from https://cloud.walletconnect.com/');
    return;
  }

  try {
    createAppKit({
      adapters: [ethersAdapter],
      networks,
      metadata,
      projectId,
      themeMode: 'dark',
      features: {
        analytics: true,
      },
      themeVariables: {
        '--w3m-accent': '#3b82f6', // Blue color to match your UI
      },
    });
    
    console.log('AppKit initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AppKit:', error);
  }
}

/**
 * Get the current connected account
 */
export async function getCurrentAccount(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  try {
    // Type assertion to handle the unknown type
    const ethereum = window.ethereum as any;
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error getting current account:', error);
    return null;
  }
} 