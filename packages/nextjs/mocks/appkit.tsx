// Mock implementation of AppKit

import React, { createContext, useContext, ReactNode } from 'react';

// Create a basic AppKit context
const AppKitContext = createContext<any>(null);

// Mock createAppKit function
export const createAppKit = () => {
  console.log('Mock createAppKit called');
  return {
    provider: null,
    chains: [],
    wallets: []
  };
};

// Mock AppKitProvider component
export const AppKitProvider = ({ children }: { children: ReactNode }) => {
  const mockAppKit = {
    provider: null,
    chains: [],
    wallets: [],
    connected: false,
    address: '0x0000000000000000000000000000000000000000',
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    switchChain: () => Promise.resolve(),
    getBalance: () => Promise.resolve('0'),
    getChainId: () => Promise.resolve(1),
    getNetwork: () => Promise.resolve({ name: 'mainnet', id: 1 }),
  };

  return (
    <AppKitContext.Provider value={mockAppKit}>
      {children}
    </AppKitContext.Provider>
  );
};

// Mock useAppKit hook
export const useAppKit = () => {
  const context = useContext(AppKitContext);
  if (!context) {
    console.warn('useAppKit must be used within an AppKitProvider');
    return {
      provider: null,
      chains: [],
      wallets: [],
      connected: false,
      address: '0x0000000000000000000000000000000000000000',
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      switchChain: () => Promise.resolve(),
      getBalance: () => Promise.resolve('0'),
      getChainId: () => Promise.resolve(1),
      getNetwork: () => Promise.resolve({ name: 'mainnet', id: 1 }),
    };
  }
  return context;
}; 