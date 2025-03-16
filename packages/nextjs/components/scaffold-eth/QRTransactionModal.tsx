// This file is no longer needed as we're using AppKit's built-in QR code functionality.
// The AppKit library handles wallet connections and QR codes internally.
// Please see the AppKitWallet component for the implementation.

import React from 'react';

interface QRTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  isLoading: boolean;
  error: string | null;
}

// This is a placeholder component that doesn't render anything
// We're using AppKit's built-in modal instead
export const QRTransactionModal: React.FC<QRTransactionModalProps> = () => {
  return null;
}; 