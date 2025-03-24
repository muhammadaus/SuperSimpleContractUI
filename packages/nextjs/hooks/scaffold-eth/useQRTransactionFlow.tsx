"use client";

// This file is no longer needed as we're using AppKit's built-in QR code functionality.
// The AppKit library handles wallet connections and QR codes internally.
// Please see the AppKitWallet component for the implementation.

import { useCallback, useState, useEffect } from 'react';
import { Address } from 'viem';
import { notification } from '../../utils/scaffold-eth/notification';
import { 
  useDisconnect,
  useAppKit, 
  useAppKitAccount, 
  useAppKitProvider, 
  useAppKitNetwork,
  createAppKit,
  AppKit
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
      name: 'WrapTX',
      description: 'Token Wrapper',
      url: window?.location?.origin || 'https://WrapTX.com',
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
  const { disconnect } = useDisconnect();
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

  // Function to disconnect wallet and reset state
  const disconnectAndReset = useCallback(() => {
    console.log("Disconnecting wallet and resetting state");
    setPendingTransaction(null);
    setIsExecuting(false);
    
    // The disconnect() function from useAppKit will handle the modal closing
    // We add a small delay to ensure the state is reset before the modal closes
    setTimeout(() => {
      disconnect();
      console.log("Modal closed, wallet disconnected");
    }, 500);
  }, [close]);

  // Function to cancel the transaction
  const cancelTransaction = useCallback(async () => {
    console.log("Transaction cancelled by user");
    notification.info('Transaction cancelled');
    disconnectAndReset();
  }, [disconnectAndReset]);

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
          console.log("Network mismatch detected:", { 
            current: currentChainId, 
            required: chainId,
            networkFound: !!network 
          });
          
          if (network) {
            notification.info(`Switching to ${network.name} network...`);
            try {
              await switchNetwork(network);
              console.log(`Successfully switched to network: ${network.name} (${network.id})`);
              // Will continue after chain switch - need to reset execution state
              setIsExecuting(false);
              return;
            } catch (switchError) {
              console.error("Failed to switch network:", switchError);
              notification.error(`Failed to switch network: ${(switchError as Error).message}`);
              setPendingTransaction(null);
              setIsExecuting(false);
              disconnect();
              return;
            }
          } else {
            notification.error(`Network with chain ID ${chainId} not supported`);
            console.error(`Network with chain ID ${chainId} not found in supported networks:`, 
              [mainnet, sepolia, arbitrum].map(n => `${n.name} (${n.id})`));
            setPendingTransaction(null);
            setIsExecuting(false);
            disconnect();
            return;
          }
        }

        // Double-check that the network is correct before proceeding
        if (currentChainId !== chainId) {
          console.error("Network still doesn't match after attempted switch:", {
            current: currentChainId,
            required: chainId
          });
          notification.error(`Unable to switch to the required network. Please switch manually in your wallet.`);
          setPendingTransaction(null);
          setIsExecuting(false);
          disconnect();
          return;
        }

        console.log("Network validation successful:", {
          chainId,
          currentChainId,
          networkName: getNetworkByChainId(chainId)?.name || 'Unknown'
        });

        const { to, data, value } = pendingTransaction;
        
        try {
          // Create ethers provider and signer
          const provider = new BrowserProvider(walletProvider);
          const signer = await provider.getSigner();
          
          notification.loading('Please confirm the transaction in your wallet');
          
          // Use the simplest possible transaction structure
          // IMPORTANT: The most reliable approach is to let the wallet handle all gas estimation
          // and to avoid setting any gas parameters
          
          // Directly use the wallet's provider when possible - most reliable approach
          if (walletProvider && walletProvider.request) {
            try {
              console.log("Using native wallet provider for transaction");
              
              // Set an explicit gas limit that's higher than the default
              // This helps avoid estimation failures in complex transactions
              const gasLimit = BigInt(500000); // Much higher than standard transfers need
              
              // Using the wallet's native transaction method with explicit gas limit
              console.log("Sending transaction with explicit chainId:", chainId);
              const txHash = await walletProvider.request({
                method: 'eth_sendTransaction',
                params: [{
                  from: address,
                  to,
                  data,
                  value: value && value > BigInt(0) ? `0x${value.toString(16)}` : undefined,
                  gas: `0x${gasLimit.toString(16)}`, // Explicit gas limit
                  chainId: `0x${chainId.toString(16)}` // Explicitly set chain ID
                }]
              });
              
              console.log("Transaction sent successfully:", txHash);
              notification.success(`Transaction sent: ${txHash}`);
              
              // Clear pending transaction and close modal
              setPendingTransaction(null);
              setIsExecuting(false);
              
              // Disconnect the wallet before closing the modal
              console.log("Disconnecting wallet after transaction...");
              disconnectAndReset();
              return;
            } catch (walletError) {
              console.error("Wallet provider transaction failed:", walletError);
              // Fall through to ethers approach as backup
            }
          }
          
          // Fallback to ethers.js (less reliable but works as backup)
          console.log("Falling back to ethers.js for transaction");
          try {
            console.log("Sending ethers transaction with chainId:", chainId);
            const tx = await signer.sendTransaction({
              to,
              data,
              value: value ? value : undefined,
              gasLimit: BigInt(500000), // Explicit gas limit for ethers too
              chainId: chainId // Explicitly set chain ID
            });
            
            console.log("Transaction sent successfully via ethers:", tx.hash);
            notification.success(`Transaction sent: ${tx.hash}`);
            
            // Clear pending transaction and close modal
            setPendingTransaction(null);
            setIsExecuting(false);
            
            // Disconnect the wallet before closing the modal
            console.log("Disconnecting wallet after transaction...");
            disconnectAndReset();
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
              console.error("Detailed transaction error:", error);
              
              // Add detailed logging of the transaction parameters to help diagnose the issue
              console.log("Transaction parameters:", {
                to,
                data,
                value: value ? value.toString() : "0",
                from: address
              });
              
              // This error often happens with wallets that fail to properly handle gas estimation
              // or when the blockchain network is congested
              notification.error(
                "Transaction failed: The network couldn't process this transaction. Try a different amount or try again later."
              );
            } else {
              notification.error(`Transaction failed: ${(error as Error).message}`);
            }
            
            // Clear pending transaction and close modal
            setPendingTransaction(null);
            setIsExecuting(false);
            
            // Disconnect the wallet before closing the modal
            console.log("Disconnecting wallet after error...");
            disconnectAndReset();
          }
        } catch (error) {
          console.error("Error in transaction flow:", error);
          notification.error(`Transaction flow error: ${(error as Error).message}`);
          
          // Clear pending transaction and close modal
          setPendingTransaction(null);
          setIsExecuting(false);
          
          // Disconnect the wallet before closing the modal
          console.log("Disconnecting wallet after error...");
          disconnectAndReset();
        }
      } catch (error) {
        console.error("Error in transaction flow:", error);
        notification.error(`Transaction flow error: ${(error as Error).message}`);
        
        // Clear pending transaction and close modal
        setPendingTransaction(null);
        setIsExecuting(false);
        
        // Disconnect the wallet before closing the modal
        console.log("Disconnecting wallet after error...");
        disconnectAndReset();
      }
    };
    
    // Execute the transaction with a small delay to ensure wallet is fully connected
    setTimeout(executeTransaction, 1000);
    
  }, [pendingTransaction, isConnected, walletProvider, address, chainId, currentChainId, switchNetwork, isExecuting, close, disconnectAndReset]);

  // Create a simple modal component with a cancel button
  const QRTransactionModalComponent = () => {
    if (!pendingTransaction) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
        <div className="bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-700 max-w-xs w-full">
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