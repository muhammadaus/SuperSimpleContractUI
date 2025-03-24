"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, formatEther, parseEther, createPublicClient, http, Address } from 'viem';
import * as viemChains from 'viem/chains';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { 
  useAppKit, 
  useAppKitAccount, 
  useAppKitProvider, 
  useAppKitNetwork,
  useDisconnect,
  createAppKit
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { BrowserProvider } from 'ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in ERC20 interface...');
    // Project metadata
    const metadata = {
      name: 'WrapTX ERC20',
      description: 'Interact with ERC20 tokens',
      url: 'https://reown.net',
      icons: ['https://reown.net/images/logo.png'],
    };
    
    // WalletConnect project ID (get from environment or use placeholder)
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';
    
    // Create ethers adapter
    const ethersAdapter = new EthersAdapter();
    
    // Generate AppKit networks from all available viem chains
    const viemChainsArray = Object.values(viemChains).filter(
      (chain): chain is typeof viemChains.mainnet => 
        typeof chain === 'object' && 
        chain !== null && 
        'id' in chain && 
        typeof chain.id === 'number'
    );
    
    // Convert viem chains to AppKit networks
    const appKitNetworks: AppKitNetwork[] = viemChainsArray.map(chain => ({
      id: chain.id,
      name: chain.name || `Chain ${chain.id}`,
      rpcUrls: {
        default: {
          http: chain.rpcUrls?.default?.http || [`https://rpc.ankr.com/${chain.id}`]
        }
      },
      nativeCurrency: {
        name: chain.nativeCurrency?.name || 'Ether',
        symbol: chain.nativeCurrency?.symbol || 'ETH',
        decimals: chain.nativeCurrency?.decimals || 18,
      },
      blockExplorers: chain.blockExplorers?.default 
        ? {
            default: {
              url: chain.blockExplorers.default.url,
              name: chain.blockExplorers.default.name || 'Explorer'
            }
          }
        : {
            default: {
              url: `https://etherscan.io`,
              name: 'Explorer'
            }
          }
    }));
    
    // Ensure we have at least mainnet as the first item
    const mainnetNetwork = appKitNetworks.find(n => n.id === 1);
    if (mainnetNetwork) {
      // Move mainnet to the beginning of the array
      const filteredNetworks = appKitNetworks.filter(n => n.id !== 1);
      const networks = [mainnetNetwork, ...filteredNetworks] as [AppKitNetwork, ...AppKitNetwork[]];
      
      console.log(`Initializing AppKit with ${networks.length} networks`);
      console.log('Networks included:', networks.map(n => `${n.name} (${n.id})`).slice(0, 5), '...');
      
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
          // Theme customization if needed
        },
      });
    } else {
      throw new Error("Mainnet network not found in viem chains");
    }
    
    // Mark as initialized
    (window as any).__APPKIT_INITIALIZED__ = true;
    console.log('AppKit initialized in ERC20 interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

export default function ERC20Interface() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);

  // Get user address from AppKit
  const { targetNetwork } = useTargetNetwork();
  const { isConnected, address: userAddress } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  const { walletProvider } = useAppKitProvider<any>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!contractData?.address || !contractData?.abi) return;

      try {
        const client = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Read token name
        try {
          const name = await client.readContract({
            address: contractData.address,
            abi: contractData.abi,
            functionName: 'name',
            args: []
          });
          console.log("Token Name:", name);
          setTokenName(typeof name === 'string' ? name : String(name));
        } catch (error) {
          console.error("Error reading token name:", error);
        }

        // Read token symbol
        try {
          const symbol = await client.readContract({
            address: contractData.address,
            abi: contractData.abi,
            functionName: 'symbol',
            args: []
          });
          console.log("Token Symbol:", symbol);
          setTokenSymbol(typeof symbol === 'string' ? symbol : String(symbol));
        } catch (error) {
          console.error("Error reading token symbol:", error);
        }

        // Read user balance if address is available
        if (userAddress) {
          try {
            const balance = await client.readContract({
              address: contractData.address,
              abi: contractData.abi,
              functionName: 'balanceOf',
              args: [userAddress as Address]
            });
            console.log("User Balance:", balance);
            setUserBalance(typeof balance === 'bigint' ? balance : BigInt(String(balance)));
          } catch (error) {
            console.error("Error reading user balance:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching token info:", error);
      }
    };

    fetchTokenInfo();
  }, [contractData, userAddress, targetNetwork]);

  // Check for pending transactions when wallet connects
  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (isConnected && userAddress && typeof window !== 'undefined') {
        // Check for pending transfer
        const pendingTransfer = window.sessionStorage.getItem('pendingERC20Transfer');
        if (pendingTransfer) {
          try {
            const txData = JSON.parse(pendingTransfer);
            
            // Apply the stored transaction data
            if (txData.recipientAddress) setRecipientAddress(txData.recipientAddress);
            if (txData.amount) setAmount(txData.amount);
            
            // Clear the stored transaction
            window.sessionStorage.removeItem('pendingERC20Transfer');
            
            notification.info("Transfer details restored. You can now proceed with your transaction.");
          } catch (error) {
            console.error("Error parsing pending transfer:", error);
            window.sessionStorage.removeItem('pendingERC20Transfer');
          }
        }
        
        // Check for pending approve
        const pendingApprove = window.sessionStorage.getItem('pendingERC20Approve');
        if (pendingApprove) {
          try {
            const txData = JSON.parse(pendingApprove);
            
            // Apply the stored transaction data
            if (txData.spenderAddress) setSpenderAddress(txData.spenderAddress);
            if (txData.amount) setAmount(txData.amount);
            
            // Clear the stored transaction
            window.sessionStorage.removeItem('pendingERC20Approve');
            
            notification.info("Approval details restored. You can now proceed with your transaction.");
          } catch (error) {
            console.error("Error parsing pending approval:", error);
            window.sessionStorage.removeItem('pendingERC20Approve');
          }
        }
      }
    };
    
    checkPendingTransactions();
  }, [isConnected, userAddress]);

  // Clear any stale connection flags on component mount and when connection status changes
  useEffect(() => {
    // Check for stale connection flags
    if (typeof window !== 'undefined') {
      const connectionInProgress = window.sessionStorage.getItem('walletConnectionInProgress');
      const connectionTimestamp = window.sessionStorage.getItem('walletConnectionTimestamp');
      
      // If connection was initiated more than 2 minutes ago or user is now connected, clear the flag
      if (connectionInProgress) {
        const now = Date.now();
        const timestamp = connectionTimestamp ? parseInt(connectionTimestamp, 10) : 0;
        
        if (isConnected || now - timestamp > 120000 || !connectionTimestamp) {
          window.sessionStorage.removeItem('walletConnectionInProgress');
          window.sessionStorage.removeItem('walletConnectionTimestamp');
        }
      }
    }
    
    // If user is connected, ensure connection flags are cleared
    if (isConnected && typeof window !== 'undefined') {
      window.sessionStorage.removeItem('walletConnectionInProgress');
      window.sessionStorage.removeItem('walletConnectionTimestamp');
    }
  }, [isConnected]);

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !amount || !contractData) return;
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !userAddress) {
      notification.info("Please connect your wallet first");
      try {
        // Store pending transaction parameters
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('pendingERC20Transfer', JSON.stringify({
            recipientAddress,
            amount
          }));
          console.log("Stored pending ERC20 transfer transaction");
        }
        
        // Set a flag to indicate connection is in progress
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('walletConnectionInProgress', 'true');
          window.sessionStorage.setItem('walletConnectionTimestamp', Date.now().toString());
        }
        
        // Open AppKit to connect wallet
        openAppKit();
        
        // Clear connection flag after a timeout to prevent blocking future connection attempts
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('walletConnectionInProgress');
            window.sessionStorage.removeItem('walletConnectionTimestamp');
          }
        }, 30000); // 30 seconds timeout for connection attempt
        
        return;
      } catch (error) {
        console.error("Error opening wallet:", error);
        notification.error("Could not open wallet connection");
        // Clear connection flag on error
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('walletConnectionInProgress');
          window.sessionStorage.removeItem('walletConnectionTimestamp');
        }
        return;
      }
    }
    
    // Check if a connection or transaction is already in progress
    if (isLoading) {
      notification.info("Please wait for the current operation to complete");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const parsedAmount = parseEther(amount);
      
      // Check if we need to switch networks
      if (currentChainId !== targetNetwork.id) {
        notification.info(`Switching to ${targetNetwork.name} network...`);
        try {
          // Direct wallet provider call to switch chains
          if (walletProvider && walletProvider.request) {
            try {
              // First try to switch to the chain
              await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
              });
              notification.success(`Switched to ${targetNetwork.name}!`);
            } catch (switchError: any) {
              // If the chain hasn't been added to the wallet yet, try to add it
              if (switchError.code === 4902 || 
                  switchError.message?.includes('wallet_addEthereumChain') ||
                  switchError.message?.includes('Unrecognized chain ID')) {
                try {
                  // Find the chain details from viem
                  const viemChain = Object.values(viemChains).find(
                    (chain) => typeof chain === 'object' && 
                              chain !== null && 
                              'id' in chain && 
                              chain.id === targetNetwork.id
                  );
                  
                  if (!viemChain || typeof viemChain !== 'object') {
                    throw new Error(`Chain with ID ${targetNetwork.id} not found in viem chains`);
                  }
                  
                  // Add the chain to the wallet
                  await walletProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: `0x${targetNetwork.id.toString(16)}`,
                      chainName: targetNetwork.name,
                      nativeCurrency: {
                        name: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.name : 'Ether',
                        symbol: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.symbol : 'ETH',
                        decimals: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.decimals : 18
                      },
                      rpcUrls: 'rpcUrls' in viemChain && 
                               viemChain.rpcUrls && 
                               'default' in viemChain.rpcUrls && 
                               'http' in viemChain.rpcUrls.default ? 
                                 viemChain.rpcUrls.default.http : 
                                 [`https://rpc.ankr.com/${targetNetwork.id}`],
                      blockExplorerUrls: 'blockExplorers' in viemChain && 
                                         viemChain.blockExplorers && 
                                         'default' in viemChain.blockExplorers ? 
                                           [viemChain.blockExplorers.default.url] : 
                                           ['https://etherscan.io']
                    }]
                  });
                  
                  notification.success(`Added and switched to ${targetNetwork.name}`);
                } catch (addError) {
                  console.error("Error adding chain to wallet:", addError);
                  notification.error(`Could not add ${targetNetwork.name} to your wallet`);
                  setIsLoading(false);
                  return;
                }
              } else {
                console.error("Error switching chain:", switchError);
                notification.error(`Could not switch to ${targetNetwork.name}`);
                setIsLoading(false);
                return;
              }
            }
          } else {
            throw new Error("Wallet provider not available or doesn't support network switching");
          }
        } catch (switchError) {
          console.error("Failed to switch network:", switchError);
          notification.error(`Failed to switch network: ${(switchError as Error).message}`);
          setIsLoading(false);
          return;
        }
      }
      
      // Create ethers provider and signer
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsLoading(false);
        return;
      }
      
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      
      // Create the transfer data
      // For ERC20 transfer: function transfer(address to, uint256 amount)
      // Function signature: 0xa9059cbb
      const transferData = '0xa9059cbb' + 
        recipientAddress.substring(2).padStart(64, '0') + 
        parsedAmount.toString(16).padStart(64, '0');
      
      console.log("Initiating transfer transaction");
      console.log("Amount:", amount, "Parsed amount:", parsedAmount.toString());
      console.log("Recipient:", recipientAddress);
      
      try {
        notification.info(`Transferring ${amount} ${tokenSymbol} to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)}...`);
        
        const tx = await signer.sendTransaction({
          to: contractData.address as string,
          data: transferData,
        });
        
        notification.success(`Transaction sent: ${tx.hash}`);
        console.log("Transfer transaction:", tx.hash);
        
        // Reset amount after transaction is sent
        setAmount('');
      } catch (txError) {
        console.error("Failed to transfer:", txError);
        notification.error(`Transaction failed: ${(txError as Error).message}`);
      }
    } catch (error) {
      console.error("Transfer failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      
      // Clear any connection flags
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('walletConnectionInProgress');
        window.sessionStorage.removeItem('walletConnectionTimestamp');
      }
    }
  };

  const handleApprove = async () => {
    if (!isAddress(spenderAddress) || !amount || !contractData) return;
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !userAddress) {
      notification.info("Please connect your wallet first");
      try {
        // Store pending transaction parameters
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('pendingERC20Approve', JSON.stringify({
            spenderAddress,
            amount
          }));
          console.log("Stored pending ERC20 approve transaction");
        }
        
        // Set a flag to indicate connection is in progress
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('walletConnectionInProgress', 'true');
          window.sessionStorage.setItem('walletConnectionTimestamp', Date.now().toString());
        }
        
        // Open AppKit to connect wallet
        openAppKit();
        
        // Clear connection flag after a timeout to prevent blocking future connection attempts
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('walletConnectionInProgress');
            window.sessionStorage.removeItem('walletConnectionTimestamp');
          }
        }, 30000); // 30 seconds timeout for connection attempt
        
        return;
      } catch (error) {
        console.error("Error opening wallet:", error);
        notification.error("Could not open wallet connection");
        // Clear connection flag on error
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('walletConnectionInProgress');
          window.sessionStorage.removeItem('walletConnectionTimestamp');
        }
        return;
      }
    }
    
    // Check if a connection or transaction is already in progress
    if (isLoading) {
      notification.info("Please wait for the current operation to complete");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const parsedAmount = parseEther(amount);
      
      // Check if we need to switch networks
      if (currentChainId !== targetNetwork.id) {
        notification.info(`Switching to ${targetNetwork.name} network...`);
        try {
          // Direct wallet provider call to switch chains
          if (walletProvider && walletProvider.request) {
            try {
              // First try to switch to the chain
              await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
              });
              notification.success(`Switched to ${targetNetwork.name}!`);
            } catch (switchError: any) {
              // If the chain hasn't been added to the wallet yet, try to add it
              if (switchError.code === 4902 || 
                  switchError.message?.includes('wallet_addEthereumChain') ||
                  switchError.message?.includes('Unrecognized chain ID')) {
                try {
                  // Find the chain details from viem
                  const viemChain = Object.values(viemChains).find(
                    (chain) => typeof chain === 'object' && 
                              chain !== null && 
                              'id' in chain && 
                              chain.id === targetNetwork.id
                  );
                  
                  if (!viemChain || typeof viemChain !== 'object') {
                    throw new Error(`Chain with ID ${targetNetwork.id} not found in viem chains`);
                  }
                  
                  // Add the chain to the wallet
                  await walletProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: `0x${targetNetwork.id.toString(16)}`,
                      chainName: targetNetwork.name,
                      nativeCurrency: {
                        name: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.name : 'Ether',
                        symbol: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.symbol : 'ETH',
                        decimals: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.decimals : 18
                      },
                      rpcUrls: 'rpcUrls' in viemChain && 
                               viemChain.rpcUrls && 
                               'default' in viemChain.rpcUrls && 
                               'http' in viemChain.rpcUrls.default ? 
                                 viemChain.rpcUrls.default.http : 
                                 [`https://rpc.ankr.com/${targetNetwork.id}`],
                      blockExplorerUrls: 'blockExplorers' in viemChain && 
                                         viemChain.blockExplorers && 
                                         'default' in viemChain.blockExplorers ? 
                                           [viemChain.blockExplorers.default.url] : 
                                           ['https://etherscan.io']
                    }]
                  });
                  
                  notification.success(`Added and switched to ${targetNetwork.name}`);
                } catch (addError) {
                  console.error("Error adding chain to wallet:", addError);
                  notification.error(`Could not add ${targetNetwork.name} to your wallet`);
                  setIsLoading(false);
                  return;
                }
              } else {
                console.error("Error switching chain:", switchError);
                notification.error(`Could not switch to ${targetNetwork.name}`);
                setIsLoading(false);
                return;
              }
            }
          } else {
            throw new Error("Wallet provider not available or doesn't support network switching");
          }
        } catch (switchError) {
          console.error("Failed to switch network:", switchError);
          notification.error(`Failed to switch network: ${(switchError as Error).message}`);
          setIsLoading(false);
          return;
        }
      }
      
      // Create ethers provider and signer
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsLoading(false);
        return;
      }
      
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      
      // Create the approve data
      // For ERC20 approve: function approve(address spender, uint256 amount)
      // Function signature: 0x095ea7b3
      const approveData = '0x095ea7b3' + 
        spenderAddress.substring(2).padStart(64, '0') + 
        parsedAmount.toString(16).padStart(64, '0');
      
      console.log("Initiating approve transaction");
      console.log("Amount:", amount, "Parsed amount:", parsedAmount.toString());
      console.log("Spender:", spenderAddress);
      
      try {
        notification.info(`Approving ${amount} ${tokenSymbol} for ${spenderAddress.substring(0, 6)}...${spenderAddress.substring(38)}...`);
        
        const tx = await signer.sendTransaction({
          to: contractData.address as string,
          data: approveData,
        });
        
        notification.success(`Transaction sent: ${tx.hash}`);
        console.log("Approve transaction:", tx.hash);
        
        // Reset amount after transaction is sent
        setAmount('');
      } catch (txError) {
        console.error("Failed to approve:", txError);
        notification.error(`Transaction failed: ${(txError as Error).message}`);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      
      // Clear any connection flags
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('walletConnectionInProgress');
        window.sessionStorage.removeItem('walletConnectionTimestamp');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          {tokenName} {tokenSymbol ? `(${tokenSymbol})` : ''}
        </h2>
        <p className="text-md text-gray-300 mt-2">
          {userAddress ? (
            <>Your Balance: <span className="font-bold">{formatEther(userBalance)} {tokenSymbol}</span></>
          ) : (
            <span className="italic">Connect your wallet to view balance</span>
          )}
        </p>
      </div>

      {/* Transfer Section */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Transfer Tokens
        </h3>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address"
          className={`w-full my-2 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border 
            ${!isAddress(recipientAddress) && recipientAddress ? 'border-red-500' : 'border-gray-700'}
            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 
            ${!isAddress(recipientAddress) && recipientAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full my-2 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !amount || isLoading}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !amount || isLoading)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            Transfer
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
      </div>

      {/* Approve Section */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Approve Spender
        </h3>
        <input
          type="text"
          value={spenderAddress}
          onChange={(e) => setSpenderAddress(e.target.value)}
          placeholder="Spender address"
          className={`w-full my-2 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border 
            ${!isAddress(spenderAddress) && spenderAddress ? 'border-red-500' : 'border-gray-700'}
            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 
            ${!isAddress(spenderAddress) && spenderAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full my-2 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleApprove}
          disabled={!isAddress(spenderAddress) || !amount || isLoading}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(spenderAddress) || !amount || isLoading)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            Approve
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
              setAmount('');
            }}
            className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
} 