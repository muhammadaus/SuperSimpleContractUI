import { Core } from '@walletconnect/core';
import { WalletKit, WalletKitTypes } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';

// Global WalletKit instance
let walletKitInstance: typeof WalletKit.prototype | null = null;

/**
 * Initialize WalletKit globally
 * This should be called once at the application startup
 */
export async function initializeWalletKit() {
  if (walletKitInstance) {
    return walletKitInstance;
  }

  // Get project ID from environment variable
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('WalletConnect Project ID is not defined. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment variables.');
  }

  // Initialize Core
  const core = new Core({
    projectId,
  });

  // Initialize WalletKit
  walletKitInstance = await WalletKit.init({
    core,
    metadata: {
      name: 'WrapTX',
      description: 'Secure and transparent smart contract interactions',
      url: 'https://WrapTX.com',
      icons: ['https://WrapTX.com/logo.png'], // Replace with your actual logo URL
    },
  });

  // Set up event listeners
  setupEventListeners(walletKitInstance);

  return walletKitInstance;
}

/**
 * Get the global WalletKit instance
 * Initializes it if it doesn't exist yet
 */
export async function getWalletKit(): Promise<typeof WalletKit.prototype> {
  if (!walletKitInstance) {
    return initializeWalletKit();
  }
  return walletKitInstance;
}

/**
 * Set up event listeners for WalletKit
 */
function setupEventListeners(walletKit: typeof WalletKit.prototype) {
  // Handle session proposals
  walletKit.on('session_proposal', async (proposal: WalletKitTypes.SessionProposal) => {
    try {
      console.log('Received session proposal:', proposal);
      
      // This would typically show a UI for the user to approve/reject
      // For now, we'll auto-approve with some default accounts
      // In a real app, you would get these from the user's wallet
      
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            chains: ['eip155:1', 'eip155:11155111'], // Mainnet and Sepolia
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'wallet_switchEthereumChain',
            ],
            events: ['chainChanged', 'accountsChanged'],
            accounts: [
              // These should be replaced with the user's actual accounts
              'eip155:1:0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb',
              'eip155:11155111:0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb',
            ],
          },
        },
      });

      const session = await walletKit.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });

      console.log('Session approved:', session);
    } catch (error) {
      console.error('Error handling session proposal:', error);
      
      // Reject the session
      await walletKit.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED'),
      });
    }
  });

  // Handle session requests (method calls from dapps)
  walletKit.on('session_request', async (request: WalletKitTypes.SessionRequest) => {
    try {
      console.log('Received session request:', request);
      
      // Handle different method requests
      // This is where you would implement the actual wallet functionality
      // For example, signing transactions, messages, etc.
      
      // For now, we'll just reject all requests
      await walletKit.rejectSession({
        id: request.id,
        reason: getSdkError('USER_REJECTED'),
      });
    } catch (error) {
      console.error('Error handling session request:', error);
    }
  });

  // Handle session deletions
  walletKit.on('session_delete', (event: WalletKitTypes.SessionDelete) => {
    console.log('Session deleted:', event);
  });
}

/**
 * Pair with a dapp using a WalletConnect URI
 */
export async function pairWithDapp(uri: string) {
  const walletKit = await getWalletKit();
  return walletKit.pair({ uri });
}

/**
 * Get all active sessions
 */
export async function getActiveSessions() {
  const walletKit = await getWalletKit();
  return walletKit.getActiveSessions();
}

/**
 * Disconnect a session
 */
export async function disconnectSession(topic: string) {
  const walletKit = await getWalletKit();
  return walletKit.disconnectSession({
    topic,
    reason: getSdkError('USER_DISCONNECTED'),
  });
} 