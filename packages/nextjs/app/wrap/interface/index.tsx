"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
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

// Utility function to convert viem chain to AppKit network
const convertViemChainToAppKitNetwork = (chainId: number): AppKitNetwork => {
  // Find the chain in viem chains
  const viemChain = Object.values(viemChains).find(
    (chain) => typeof chain === 'object' && chain !== null && 'id' in chain && chain.id === chainId
  );
  
  if (!viemChain || typeof viemChain !== 'object') {
    throw new Error(`Chain with ID ${chainId} not found in viem chains`);
  }
  
  // Convert to AppKit network format
  return {
    id: chainId,
    name: 'name' in viemChain ? String(viemChain.name) : `Chain ${chainId}`,
    rpcUrls: {
      default: {
        http: [
          'rpcUrls' in viemChain && 
          viemChain.rpcUrls && 
          'default' in viemChain.rpcUrls && 
          'http' in viemChain.rpcUrls.default && 
          Array.isArray(viemChain.rpcUrls.default.http) && 
          viemChain.rpcUrls.default.http.length > 0
            ? viemChain.rpcUrls.default.http[0]
            : `https://rpc.ankr.com/${chainId}`
        ]
      }
    },
    nativeCurrency: {
      name: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? String(viemChain.nativeCurrency.name) : 'Ether',
      symbol: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? String(viemChain.nativeCurrency.symbol) : 'ETH',
      decimals: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? Number(viemChain.nativeCurrency.decimals) : 18,
    },
    blockExplorers: {
      default: {
        url: 'blockExplorers' in viemChain && 
             viemChain.blockExplorers && 
             'default' in viemChain.blockExplorers && 
             'url' in viemChain.blockExplorers.default
          ? String(viemChain.blockExplorers.default.url)
          : `https://etherscan.io`,
        name: 'Explorer'
      }
    }
  };
};

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in wrap interface...');
    // Project metadata
    const metadata = {
      name: 'PureContracts Wrap',
      description: 'Wrap and unwrap tokens',
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
    console.log('AppKit initialized in wrap interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

export default function WrapInterface() {
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap, false = unwrap
  const [isLoading, setIsLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [wrappedBalance, setWrappedBalance] = useState<bigint>(BigInt(0));
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [wrappedSymbol, setWrappedSymbol] = useState<string>("");
  
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

  // Detect token type and set names
  useEffect(() => {
    if (!contractData?.abi) return;

    const abi = contractData.abi;
    
    // Check for WETH (has deposit and withdraw functions)
    const isWETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'deposit' &&
        item.stateMutability === 'payable'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'withdraw'
    );

    // Check for wstETH (has wrap and unwrap functions)
    const isWstETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'wrap'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'unwrap'
    );

    if (isWETH) {
      setTokenName("Ether");
      setTokenSymbol("ETH");
      setWrappedSymbol("WETH");
    } else if (isWstETH) {
      setTokenName("Staked Ether");
      setTokenSymbol("stETH");
      setWrappedSymbol("wstETH");
    }
  }, [contractData?.abi]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!userAddress || !contractData?.address) return;

      try {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address: userAddress as Address });
        setUserBalance(ethBalance);

        // Fetch wrapped token balance
        if (contractData.address) {
          const wrappedTokenBalance = await publicClient.readContract({
            address: contractData.address as Address,
            abi: contractData.abi,
            functionName: 'balanceOf',
            args: [userAddress as Address],
          });
          // Make sure we're safely converting to bigint
          setWrappedBalance(typeof wrappedTokenBalance === 'bigint' 
            ? wrappedTokenBalance 
            : BigInt(String(wrappedTokenBalance)));
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [userAddress, contractData, targetNetwork]);

  // Check for pending transactions when wallet connects
  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (isConnected && userAddress && typeof window !== 'undefined') {
        const pendingWrapTx = window.sessionStorage.getItem('pendingWrap');
        
        if (pendingWrapTx) {
          try {
            const txData = JSON.parse(pendingWrapTx);
            
            // Apply the stored transaction data
            if (txData.amount) setAmount(txData.amount);
            if (txData.isWrapping !== undefined) setIsWrapping(txData.isWrapping);
            
            // Clear the stored transaction
            window.sessionStorage.removeItem('pendingWrap');
            
            notification.info("Transaction details restored. You can now proceed with your transaction.");
          } catch (error) {
            console.error("Error parsing pending transaction:", error);
            window.sessionStorage.removeItem('pendingWrap');
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

  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0 || !contractData?.address) return;
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !userAddress) {
      notification.info("Please connect your wallet first");
      try {
        // Store pending transaction parameters
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('pendingWrap', JSON.stringify({
            amount,
            isWrapping
          }));
          console.log("Stored pending wrap transaction");
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
      
      try {
        if (isWrapping) {
          // For WETH wrapping, we use the deposit() function (0xd0e30db0)
          notification.info(`Wrapping ${amount} ${tokenSymbol} to ${wrappedSymbol}...`);
          
          const tx = await signer.sendTransaction({
            to: contractData.address as string,
            data: '0xd0e30db0', // deposit() function signature
            value: parsedAmount,
          });
          
          notification.success(`Transaction sent: ${tx.hash}`);
          console.log("Wrap transaction:", tx.hash);
        } else {
          // For WETH unwrapping, we use the withdraw(uint) function
          // Function signature: 0x2e1a7d4d
          const data = '0x2e1a7d4d' + parsedAmount.toString(16).padStart(64, '0');
          
          notification.info(`Unwrapping ${amount} ${wrappedSymbol} to ${tokenSymbol}...`);
          
          const tx = await signer.sendTransaction({
            to: contractData.address as string,
            data: data,
          });
          
          notification.success(`Transaction sent: ${tx.hash}`);
          console.log("Unwrap transaction:", tx.hash);
        }
        
        // Reset amount after transaction is sent
        setAmount('');
      } catch (txError) {
        console.error(`Failed to ${isWrapping ? 'wrap' : 'unwrap'}:`, txError);
        notification.error(`Transaction failed: ${(txError as Error).message}`);
      }
    } catch (error) {
      console.error(`${isWrapping ? 'Wrap' : 'Unwrap'} failed:`, error);
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
          Token Wrapper
        </h2>
        <p className="text-md text-gray-300 mt-2">
          Wrap and unwrap tokens for DeFi compatibility
        </p>
      </div>

      {/* Toggle Wrap/Unwrap */}
      <div className="flex justify-between mb-4">
        <button
          onClick={() => setIsWrapping(true)}
          className={`flex-1 py-2 rounded-l-lg ${
            isWrapping
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Wrap
        </button>
        <button
          onClick={() => setIsWrapping(false)}
          className={`flex-1 py-2 rounded-r-lg ${
            !isWrapping
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Unwrap
        </button>
      </div>

      {/* Input Amount */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <div className="flex justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            {isWrapping ? `Amount of ${tokenSymbol} to wrap` : `Amount of ${wrappedSymbol} to unwrap`}
          </label>
          {userAddress && (
            <button
              onClick={() => {
                const maxBalance = isWrapping ? userBalance : wrappedBalance;
                setAmount(formatEther(maxBalance));
              }}
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
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-gray-400">
            You will receive:
          </span>
          <span className="text-gray-300">
            {amount ? amount : '0'} {isWrapping ? wrappedSymbol : tokenSymbol}
          </span>
        </div>
        
        {userAddress && (
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Balance:</span>
            <span>
              {formatEther(isWrapping ? userBalance : wrappedBalance)} {isWrapping ? tokenSymbol : wrappedSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={handleWrap}
        disabled={!amount || parseFloat(amount) <= 0 || isLoading}
        className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
          ${(!amount || parseFloat(amount) <= 0 || isLoading)
            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
          } font-medium text-sm`}
      >
        <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          {isWrapping ? `Wrap ${tokenSymbol}` : `Unwrap ${wrappedSymbol}`}
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
      
      {/* Cancel transaction option during loading */}
      {isLoading && (
        <div className="mt-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
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

      {/* Information Card */}
      <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
        <h3 className="font-bold mb-2">What are wrapped tokens?</h3>
        <p className="text-sm mb-2">
          Wrapped tokens are ERC-20 representations of non-ERC-20 assets or tokens with different standards. They allow these assets to be used in DeFi protocols that require ERC-20 compatibility.
        </p>
      </div>
    </div>
  );
} 