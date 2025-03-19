"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, formatEther, parseEther, createPublicClient, http, Address } from 'viem';
import { useTransactor } from '../../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";

export default function ERC20Interface() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);

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
        setTokenName(name as unknown as string);

        // Read token symbol
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
            args: [userAddress as Address],
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
          disabled={!isAddress(recipientAddress) || !amount || isLoading || isExecuting}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(recipientAddress) || !amount || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
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
          disabled={!isAddress(spenderAddress) || !amount || isLoading || isExecuting}
          className={`w-full py-2 px-4 mt-2 rounded-lg shadow-md transition-all duration-200 relative
            ${(!isAddress(spenderAddress) || !amount || isLoading || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
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
        <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
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