"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, createPublicClient, http, Address } from 'viem';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";

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

  // Default to the first account for reading purposes
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const { targetNetwork } = useTargetNetwork();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

  // Add QR transaction flow
  const { 
    initiateQRTransaction, 
    QRTransactionModalComponent, 
    isExecuting, 
    cancelTransaction 
  } = useQRTransactionFlow({
    chainId: targetNetwork.id,
  });

  // Get user address if wallet is connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0]);
          }
        } catch (error) {
          console.error("Error checking connection:", error);
        }
      }
    };
    
    checkConnection();
  }, []);

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
          setCollectionName(name as string);
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
          setCollectionSymbol(symbol as string);
        } catch (error) {
          console.error("Error reading collection symbol:", error);
        }

        // Try to fetch tokens owned by user if address exists
        if (userAddress) {
          try {
            // Some contracts have balanceOf(address) that returns the number of tokens
            const balance = await client.readContract({
              address: contractData.address,
              abi: contractData.abi,
              functionName: 'balanceOf',
              args: [userAddress as Address],
            });
            
            console.log("Balance:", balance);
            
            // Try to find tokens owned by this user
            // This is basic and not all contracts will have a tokenOfOwnerByIndex method
            const tokens = [];
            try {
              // For enumerable collections
              for (let i = 0; i < Number(balance); i++) {
                const tokenId = await client.readContract({
                  address: contractData.address,
                  abi: contractData.abi,
                  functionName: 'tokenOfOwnerByIndex',
                  args: [userAddress as Address, BigInt(i)],
                });
                tokens.push(String(tokenId));
              }
              setUserTokens(tokens);
            } catch (error) {
              console.error("Contract might not support tokenOfOwnerByIndex:", error);
            }
          } catch (error) {
            console.error("Error reading token balance:", error);
          }
        }
      } catch (error) {
        console.error("Error reading collection info:", error);
        notification.error("Failed to load NFT collection data");
      }
    };

    readCollectionInfo();
  }, [contractData, targetNetwork, userAddress]);

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
        uri = result as string;
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
    
    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
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
        notification.info(`Initiating transfer of ${collectionSymbol} #${tokenId} to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)} on ${targetNetwork.name}...`);
        
        await initiateQRTransaction(
          contractData.address as Address,
          transferData,
          BigInt(0) // No ETH value is sent for NFT transfers
        );
        
        // Reset form fields after transaction is initiated
        setTokenId('');
        setRecipientAddress('');
      } catch (error) {
        console.error("Failed to initiate transfer transaction:", error);
        notification.error(`Failed to initiate transfer: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Transfer failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      // Only reset loading if AppKit is not executing
      if (!isExecuting) {
        setIsLoading(false);
      }
    }
  };

  // Helper function to display token image
  const getTokenImage = () => {
    if (!tokenMetadata) return null;
    
    let imageUrl = tokenMetadata.image || tokenMetadata.image_url;
    
    // Handle IPFS URLs
    if (imageUrl && imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return imageUrl;
  };

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          {collectionName} {collectionSymbol ? `(${collectionSymbol})` : ''}
        </h2>
        <p className="text-md text-gray-300 mt-2">
          {userAddress ? (
            <>
              Your NFTs: <span className="font-bold">{userTokens.length}</span>
              {userTokens.length > 0 && (
                <span className="ml-2 text-sm">
                  (IDs: {userTokens.slice(0, 5).join(', ')}{userTokens.length > 5 ? '...' : ''})
                </span>
              )}
            </>
          ) : (
            <span className="italic">Connect your wallet to view your NFTs</span>
          )}
        </p>
      </div>

      {/* Metadata Lookup Section */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Lookup NFT Metadata
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
            className={`px-4 py-2 rounded-lg shadow-md transition-all duration-200 relative
              ${(!tokenId || isFetchingMetadata)
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
              } font-medium text-sm`}
          >
            <span className={`${isFetchingMetadata ? 'opacity-0' : 'opacity-100'}`}>
              View
            </span>
            
            {isFetchingMetadata && (
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
        
        {/* Display Metadata */}
        {tokenMetadata && (
          <div className="mt-4 rounded-lg bg-gray-900/50 p-4 border border-gray-700">
            <div className="flex flex-col md:flex-row gap-4">
              {getTokenImage() && (
                <div className="md:w-1/3">
                  <img 
                    src={getTokenImage()} 
                    alt={tokenMetadata.name || `Token #${tokenId}`} 
                    className="rounded-lg w-full object-cover"
                  />
                </div>
              )}
              <div className={`${getTokenImage() ? 'md:w-2/3' : 'w-full'}`}>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {tokenMetadata.name || `Token #${tokenId}`}
                </h4>
                {tokenMetadata.description && (
                  <p className="text-sm text-gray-300 mb-3">{tokenMetadata.description}</p>
                )}
                {tokenMetadata.attributes && tokenMetadata.attributes.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-300 mb-2">Attributes:</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {tokenMetadata.attributes.map((attr: any, index: number) => (
                        <div key={index} className="text-xs bg-gray-800 p-2 rounded border border-gray-700">
                          <span className="text-gray-400">{attr.trait_type || 'Trait'}:</span>
                          <span className="ml-1 text-blue-400 font-medium">{attr.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
          disabled={!isAddress(recipientAddress) || !tokenId || isLoading || isExecuting}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !tokenId || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
            Transfer NFT
          </span>
          
          {(isLoading || isExecuting) && (
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
      
      {/* Cancel transaction option during loading/executing */}
      {(isLoading || isExecuting) && (
        <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="text-center mb-2">
            Transaction in progress. Please check your wallet for confirmation requests.
          </p>
          <button
            onClick={() => {
              cancelTransaction();
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

      {/* Render QR Transaction Modal */}
      <QRTransactionModalComponent />
    </div>
  );
} 