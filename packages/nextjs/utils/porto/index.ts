import { useEffect, useState } from 'react';

// Define a type for Porto properties we expect to use
interface PortoEthereum {
  isPorto?: boolean;
  isPortoWallet?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

// Flag to prevent multiple initializations
let isPortoInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

// Asynchronously initialize the Porto wallet
export const initializePorto = async (): Promise<boolean> => {
  // If already initialized, return immediately
  if (isPortoInitialized) {
    console.info('Porto already initialized, skipping initialization');
    return true;
  }
  
  // If initialization is in progress, return the existing promise
  if (initializationPromise) {
    console.info('Porto initialization already in progress, waiting for completion');
    return initializationPromise;
  }

  console.info('Starting Porto initialization');
  
  // Create a new initialization promise
  initializationPromise = (async () => {
    try {
      // Check if Porto is already available on window
      if (typeof window !== 'undefined' && (window as any).porto) {
        console.info('Porto already available on window object');
        isPortoInitialized = true;
        return true;
      }
      
      console.info('Porto not found on window, attempting dynamic import');
      
      // Try to import Porto dynamically
      try {
        const PortoModule = await import('porto');
        
        if (!PortoModule || !PortoModule.Porto) {
          console.error('Porto module loaded but Porto object not found in module');
          return false;
        }
        
        // Make Porto globally available
        if (typeof window !== 'undefined') {
          (window as any).porto = PortoModule.Porto;
          console.info('Porto successfully imported and attached to window');
        }
        
        isPortoInitialized = true;
        return true;
      } catch (importError) {
        console.error('Failed to import Porto module:', importError);
        
        // If dynamic import fails, check if it might be injected by browser extension
        if (typeof window !== 'undefined' && 
            window.ethereum && 
            (window.ethereum as unknown as PortoEthereum).isPorto) {
          console.info('Porto detected via window.ethereum.isPorto flag');
          isPortoInitialized = true;
          return true;
        }
        
        // Final check for any Porto-related globals
        if (typeof window !== 'undefined' && 
            ((window as any).porto || 
             (window.ethereum && (window.ethereum as unknown as PortoEthereum).isPortoWallet))) {
          console.info('Porto detected through alternative flags');
          isPortoInitialized = true;
          return true;
        }
        
        console.warn('Porto not available after all detection attempts');
        return false;
      }
    } catch (error) {
      console.error('Error initializing Porto:', error);
      return false;
    } finally {
      // Reset the initialization promise when done
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
};

// Check if Porto wallet is available
export const isPortoAvailable = async (): Promise<boolean> => {
  try {
    await initializePorto();
    
    if (typeof window !== 'undefined') {
      // Check for Porto in various ways wallets might expose themselves
      const portoExists = !!(
        (window as any).porto || 
        (window.ethereum && (window.ethereum as unknown as PortoEthereum).isPorto) || 
        (window.ethereum && (window.ethereum as unknown as PortoEthereum).isPortoWallet)
      );
      
      console.info(`Porto availability check result: ${portoExists}`);
      return portoExists;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Porto availability:', error);
    return false;
  }
};

// Import Porto dynamically
export const importPorto = async () => {
  try {
    const initialized = await initializePorto();
    if (!initialized) {
      console.warn('Failed to initialize Porto');
      return null;
    }
    
    // Try to get Porto from window first 
    if (typeof window !== 'undefined' && (window as any).porto) {
      return (window as any).porto;
    }
    
    // If not on window, try dynamic import again
    try {
      const PortoModule = await import('porto');
      return PortoModule.Porto;
    } catch (importError) {
      console.error('Failed to import Porto module after initialization:', importError);
      return null;
    }
  } catch (error) {
    console.error('Error importing Porto:', error);
    return null;
  }
};

// React hook to check Porto availability
export const usePorto = () => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    
    const checkPorto = async () => {
      try {
        setIsLoading(true);
        const available = await isPortoAvailable();
        if (isMounted) {
          setIsAvailable(available);
          setIsLoading(false);
          console.info(`Porto availability set to: ${available}`);
        }
      } catch (error) {
        console.error('Error in usePorto hook:', error);
        if (isMounted) {
          setIsAvailable(false);
          setIsLoading(false);
        }
      }
    };

    checkPorto();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return { isAvailable, isLoading };
};

// Auto-initialize Porto when this module is imported
initializePorto().catch(error => {
  console.warn('Failed to auto-initialize Porto:', error);
}); 