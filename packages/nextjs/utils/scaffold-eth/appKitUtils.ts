/**
 * Mock implementation of appKitUtils for server-side rendering compatibility
 */

let isInitialized = false;

export const initializeAppKit = () => {
  // Skip initialization if already done or if we're in a server environment
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    // Initialize AppKit only on client-side
    console.log('Initializing AppKit (mock)');
    
    // Mock the initialization
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
};

export const isAppKitInitialized = () => {
  return isInitialized;
};

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