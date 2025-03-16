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
import { BrowserProvider, JsonRpcSigner, ethers } from 'ethers';
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
  const [isExecuting, setIsExecuting] = useState(false);
  const [connectionTimestamp, setConnectionTimestamp] = useState<number | null>(null);

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
      
      notification.info('Please connect your wallet to continue');
      
      return true;
    } catch (error) {
      console.error("Error opening wallet modal:", error);
      notification.error(`Failed to open wallet modal: ${(error as Error).message}`);
      setPendingTransaction(null);
      throw error;
    }
  }, [open]);

  // Track when the wallet gets connected
  useEffect(() => {
    if (isConnected && !connectionTimestamp) {
      setConnectionTimestamp(Date.now());
      notification.success('Wallet connected! Preparing transaction...');
    } else if (!isConnected) {
      setConnectionTimestamp(null);
    }
  }, [isConnected, connectionTimestamp]);

  // Execute the transaction after wallet connection with a delay
  const executeTransaction = useCallback(async () => {
    if (!pendingTransaction || !isConnected || !walletProvider || !address || isExecuting) {
      return;
    }

    setIsExecuting(true);
    notification.loading('Preparing transaction...');

    try {
      // Check if we need to switch networks
      if (currentChainId !== chainId) {
        const network = getNetworkByChainId(chainId);
        if (network) {
          notification.info(`Switching to ${network.name} network...`);
          await switchNetwork(network);
          // Will trigger again after chain switch
          setIsExecuting(false);
          return;
        } else {
          notification.error(`Network with chain ID ${chainId} not supported`);
          setPendingTransaction(null);
          setIsExecuting(false);
          return;
        }
      }

      const { to, data, value } = pendingTransaction;
      
      try {
        // Create ethers provider and signer
        const provider = new BrowserProvider(walletProvider);
        const signer = await provider.getSigner();
        
        notification.loading('Please confirm the transaction in your wallet');
        
        // Estimate gas with a buffer to avoid "out of gas" errors
        let gasLimit;
        try {
          const gasEstimate = await provider.estimateGas({
            from: address,
            to,
            data,
            value: value ? value : undefined
          });
          
          // Add 30% buffer to gas estimate
          gasLimit = Math.floor(Number(gasEstimate) * 1.3);
          console.log("Estimated gas with buffer:", gasLimit);
        } catch (gasError) {
          console.warn("Gas estimation failed, using default gas limit:", gasError);
          // Use a high default gas limit if estimation fails
          gasLimit = 300000; // Default high gas limit
        }
        
        // Send the transaction with explicit gas settings
        const tx = await signer.sendTransaction({
          to,
          data,
          value: value ? value : undefined,
          gasLimit: gasLimit,
        });
        
        notification.success(`Transaction sent: ${tx.hash}`);
        
        // Clear pending transaction
        setPendingTransaction(null);
        
        return tx.hash;
      } catch (error) {
        console.error("Error executing transaction:", error);
        
        // Handle specific error types
        const errorMessage = (error as Error).message.toLowerCase();
        
        if (errorMessage.includes('user rejected') || 
            errorMessage.includes('user denied')) {
          notification.error("Transaction was rejected by the user");
        } else if (errorMessage.includes('insufficient funds')) {
          notification.error("Insufficient funds for transaction");
        } else if (errorMessage.includes('gas required exceeds allowance') || 
                  errorMessage.includes('out of gas')) {
          notification.error("Transaction failed: Not enough gas. Try increasing your gas limit.");
        } else if (errorMessage.includes('nonce')) {
          notification.error("Transaction failed: Nonce error. Please refresh and try again.");
        } else {
          notification.error(`Transaction failed: ${(error as Error).message}`);
        }
        
        // Clear pending transaction on error to allow retry
        setPendingTransaction(null);
      }
    } catch (error) {
      console.error("Error in transaction flow:", error);
      notification.error(`Transaction flow error: ${(error as Error).message}`);
      setPendingTransaction(null);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingTransaction, isConnected, walletProvider, address, chainId, currentChainId, switchNetwork, isExecuting]);

  // Check for pending transactions when wallet connection state changes with a delay
  useEffect(() => {
    if (isConnected && pendingTransaction && !isExecuting && connectionTimestamp) {
      // Add a 1.5 second delay after connection before executing the transaction
      const timeSinceConnection = Date.now() - connectionTimestamp;
      const delayNeeded = Math.max(0, 1500 - timeSinceConnection);
      
      const timer = setTimeout(() => {
        executeTransaction();
      }, delayNeeded);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, pendingTransaction, executeTransaction, isExecuting, connectionTimestamp]);

  // Empty component as we're using AppKit's built-in modal
  const QRTransactionModalComponent = () => null;

  return {
    initiateQRTransaction,
    QRTransactionModalComponent,
    isModalOpen: false,
    closeModal: () => {},
    executeTransaction,
    isExecuting,
  };
}; 