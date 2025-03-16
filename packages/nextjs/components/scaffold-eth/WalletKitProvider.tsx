"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useWalletKit } from '../../hooks/scaffold-eth/useWalletKit';

// Create context
interface WalletKitContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
}

const WalletKitContext = createContext<WalletKitContextType>({
  isInitialized: false,
  isInitializing: false,
  error: null,
});

// Provider component
interface WalletKitProviderProps {
  children: ReactNode;
}

export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({ children }) => {
  const { isInitialized, isInitializing, error } = useWalletKit();

  return (
    <WalletKitContext.Provider
      value={{
        isInitialized,
        isInitializing,
        error,
      }}
    >
      {children}
    </WalletKitContext.Provider>
  );
};

// Hook to use the WalletKit context
export const useWalletKitContext = () => useContext(WalletKitContext); 