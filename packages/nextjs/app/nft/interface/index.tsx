"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, createPublicClient, http, Address } from 'viem';
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
    console.log('Initializing AppKit in NFT interface...');
    // Project metadata
    const metadata = {
      name: 'PureContracts NFT',
      description: 'Interact with NFT tokens',
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
    console.log('AppKit initialized in NFT interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

export default function NFTInterface() {
  const [collectionName, setCollectionName] = useState<string>("");
  const [collectionSymbol, setCollectionSymbol] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [userTokens, setUserTokens] = useState<string[]>([]);
  const [tokenURI, setTokenURI] = useState<string>("");
  const [tokenMetadata, setTokenMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

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
    const readCollectionInfo = async () => {
      if (!contractData?.address || !contractData?.abi) return;

      try {
        const client = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Read collection name
        try {
          const name = await client.readContract({
            address: contractData.address,
            abi: contractData.abi,
            functionName: 'name',
            args: []
          });
          console.log("Collection Name:", name);
          setCollectionName(typeof name === 'string' ? name : String(name));
        } catch (error) {
          console.error("Error reading collection name:", error);
        }

        // Read collection symbol
        try {
          const symbol = await client.readContract({
            address: contractData.address,
            abi: contractData.abi,
            functionName: 'symbol',
            args: []
          });
          console.log("Collection Symbol:", symbol);
          setCollectionSymbol(typeof symbol === 'string' ? symbol : String(symbol));
        } catch (error) {
          console.error("Error reading collection symbol:", error);
        }

        // Fetch user's tokens if address is available
        if (userAddress) {
          try {
            // This will be different based on contract implementation
            // This assumes the contract has a function to get token IDs by owner
            // Replace with appropriate method for the specific NFT contract
            try {
              const balance = await client.readContract({
                address: contractData.address,
                abi: contractData.abi,
                functionName: 'balanceOf',
                args: [userAddress as Address]
              });
              
              console.log("User NFT balance:", balance);
              
              // For contracts that have a tokensOfOwner function
              try {
                const tokens = await client.readContract({
                  address: contractData.address,
                  abi: contractData.abi,
                  functionName: 'tokensOfOwner', 
                  args: [userAddress as Address]
                });
                
                setUserTokens(Array.isArray(tokens) ? 
                  tokens.map(t => (typeof t === 'bigint' ? t.toString() : String(t))) : 
                  []);
                  
                console.log("User tokens:", tokens);
              } catch (tokenError) {
                console.info("Contract doesn't have tokensOfOwner function:", tokenError);
              }
            } catch (error) {
              console.error("Error getting user token balance:", error);
            }
          } catch (error) {
            console.error("Error getting user tokens:", error);
          }
        }
      } catch (error) {
        console.error("Error reading collection info:", error);
      }
    };

    readCollectionInfo();
  }, [contractData, userAddress, targetNetwork]);

  // Check for pending transactions when wallet connects
  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (isConnected && userAddress && typeof window !== 'undefined') {
        const pendingTransfer = window.sessionStorage.getItem('pendingNFTTransfer');
        
        if (pendingTransfer) {
          try {
            const txData = JSON.parse(pendingTransfer);
            
            // Apply the stored transaction data
            if (txData.recipientAddress) setRecipientAddress(txData.recipientAddress);
            if (txData.tokenId) setTokenId(txData.tokenId);
            
            // Clear the stored transaction
            window.sessionStorage.removeItem('pendingNFTTransfer');
            
            notification.info("Transfer details restored. You can now proceed with your transaction.");
          } catch (error) {
            console.error("Error parsing pending transfer:", error);
            window.sessionStorage.removeItem('pendingNFTTransfer');
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

  const fetchTokenMetadata = async () => {
    if (!tokenId || !contractData?.address) return;
    
    setIsFetchingMetadata(true);
    
    try {
      const client = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });
      
      // Get token URI
      let uri: string;
      try {
        const result = await client.readContract({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)]
        });
        uri = typeof result === 'string' ? result : String(result);
        setTokenURI(uri);
        
        // Fetch metadata if URI is available
        if (uri) {
          // Handle IPFS URIs
          if (uri.startsWith('ipfs://')) {
            uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }
          
          try {
            const response = await fetch(uri);
            const metadata = await response.json();
            setTokenMetadata(metadata);
            console.log("Token metadata:", metadata);
            
            notification.success("Metadata loaded successfully");
          } catch (error) {
            console.error("Error fetching metadata:", error);
            notification.error("Failed to fetch metadata from URI");
          }
        }
      } catch (error) {
        console.error("Error getting token URI:", error);
        notification.error("Failed to get token URI");
      }
    } catch (error) {
      console.error("Error in fetchTokenMetadata:", error);
      notification.error("Failed to fetch token metadata");
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !tokenId || !contractData) return;
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !userAddress) {
      notification.info("Please connect your wallet first");
      try {
        // Store pending transaction parameters
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('pendingNFTTransfer', JSON.stringify({
            recipientAddress,
            tokenId
          }));
          console.log("Stored pending NFT transfer transaction");
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
      
      // For ERC721 safeTransferFrom: function safeTransferFrom(address from, address to, uint256 tokenId)
      // Function signature: 0x42842e0e
      const transferData = '0x42842e0e' + 
        (userAddress || '').substring(2).padStart(64, '0') +
        recipientAddress.substring(2).padStart(64, '0') + 
        BigInt(tokenId).toString(16).padStart(64, '0');
      
      console.log("Initiating NFT transfer transaction");
      console.log("Token ID:", tokenId);
      console.log("Recipient:", recipientAddress);
      
      try {
        notification.info(`Transferring ${collectionSymbol} #${tokenId} to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)}...`);
        
        const tx = await signer.sendTransaction({
          to: contractData.address as string,
          data: transferData,
        });
        
        notification.success(`Transaction sent: ${tx.hash}`);
        console.log("Transfer transaction:", tx.hash);
        
        // Reset form fields after transaction is sent
        setTokenId('');
        setRecipientAddress('');
      } catch (txError) {
        console.error("Failed to transfer NFT:", txError);
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

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          {collectionName} {collectionSymbol ? `(${collectionSymbol})` : ''}
        </h2>
        <p className="text-md text-gray-300 mt-2">
          {userAddress ? (
            <>Your NFTs: <span className="font-bold">{userTokens.length > 0 ? userTokens.join(', ') : 'None'}</span></>
          ) : (
            <span className="italic">Connect your wallet to view your NFTs</span>
          )}
        </p>
      </div>

      {/* Token Lookup */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          NFT Lookup
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Token ID"
            className="flex-1 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={fetchTokenMetadata}
            disabled={!tokenId || isFetchingMetadata}
            className={`px-4 py-2 rounded-lg transition-colors
              ${!tokenId || isFetchingMetadata
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
          >
            {isFetchingMetadata ? 'Loading...' : 'Lookup'}
          </button>
        </div>
        
        {/* Token Metadata Display */}
        {tokenMetadata && (
          <div className="mt-4 p-3 rounded-lg bg-gray-700/50 border border-gray-600">
            <h4 className="font-medium text-blue-300 mb-2">
              {tokenMetadata.name || `Token #${tokenId}`}
            </h4>
            
            {tokenMetadata.image && (
              <div className="mb-3 overflow-hidden rounded-lg">
                <img 
                  src={tokenMetadata.image.startsWith('ipfs://') 
                    ? tokenMetadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/') 
                    : tokenMetadata.image}
                  alt={tokenMetadata.name || `Token #${tokenId}`}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            
            {tokenMetadata.description && (
              <p className="text-sm text-gray-300 mb-2">{tokenMetadata.description}</p>
            )}
            
            {tokenMetadata.attributes && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">Attributes:</p>
                <div className="grid grid-cols-2 gap-1">
                  {tokenMetadata.attributes.map((attr: any, index: number) => (
                    <div key={index} className="text-xs bg-gray-800/70 rounded p-1">
                      <span className="text-gray-400">{attr.trait_type}: </span>
                      <span className="text-blue-300">{attr.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-3 pt-2 border-t border-gray-600">
              <p className="text-xs text-gray-400">
                Token URI: <a href={tokenURI} target="_blank" rel="noopener noreferrer" className="text-blue-400 break-all">{tokenURI}</a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Section */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Transfer NFT
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
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
          className="w-full my-2 p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !tokenId || isLoading}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !tokenId || isLoading)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            Transfer NFT
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
              setTokenId('');
              setRecipientAddress('');
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