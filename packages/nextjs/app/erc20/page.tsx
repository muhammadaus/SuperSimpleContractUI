"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, formatEther, parseEther, createPublicClient, http } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";

export default function ERC20() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));

  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

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
    if (!isAddress(recipientAddress) || !amount || !transferToken || !contractData) return;
    
    try {
      const makeTransfer = async () => {
        const result = await transferToken({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, parseEther(amount)],
        });
        return result as `0x${string}`;
      };
      
      await writeTxn(makeTransfer);
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const handleApprove = async () => {
    if (!isAddress(spenderAddress) || !amount || !approveToken || !contractData) return;
    
    try {
      const makeApprove = async () => {
        const result = await approveToken({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'approve',
          args: [spenderAddress as `0x${string}`, parseEther(amount)],
        });
        return result as `0x${string}`;
      };
      
      await writeTxn(makeApprove);
    } catch (error) {
      console.error('Approval failed:', error);
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
          disabled={!isAddress(recipientAddress) || !amount}
          className={`w-full mt-4 px-6 py-3 rounded-xl shadow-lg transition-all duration-200
            ${(!isAddress(recipientAddress) || !amount)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          Transfer
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
          disabled={!isAddress(spenderAddress) || !amount}
          className={`w-full mt-4 px-6 py-3 rounded-xl shadow-lg transition-all duration-200
            ${(!isAddress(spenderAddress) || !amount)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          Approve
        </button>
      </div>
    </div>
  );
} 