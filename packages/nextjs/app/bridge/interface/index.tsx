"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";

export default function BridgeInterface() {
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [targetChainId, setTargetChainId] = useState<string>('1');
  const [availableChains, setAvailableChains] = useState<{id: string, name: string}[]>([
    { id: '1', name: 'Ethereum Mainnet' },
    { id: '10', name: 'Optimism' },
    { id: '42161', name: 'Arbitrum One' },
    { id: '137', name: 'Polygon' },
    { id: '11155111', name: 'Sepolia Testnet' }
  ]);
  
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
    cancelTransaction,
    isModalOpen
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

  const handleBridge = async () => {
    if (!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || !contractData?.address) return;

    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
      const parsedAmount = parseEther(amount);
      
      try {
        // For a common bridge function like `bridgeETH(address to, uint256 chainId)` 
        // Function signature: let's assume it's 0x814b5d38
        const functionSignature = '0x814b5d38';
        
        // For simplicity, we're assuming a specific bridge function 
        // Actual implementations vary widely between different bridges
        const bridgeData = functionSignature + 
          recipientAddress.substring(2).padStart(64, '0') + 
          BigInt(targetChainId).toString(16).padStart(64, '0');
        
        notification.info(`Initiating bridge of ${amount} ETH to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)} on chain ID ${targetChainId}...`);
        
        await initiateQRTransaction(
          contractData.address as Address,
          bridgeData,
          parsedAmount // Including ETH value for bridging
        );
        
        // Reset fields after transaction is initiated
        setAmount('');
        setRecipientAddress('');
      } catch (error) {
        console.error("Failed to initiate bridge transaction:", error);
        notification.error(`Failed to initiate bridge: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Bridge failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      // Only reset loading if AppKit is not executing
      if (!isExecuting) {
        setIsLoading(false);
      }
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
          disabled={!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || isLoading || isExecuting}
          className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !amount || parseFloat(amount) <= 0 || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
            Bridge Assets
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

      {/* Render QR Transaction Modal */}
      <QRTransactionModalComponent />
    </div>
  );
} 