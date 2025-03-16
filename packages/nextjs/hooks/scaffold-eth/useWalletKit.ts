"use client";

import { useEffect, useState } from 'react';
import { initializeWalletKit, getWalletKit } from '../../utils/scaffold-eth/walletConnectUtils';

/**
 * Hook to initialize and use WalletKit
 */
export const useWalletKit = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      if (isInitialized || isInitializing) return;
      
      setIsInitializing(true);
      try {
        await initializeWalletKit();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize WalletKit:', err);
        setError(err as Error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [isInitialized, isInitializing]);

  return {
    isInitialized,
    isInitializing,
    error,
    getWalletKit,
  };
}; 