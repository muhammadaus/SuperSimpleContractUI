"use client";

import React, { useEffect } from 'react';
import { initializeAppKit } from '../../utils/scaffold-eth/appKitUtils';

interface AppKitProviderProps {
  children: React.ReactNode;
}

export const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  useEffect(() => {
    // Initialize AppKit on the client side
    initializeAppKit();
  }, []);

  return <>{children}</>;
}; 