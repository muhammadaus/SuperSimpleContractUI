"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, formatEther, parseEther, createPublicClient, http, Address } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";
import { notification } from "../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../hooks/scaffold-eth/useQRTransactionFlow";

export default function ERC20() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);

  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
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

  // Mock write operations
  const transferToken = async (params: any) => {
    console.log("Transfer params:", params);
    return "0x0";
  };
  
  const approveToken = async (params: any) => {
    console.log("Approve params:", params);
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

        // Read token name - add empty args array
        const name = await client.readContract({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'name',
          args: []
        });
        console.log("Token Name:", name);
        setTokenName(name as unknown as string);

        // Read token symbol - add empty args array
        const symbol = await client.readContract({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'symbol',
          args: []
        });
        console.log("Token Symbol:", symbol);
        setTokenSymbol(symbol as unknown as string);

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
    if (!isAddress(recipientAddress) || !amount || !contractData) return;
    
    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
      const parsedAmount = parseEther(amount);
      
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
        notification.info(`Initiating transfer of ${amount} ${tokenSymbol} to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)} on ${targetNetwork.name}...`);
        
        await initiateQRTransaction(
          contractData.address as Address,
          transferData,
          BigInt(0) // No ETH value is sent for token transfers
        );
        
        // Reset amount after transaction is initiated
        setAmount('');
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

  const handleApprove = async () => {
    if (!isAddress(spenderAddress) || !amount || !contractData) return;
    
    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
      const parsedAmount = parseEther(amount);
      
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
        notification.info(`Initiating approval of ${amount} ${tokenSymbol} for ${spenderAddress.substring(0, 6)}...${spenderAddress.substring(38)} on ${targetNetwork.name}...`);
        
        await initiateQRTransaction(
          contractData.address as Address,
          approveData,
          BigInt(0) // No ETH value is sent for token approvals
        );
        
        // Reset amount after transaction is initiated
        setAmount('');
      } catch (error) {
        console.error("Failed to initiate approve transaction:", error);
        notification.error(`Failed to initiate approval: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      // Only reset loading if AppKit is not executing
      if (!isExecuting) {
        setIsLoading(false);
      }
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
          Your Balance: <span className="font-bold">{formatEther(userBalance)} {tokenSymbol}</span>
        </p>
      </div>

      {/* Transfer Section */}
      <div className="w-full max-w-md my-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Transfer Tokens
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !amount || isLoading || isExecuting}
          className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !amount || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
            Transfer
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

      {/* Approve Section */}
      <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Approve Spender
        </h2>
        <input
          type="text"
          value={spenderAddress}
          onChange={(e) => setSpenderAddress(e.target.value)}
          placeholder="Spender address"
          className={`w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
            ${!isAddress(spenderAddress) && spenderAddress ? 'border-red-500' : 'border-gray-700'}
            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
            ${!isAddress(spenderAddress) && spenderAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleApprove}
          disabled={!isAddress(spenderAddress) || !amount || isLoading || isExecuting}
          className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative
            ${(!isAddress(spenderAddress) || !amount || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
            Approve
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
        <div className="w-full max-w-md mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="text-center mb-2">
            Transaction in progress. Please check your wallet for confirmation requests.
          </p>
          <button
            onClick={() => {
              cancelTransaction();
              setIsLoading(false);
              setAmount('');
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