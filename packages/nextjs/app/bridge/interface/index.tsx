"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
import * as viemChains from 'viem/chains';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";
import { 
  useAppKit, 
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
  createAppKit
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in bridge interface...');
    // Project metadata
    const metadata = {
      name: 'PureContracts Bridge',
      description: 'Bridge assets across networks',
      url: 'https://reown.net',
      icons: ['https://reown.net/images/logo.png'],
    };
    
    // WalletConnect project ID (get from environment or use placeholder)
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';
    
    // Create ethers adapter
    const ethersAdapter = new EthersAdapter();
    
    // Define supported networks
    const networks = [mainnet, arbitrum, sepolia] as [AppKitNetwork, ...AppKitNetwork[]];
    
    createAppKit({
      adapters: [ethersAdapter],
      networks,
      metadata,
      projectId,
      themeMode: 'dark',
      features: {
        analytics: true,
      },
      themeVariables: {
        '--w3m-accent': '#3b82f6', // Blue color to match your UI
      },
    });
    (window as any).__APPKIT_INITIALIZED__ = true;
    console.log('AppKit initialized successfully');
  } catch (error) {
    console.error('AppKit initialization failed:', error);
  }
}

export default function BridgeInterface() {
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [inputTokenAddress, setInputTokenAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [targetChainId, setTargetChainId] = useState<string>('84532'); // Default to Base Goerli
  
  // Get all chain information from viem
  const availableChains = useMemo(() => {
    return Object.values(viemChains)
      .filter(chain => 
        typeof chain === 'object' && 
        'id' in chain && 
        'name' in chain &&
        chain.id !== 1 // Exclude mainnet as it's typically the source chain
      )
      .map(chain => ({
        id: chain.id.toString(),
        name: chain.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  
  // AppKit hooks for wallet connection
  const { open: openAppKit } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155") as any;
  const { disconnect } = useDisconnect();
  
  // Default to the first account for reading purposes
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const { targetNetwork } = useTargetNetwork();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

  // Update wallet connection effect to use AppKit
  useEffect(() => {
    if (address) {
      setUserAddress(address);
      console.log("AppKit wallet connected:", address);
    } else {
      setUserAddress(null);
    }
  }, [address, isConnected]);

  // Check for pending bridge transactions on startup
  useEffect(() => {
    const checkPendingBridge = () => {
      if (typeof window === 'undefined') return;
      
      const pendingBridge = window.sessionStorage.getItem('pendingBridge');
      if (pendingBridge) {
        try {
          const { recipientAddress: savedRecipient, amount: savedAmount, 
                 targetChainId: savedChainId, inputTokenAddress: savedInputToken } = JSON.parse(pendingBridge);
          
          setRecipientAddress(savedRecipient || '');
          setAmount(savedAmount || '');
          setTargetChainId(savedChainId || '84532');
          setInputTokenAddress(savedInputToken || '');
          
          // Only clear the data if we have a wallet connected
          if (address) {
            window.sessionStorage.removeItem('pendingBridge');
            notification.info("Restored your pending bridge transaction");
            
            // If we have all the necessary data, attempt to continue the bridge
            if (savedRecipient && savedAmount && savedChainId) {
              setTimeout(() => {
                handleBridge();
              }, 1000);
            }
          }
        } catch (error) {
          console.error("Error restoring pending bridge:", error);
          window.sessionStorage.removeItem('pendingBridge');
        }
      }
    };
    
    checkPendingBridge();
  }, [address, isConnected]);

  // Check and switch chain if needed using walletProvider
  const checkAndSwitchChain = async () => {
    if (!walletProvider || !walletProvider.request) return false;
    
    try {
      const chainIdHex = await walletProvider.request({ method: 'eth_chainId', params: [] });
      const currentChainId = parseInt(chainIdHex, 16);
      
      console.log(`Current chain ID: ${currentChainId}, Target chain ID: ${targetNetwork.id}`);
      
      if (currentChainId !== targetNetwork.id) {
        notification.info(`Please switch your wallet to ${targetNetwork.name} (Chain ID: ${targetNetwork.id})`);
        
        try {
          await walletProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
          });
          
          notification.success(`Switched to ${targetNetwork.name}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.message?.includes('wallet_addEthereumChain')) {
            try {
              await walletProvider.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${targetNetwork.id.toString(16)}`,
                    chainName: targetNetwork.name,
                    nativeCurrency: {
                      name: targetNetwork.nativeCurrency.name,
                      symbol: targetNetwork.nativeCurrency.symbol,
                      decimals: targetNetwork.nativeCurrency.decimals
                    },
                    rpcUrls: targetNetwork.rpcUrls.default.http,
                    blockExplorerUrls: targetNetwork.blockExplorers ? 
                      [targetNetwork.blockExplorers.default.url] : undefined
                  },
                ],
              });
              
              notification.success(`Added and switched to ${targetNetwork.name}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return true;
            } catch (addError) {
              console.error("Error adding chain:", addError);
              notification.error(`Could not add ${targetNetwork.name} to your wallet. Please switch manually.`);
              return false;
            }
          } else {
            console.error("Error switching chains:", switchError);
            notification.error("Could not switch networks. Please switch manually in your wallet.");
            return false;
          }
        }
      }
      return true; // Already on the correct chain
    } catch (chainError) {
      console.error("Error checking chain:", chainError);
      notification.info("Could not verify current network. Attempting bridge anyway.");
      return true; // Proceed anyway
    }
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (!userAddress) return;

      try {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address: userAddress as Address });
        setUserBalance(ethBalance);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [userAddress, targetNetwork]);

  // Add a function to execute native wallet transactions directly
  const executeNativeTransaction = async (to: string, data: string, value: bigint, gasLimit: bigint = BigInt(300000)) => {
    if (!walletProvider || !walletProvider.request || !address) {
      notification.error("Wallet provider not available");
      return false;
    }
    
    try {
      const txParams = {
        from: address,
        to: to,
        value: `0x${value.toString(16)}`,
        data: data,
        gas: `0x${gasLimit.toString(16)}`, // Add explicit gas limit
      };
      
      console.log("Sending transaction with parameters:", txParams);
      
      // Send transaction using the wallet provider
      const txHash = await walletProvider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      
      console.log("Transaction sent successfully:", txHash);
      notification.success(`Transaction submitted`);
      return true;
    } catch (error) {
      console.error("Error sending transaction:", error);
      notification.error(`Transaction failed: ${(error as any)?.message || 'Unknown error'}`);
      return false;
    }
  }

  const handleBridge = async () => {
    console.log("Bridge button clicked");
    console.log("Current state:", {
      recipientAddress,
      amount,
      contractAddress: contractData?.address,
      userAddress,
      isAddressValid: isAddress(recipientAddress),
      amountValid: amount && parseFloat(amount) > 0,
      isLoading
    });

    if (!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || !contractData?.address) {
      if (!contractData?.address) {
        notification.error("Contract address not found");
      }
      if (!isAddress(recipientAddress)) {
        notification.error("Invalid recipient address");
      }
      if (!amount || parseFloat(amount) <= 0) {
        notification.error("Invalid amount");
      }
      return;
    }

    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !address) {
      notification.info("Please connect your wallet first");
      try {
        // Store pending transaction parameters
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('pendingBridge', JSON.stringify({
            recipientAddress,
            amount,
            targetChainId,
            inputTokenAddress
          }));
          console.log("Stored pending bridge transaction");
        }
        
        // Open AppKit to connect wallet
        openAppKit();
        return;
      } catch (error) {
        console.error("Error opening wallet:", error);
        notification.error("Could not open wallet connection");
        return;
      }
    }

    // Check if wallet is on the correct chain
    const isChainCorrect = await checkAndSwitchChain();
    if (!isChainCorrect) return;

    setIsLoading(true);
    
    try {
      const parsedAmount = parseEther(amount);
      
      try {
        // For depositV3 function
        const functionSignature = '0x7b939232'; // depositV3 function signature
        
        // Make sure userAddress exists before using it
        if (!userAddress) {
          notification.error("Wallet not connected");
          setIsLoading(false);
          return;
        }
        
        // Helper function to properly pad and format addresses and numbers for ABI encoding
        const padAddress = (address: string) => {
          return address.toLowerCase().startsWith('0x') 
            ? address.slice(2).padStart(64, '0') 
            : address.padStart(64, '0');
        };
        
        const padUint256 = (value: bigint) => {
          return value.toString(16).padStart(64, '0');
        };
        
        const padUint32 = (value: number) => {
          return value.toString(16).padStart(64, '0');
        };
        
        // Default input token to zero address if not provided (for ETH)
        const inputTokenAddr = inputTokenAddress && isAddress(inputTokenAddress)
          ? inputTokenAddress
          : '0x0000000000000000000000000000000000000000';
        
        // Fix output token - CRITICAL: Use EXACT FORMAT from working sample
        // Working: 0000000000000000000000004200000000000000000000000000000000000006
        const outputTokenAddr = '0000000000000000000000004200000000000000000000000000000000000006';
        
        // CRITICAL: Looking at the successful bytecode timestamps closely
        // Working from hex: 0x67ddebe0 (quoteTimestamp) -> 0x67de1af4 (fillDeadline)
        // The difference is EXACTLY 86400 seconds (24 hours)
        
        // Use the EXACT values from the working example but with a fixed offset
        // to ensure they're in the future
        const nowTimestamp = Math.floor(Date.now() / 1000);
        
        // Difference between now and the working timestamp
        const timeOffset = nowTimestamp - 0x67ddebe0; // Difference from working example to now
        
        // Set quoteTimestamp and fillDeadline with the same relative difference as in the working example
        const quoteTimestamp = 0x67ddebe0 + timeOffset; // Working timestamp adjusted to current time
        const fillDeadline = 0x67de1af4 + timeOffset;   // Working fillDeadline adjusted to current time
        
        // Double check the difference is exactly 86400 seconds (24 hours)
        const difference = fillDeadline - quoteTimestamp;
        console.log(`Difference between timestamps: ${difference} (should be 86400)`);
        
        // Log all values for debugging
        console.log("Using timestamps:", {
          nowTimestamp,
          timeOffset,
          working: {
            quoteTimestamp: "0x67ddebe0",
            fillDeadline: "0x67de1af4",
            diff: 0x67de1af4 - 0x67ddebe0
          },
          adjusted: {
            quoteTimestamp: `0x${quoteTimestamp.toString(16)}`,
            fillDeadline: `0x${fillDeadline.toString(16)}`,
            diff: fillDeadline - quoteTimestamp
          }
        });
        
        // Message bytes - following the format from the successful transaction
        // The message parameter needs a specific format with offset and length
        const messageOffset = '0000000000000000000000000000000000000000000000000000000000000180'; // Offset to message data (384 bytes)
        const messageLength = '0000000000000000000000000000000000000000000000000000000000000001'; // Length of message data (1 byte)
        const messageData = 'dc0de0000000000000000000000000000000000000000000000000000000000000'; // Message data with padding
        
        // IMPORTANT: Create exact bytecode matching the working transaction format
        const bridgeData = 
          functionSignature +
          padAddress(userAddress) + // depositor
          padAddress(recipientAddress) + // recipient
          padAddress(inputTokenAddr) + // inputToken
          outputTokenAddr + // outputToken (WETH on Base) - use exact format that worked
          padUint256(parsedAmount) + // inputAmount
          padUint256(parsedAmount) + // outputAmount (same as input for now)
          padUint256(BigInt(targetChainId)) + // destinationChainId
          padAddress('0x0000000000000000000000000000000000000000') + // exclusiveRelayer
          padUint32(quoteTimestamp) + // Adjusted timestamp based on working example
          padUint32(fillDeadline) + // Adjusted fillDeadline based on working example
          padUint32(0) + // exclusivityParameter
          messageOffset; // Offset to message data in bytes
          
        // Append the message data with its length and content
        const fullBridgeData = bridgeData + messageLength + messageData;
        
        console.log("Generated bridge data:", fullBridgeData);
        
        // Generate gas params for better control over gas - critical for complex contract calls
        const gasLimit = BigInt(2000000); // Use 2M gas limit as in successful transaction
        
        notification.info(`Initiating bridge of ${amount} ETH to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)} on chain ID ${targetChainId}...`);
        
        // Execute the bridge transaction
        const success = await executeNativeTransaction(
          contractData.address as string,
          fullBridgeData,
          parsedAmount,
          gasLimit
        );
        
        if (success) {
          // Don't reset fields after transaction is initiated so user can click again
          notification.success("Bridge transaction initiated. Fields kept for convenience.");
          // Only reset loading state
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initiate bridge transaction:", error);
        notification.error(`Failed to initiate bridge: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Bridge failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Add debug button to check state
  const debugState = () => {
    console.log("Current state:", {
      recipientAddress,
      amount,
      contractAddress: contractData?.address,
      userAddress,
      address,
      isConnected,
      hasWalletProvider: !!walletProvider,
      isAddressValid: isAddress(recipientAddress),
      amountValid: amount && parseFloat(amount) > 0,
      isLoading,
      targetNetwork,
      availableChains
    });
  };
  
  // Disconnect wallet function
  const disconnectWallet = () => {
    try {
      disconnect();
      notification.info("Wallet disconnected");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Bridge Assets
        </h2>
        <p className="text-md text-gray-300 mt-2">
          Transfer tokens across different blockchain networks
        </p>
      </div>

      {/* Bridge Form */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        {/* Show connected wallet status if connected */}
        {isConnected ? (
          <div className="mb-4">
            <div className="py-2 px-3 rounded-lg bg-green-900/30 border border-green-700 text-green-200 text-sm">
              Connected: {address?.substring(0, 6)}...{address?.substring(38)}
            </div>
            <button
              onClick={disconnectWallet}
              className="mt-2 text-xs text-gray-400 hover:text-gray-300"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <button
              onClick={() => openAppKit()}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Connect Wallet
            </button>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Source Network
          </label>
          <div className="py-2 px-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
            {targetNetwork.name} (Chain ID: {targetNetwork.id})
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Destination Network
          </label>
          <select
            value={targetChainId}
            onChange={(e) => setTargetChainId(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {availableChains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name} (Chain ID: {chain.id})
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Input Token Address (Optional - Leave empty for ETH)
          </label>
          <input
            type="text"
            value={inputTokenAddress}
            onChange={(e) => setInputTokenAddress(e.target.value)}
            placeholder="0x..."
            className={`w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border 
              ${inputTokenAddress && !isAddress(inputTokenAddress) ? 'border-red-500' : 'border-gray-700'}
              text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 
              ${inputTokenAddress && !isAddress(inputTokenAddress) ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
          />
          {inputTokenAddress && !isAddress(inputTokenAddress) && (
            <p className="mt-1 text-xs text-red-500">Please enter a valid Ethereum address</p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            className={`w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border 
              ${!isAddress(recipientAddress) && recipientAddress ? 'border-red-500' : 'border-gray-700'}
              text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 
              ${!isAddress(recipientAddress) && recipientAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
          />
          {!isAddress(recipientAddress) && recipientAddress && (
            <p className="mt-1 text-xs text-red-500">Please enter a valid Ethereum address</p>
          )}
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Amount to Bridge
            </label>
            {userAddress && (
              <button
                onClick={() => setAmount(formatEther(userBalance))}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Max
              </button>
            )}
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {userAddress && (
            <p className="mt-1 text-xs text-gray-400">
              Balance: {formatEther(userBalance)} ETH
            </p>
          )}
        </div>
        
        <div className="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700 text-yellow-200 text-sm">
          <p>
            <span className="font-medium">⚠️ Important:</span> Bridging assets may take several minutes to hours to complete depending on the networks involved.
          </p>
        </div>
        
        <button
          onClick={handleBridge}
          disabled={!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || isLoading}
          className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || isLoading)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            Bridge Assets
          </span>
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </button>

        {/* Add debug button */}
        <button
          onClick={debugState}
          className="mt-2 w-full py-2 px-4 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-xs"
        >
          Debug State
        </button>
      </div>
      
      {/* Cancel transaction option during loading */}
      {isLoading && (
        <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="text-center mb-2">
            Transaction in progress. Please check your wallet for confirmation requests.
          </p>
          <button
            onClick={() => {
              setIsLoading(false);
            }}
            className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Information Card */}
      <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
        <h3 className="font-bold mb-2">About Bridging</h3>
        <p className="text-sm mb-2">
          Bridges allow you to move your assets between different blockchain networks. This process typically involves:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Locking your assets on the source chain</li>
          <li>Waiting for confirmation (can take minutes to hours)</li>
          <li>Receiving equivalent assets on the destination chain</li>
        </ol>
        <p className="mt-2 text-sm">
          Bridge fees and processing times vary depending on network congestion and the specific bridge implementation.
        </p>
      </div>
    </div>
  );
} 