import { useState, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';

// Track AppKit initialization status globally
const APPKIT_INITIALIZATION_KEY = 'APPKIT_INITIALIZED';

// Global flag to track initialization
let isGloballyInitialized = false;

// Function to initialize AppKit synchronously
const initializeAppKitSync = () => {
  if (typeof window === 'undefined') return false;
  
  // Skip if already initialized
  if (isGloballyInitialized || 
      (window as any).__APPKIT_INITIALIZED__ || 
      window.localStorage.getItem(APPKIT_INITIALIZATION_KEY)) {
    isGloballyInitialized = true;
    return true;
  }
  
  try {
    console.log('Initializing AppKit synchronously...');
    
    // Set flags first to prevent concurrent initialization
    window.localStorage.setItem(APPKIT_INITIALIZATION_KEY, 'true');
    (window as any).__APPKIT_INITIALIZED__ = true;
    isGloballyInitialized = true;
    
    const ethersAdapter = new EthersAdapter();
    createAppKit({
      adapters: [ethersAdapter],
      networks: [mainnet, sepolia, arbitrum],
      metadata: {
        name: 'PureContracts',
        description: 'Interact with your deployed contracts',
        url: window?.location?.origin || 'https://purecontracts.com',
        icons: ['https://reown.net/images/logo.png'],
      },
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
      themeMode: 'dark',
      features: {
        analytics: true,
      },
    });
    
    console.log('AppKit initialized successfully');
    return true;
  } catch (err) {
    console.error('Failed to initialize AppKit:', err);
    
    // Clear flags on error
    window.localStorage.removeItem(APPKIT_INITIALIZATION_KEY);
    (window as any).__APPKIT_INITIALIZED__ = false;
    isGloballyInitialized = false;
    
    return false;
  }
};

/**
 * Custom hook to safely initialize AppKit and track initialization status
 */
export const useAppKitInit = () => {
  const [isInitializing, setIsInitializing] = useState(!isGloballyInitialized);
  const [isInitialized, setIsInitialized] = useState(isGloballyInitialized);
  const [error, setError] = useState<Error | null>(null);

  // Try to initialize synchronously on first render
  if (typeof window !== 'undefined' && !isGloballyInitialized) {
    try {
      const initialized = initializeAppKitSync();
      if (initialized) {
        isGloballyInitialized = true;
      }
    } catch (err) {
      console.error('Error during sync initialization:', err);
    }
  }

  useEffect(() => {
    let isMounted = true;
    
    const initAppKit = async () => {
      // Skip if already initialized
      if (isGloballyInitialized) {
        if (isMounted) {
          setIsInitialized(true);
          setIsInitializing(false);
        }
        return;
      }
      
      try {
        // Double-check if already initialized by another component
        if (typeof window !== 'undefined' && 
            ((window as any).__APPKIT_INITIALIZED__ || 
             window.localStorage.getItem(APPKIT_INITIALIZATION_KEY))) {
          console.log('AppKit already initialized by another component');
          isGloballyInitialized = true;
          if (isMounted) {
            setIsInitialized(true);
            setIsInitializing(false);
          }
          return;
        }
        
        // Initialize if not already done
        if (typeof window !== 'undefined' && !isGloballyInitialized) {
          const success = initializeAppKitSync();
          
          if (isMounted) {
            setIsInitialized(success);
            setIsInitializing(false);
          }
        }
      } catch (err: any) {
        console.error('AppKit initialization failed in effect:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsInitializing(false);
        }
      }
    };

    initAppKit();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return { 
    isInitializing, 
    isInitialized: isInitialized || isGloballyInitialized, 
    error,
    isAppKitReady: isGloballyInitialized 
  };
}; 