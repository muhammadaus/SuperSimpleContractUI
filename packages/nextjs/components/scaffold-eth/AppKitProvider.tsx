"use client";

import React, { useEffect } from 'react';
import { initializeAppKit } from '../../utils/scaffold-eth/appKitUtils';
import ClientOnly from '../../app/components/ClientOnly';

interface AppKitProviderProps {
  children: React.ReactNode;
}

export const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  useEffect(() => {
    // Initialize AppKit on the client side
    initializeAppKit();
  }, []);

  return (
    <ClientOnly fallback={<div className="min-h-screen flex items-center justify-center">Loading application...</div>}>
      {children}
    </ClientOnly>
  );
}; 