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
  useAppKitNetwork,
  createAppKit
} from '@reown/appkit/react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import type { Provider } from '@reown/appkit/react';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Initialize AppKit once
try {
  createAppKit({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    metadata: {
      name: 'PureContracts',
      description: 'Token Wrapper',
      url: window?.location?.origin || 'https://purecontracts.com',
      icons: ['https://avatars.githubusercontent.com/u/37784886'],
    },
    networks: [mainnet, sepolia, arbitrum],
  });
} catch (error) {
  console.warn("AppKit may already be initialized:", error);
}

interface QRTransactionFlowProps {
  chainId: number;
}

// Helper function to get AppKit network by chain ID
const getNetworkByChainId = (chainId: number): AppKitNetwork | undefined => {
  const networks = [mainnet, sepolia, arbitrum];
  return networks.find(network => network.id === chainId);
};

export const useQRTransactionFlow = ({ chainId }: QRTransactionFlowProps) => {
  const { open, close } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const [pendingTransaction, setPendingTransaction] = useState<{
    to: Address;
    data: string;
    value?: bigint;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Function to cancel the transaction
  const cancelTransaction = useCallback(() => {
    console.log("Transaction cancelled by user");
    notification.info('Transaction cancelled');
    setPendingTransaction(null);
    close();
  }, [close]);

  // This function initiates a transaction via AppKit
  const initiateQRTransaction = useCallback(async (
    to: Address,
    data: string,
    value?: bigint
  ) => {
    try {
      console.log("Initiating transaction");
      
      // Store the transaction details
      setPendingTransaction({ to, data, value });
      setIsExecuting(false);
      
      // Open the AppKit modal which handles wallet connection and QR code
      open();
      
      console.log("Transaction initiated, modal opened");
      return true;
    } catch (error) {
      console.error("Error opening wallet modal:", error);
      notification.error(`Failed to open wallet modal: ${(error as Error).message}`);
      setPendingTransaction(null);
      throw error;
    }
  }, [open]);

  // Execute the transaction when wallet is connected
  useEffect(() => {
    // Skip if no pending transaction or not connected or already executing
    if (!pendingTransaction || !isConnected || !walletProvider || !address || isExecuting) {
      return;
    }

    console.log("Wallet connected, preparing to execute transaction");
    setIsExecuting(true);
    
    const executeTransaction = async () => {
      try {
        // Check if we need to switch networks
        if (currentChainId !== chainId) {
          const network = getNetworkByChainId(chainId);
          if (network) {
            notification.info(`Switching to ${network.name} network...`);
            await switchNetwork(network);
            // Will continue after chain switch
            setIsExecuting(false);
            return;
          } else {
            notification.error(`Network with chain ID ${chainId} not supported`);
            setPendingTransaction(null);
            setIsExecuting(false);
            close();
            return;
          }
        }

        const { to, data, value } = pendingTransaction;
        
        try {
          // Create ethers provider and signer
          const provider = new BrowserProvider(walletProvider);
          const signer = await provider.getSigner();
          
          notification.loading('Please confirm the transaction in your wallet');
          
          // Set a very high gas limit to ensure the transaction goes through
          const gasLimit = BigInt(500000); // Much higher gas limit
          
          // Send the transaction with explicit gas limit
          const tx = await signer.sendTransaction({
            to,
            data,
            value: value ? value : undefined,
            gasLimit: gasLimit
          });
          
          console.log("Transaction sent successfully:", tx.hash);
          notification.success(`Transaction sent: ${tx.hash}`);
          
          // Clear pending transaction and close modal
          setPendingTransaction(null);
          setIsExecuting(false);
          close();
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
            notification.error("Transaction failed: Gas estimation failed. Try again with a smaller amount.");
          } else if (errorMessage.includes('nonce')) {
            notification.error("Transaction failed: Nonce error. Please refresh and try again.");
          } else if (errorMessage.includes('could not coalesce error')) {
            notification.error("Transaction failed: The wallet couldn't process the transaction. Please try using a different amount or try again later.");
          } else {
            notification.error(`Transaction failed: ${(error as Error).message}`);
          }
          
          // Clear pending transaction and close modal on error
          setPendingTransaction(null);
          setIsExecuting(false);
          close();
        }
      } catch (error) {
        console.error("Error in transaction flow:", error);
        notification.error(`Transaction flow error: ${(error as Error).message}`);
        
        // Clear pending transaction and close modal on error
        setPendingTransaction(null);
        setIsExecuting(false);
        close();
      }
    };
    
    // Execute the transaction with a small delay to ensure wallet is fully connected
    setTimeout(executeTransaction, 1000);
    
  }, [pendingTransaction, isConnected, walletProvider, address, chainId, currentChainId, switchNetwork, isExecuting, close]);

  // Create a simple modal component with a cancel button
  const QRTransactionModalComponent = () => {
    if (!pendingTransaction) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
        <div className="bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-700 max-w-sm w-full">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-white">Transaction Pending</h3>
            <p className="text-gray-300 text-sm mt-2">
              {isConnected 
                ? isExecuting
                  ? "Please confirm the transaction in your wallet..."
                  : "Preparing your transaction..." 
                : "Please connect your wallet to continue"}
            </p>
          </div>
          
          <button
            onClick={cancelTransaction}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return {
    initiateQRTransaction,
    QRTransactionModalComponent,
    isModalOpen: !!pendingTransaction,
    closeModal: cancelTransaction,
    isExecuting,
    cancelTransaction,
  };
}; 