"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, createPublicClient, http } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";

export default function NFT() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [tokenId, setTokenId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenURI, setTokenURI] = useState('');
  const [tokenMetadata, setTokenMetadata] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));

  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

  // Mock write operations
  const transferNFT = async (params: any) => {
    console.log("Transfer params:", params);
    return "0x0";
  };
  
  const mintNFT = async (params: any) => {
    console.log("Mint params:", params);
    return "0x0";
  };

  useEffect(() => {
    const readTokenInfo = async () => {
      if (!contractData?.address || !contractData?.abi) return;

      try {
        const client = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Read token name
        const name = await client.readContract({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'name',
          args: []
        });
        console.log("Token Name:", name);
        setTokenName(typeof name === 'string' ? name : String(name));

        // Read token symbol
        const symbol = await client.readContract({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'symbol',
          args: []
        });
        console.log("Token Symbol:", symbol);
        setTokenSymbol(typeof symbol === 'string' ? symbol : String(symbol));

        // Read balance if user address exists
        if (userAddress) {
          const balance = await client.readContract({
            address: contractData.address,
            abi: contractData.abi,
            functionName: 'balanceOf',
            args: [userAddress],
          });
          console.log("Balance:", balance);
          setUserBalance(balance as unknown as bigint);
        }
      } catch (error) {
        console.error("Error reading token info:", error);
      }
    };

    readTokenInfo();
  }, [contractData, targetNetwork, userAddress]);

  const fetchTokenMetadata = async () => {
    if (!tokenId || !contractData?.address || !contractData?.abi) return;

    try {
      const client = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });

      // Read token URI
      const uri = await client.readContract({
        address: contractData.address,
        abi: contractData.abi,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
      
      // Convert uri to string safely
      const uriString = typeof uri === 'string' ? uri : String(uri);
      setTokenURI(uriString);
      
      // Fetch metadata if URI is available
      if (uri) {
        try {
          // For IPFS URIs, you would need to handle them differently
          // This is a simplified example for HTTP URIs
          const response = await fetch(uriString);
          const metadata = await response.json();
          setTokenMetadata(metadata);
        } catch (error) {
          console.error("Error fetching metadata:", error);
          setTokenMetadata(null);
        }
      }
    } catch (error) {
      console.error("Error fetching token URI:", error);
      setTokenURI('');
      setTokenMetadata(null);
    }
  };

  // Show loading if contract data is not available
  if (!contractData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
        <div className="bg-gray-900 p-6 rounded-xl shadow-xl border border-gray-800">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-white">Loading contract data...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !tokenId || !transferNFT || !contractData) return;
    
    try {
      const makeTransfer = async () => {
        const result = await transferNFT({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'transferFrom',
          args: [userAddress, recipientAddress as `0x${string}`, BigInt(tokenId)],
        });
        return result as `0x${string}`;
      };
      
      await writeTxn(makeTransfer);
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const handleMint = async () => {
    if (!isAddress(recipientAddress) || !mintNFT || !contractData) return;
    
    try {
      const makeMint = async () => {
        const result = await mintNFT({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'mint',
          args: [recipientAddress as `0x${string}`, tokenURI],
        });
        return result as `0x${string}`;
      };
      
      await writeTxn(makeMint);
    } catch (error) {
      console.error('Minting failed:', error);
    }
  };

  return (
    <div className="flex flex-col items-center flex-grow pt-10 w-full px-4 min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">You are now interacting with</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            {tokenName} {tokenSymbol ? `(${tokenSymbol})` : ''}
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Your NFT Balance: <span className="font-bold">{userBalance.toString()}</span>
        </p>
      </div>

      {/* Token Info Section */}
      <div className="w-full max-w-md my-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          View Token Info
        </h2>
        <input
          type="number"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
          className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={fetchTokenMetadata}
          disabled={!tokenId}
          className={`w-full mt-4 px-6 py-3 rounded-xl shadow-lg transition-all duration-200
            ${!tokenId
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          Fetch Token Info
        </button>

        {tokenURI && (
          <div className="mt-4 p-4 rounded-lg bg-gray-900/50 border border-gray-700">
            <h3 className="font-semibold text-blue-400">Token URI:</h3>
            <p className="text-sm break-all text-gray-300">{tokenURI}</p>
            
            {tokenMetadata && (
              <div className="mt-3">
                <h3 className="font-semibold text-blue-400">Metadata:</h3>
                <pre className="text-xs mt-2 p-2 bg-gray-900 rounded overflow-x-auto text-gray-300">
                  {JSON.stringify(tokenMetadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transfer Section */}
      <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Transfer NFT
        </h2>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address"
          className={`w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
            ${!isAddress(recipientAddress) && recipientAddress ? 'border-red-500' : 'border-gray-700'}
            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
            ${!isAddress(recipientAddress) && recipientAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
        <input
          type="number"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
          className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !tokenId}
          className={`w-full mt-4 px-6 py-3 rounded-xl shadow-lg transition-all duration-200
            ${(!isAddress(recipientAddress) || !tokenId)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          Transfer
        </button>
      </div>

      {/* Mint Section */}
      <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Mint New NFT
        </h2>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address"
          className={`w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
            ${!isAddress(recipientAddress) && recipientAddress ? 'border-red-500' : 'border-gray-700'}
            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
            ${!isAddress(recipientAddress) && recipientAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
        <input
          type="text"
          value={tokenURI}
          onChange={(e) => setTokenURI(e.target.value)}
          placeholder="Token URI (metadata URL)"
          className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleMint}
          disabled={!isAddress(recipientAddress) || !tokenURI}
          className={`w-full mt-4 px-6 py-3 rounded-xl shadow-lg transition-all duration-200
            ${(!isAddress(recipientAddress) || !tokenURI)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          Mint NFT
        </button>
      </div>
    </div>
  );
} 