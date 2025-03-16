"use client";

// This file is no longer needed as we're using AppKit's built-in QR code functionality.
// The AppKit library handles wallet connections and QR codes internally.
// Please see the AppKitWallet component for the implementation.

import { useCallback, useState, useEffect } from 'react';
import { Address } from 'viem';
import { notification } from '../../utils/scaffold-eth/notification';
import { 
  useAppKit, 
  useAppKitAccount, 
  useAppKitProvider, 
  useAppKitNetwork 
} from '@reown/appkit/react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import type { Provider } from '@reown/appkit/react';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

interface QRTransactionFlowProps {
  chainId: number;
}

// Helper function to get AppKit network by chain ID
const getNetworkByChainId = (chainId: number): AppKitNetwork | undefined => {
  const networks = [mainnet, sepolia, arbitrum];
  return networks.find(network => network.id === chainId);
};

export const useQRTransactionFlow = ({ chainId }: QRTransactionFlowProps) => {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const [pendingTransaction, setPendingTransaction] = useState<{
    to: Address;
    data: string;
    value?: bigint;
  } | null>(null);

  // This function initiates a transaction via AppKit
  const initiateQRTransaction = useCallback(async (
    to: Address,
    data: string,
    value?: bigint
  ) => {
    try {
      // Store the transaction details for after connection
      setPendingTransaction({ to, data, value });
      
      // Open the AppKit modal which handles wallet connection and QR code
      open();
      
      notification.info('Please connect your wallet using the modal');
      
      return true;
    } catch (error) {
      console.error("Error opening wallet modal:", error);
      notification.error(`Failed to open wallet modal: ${(error as Error).message}`);
      throw error;
    }
  }, [open]);

  // Execute the transaction after wallet connection
  const executeTransaction = useCallback(async () => {
    if (!pendingTransaction || !isConnected || !walletProvider || !address) {
      return;
    }

    try {
      // Check if we need to switch networks
      if (currentChainId !== chainId) {
        const network = getNetworkByChainId(chainId);
        if (network) {
          await switchNetwork(network);
          return; // Will trigger again after chain switch
        } else {
          notification.error(`Network with chain ID ${chainId} not supported`);
          return;
        }
      }

      const { to, data, value } = pendingTransaction;
      
      // Create ethers provider and signer
      const provider = new BrowserProvider(walletProvider, chainId);
      const signer = new JsonRpcSigner(provider, address);
      
      // Send the transaction
      const tx = await signer.sendTransaction({
        to,
        data,
        value: value ? value : undefined
      });
      
      notification.success(`Transaction sent: ${tx.hash}`);
      
      // Clear pending transaction
      setPendingTransaction(null);
      
      return tx.hash;
    } catch (error) {
      console.error("Error executing transaction:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
      // Don't clear pending transaction on error so user can retry
    }
  }, [pendingTransaction, isConnected, walletProvider, address, chainId, currentChainId, switchNetwork]);

  // Check for pending transactions when wallet connection state changes
  useEffect(() => {
    if (isConnected && pendingTransaction) {
      executeTransaction();
    }
  }, [isConnected, pendingTransaction, executeTransaction]);

  // Empty component as we're using AppKit's built-in modal
  const QRTransactionModalComponent = () => null;

  return {
    initiateQRTransaction,
    QRTransactionModalComponent,
    isModalOpen: false,
    closeModal: () => {},
    executeTransaction,
  };
}; 