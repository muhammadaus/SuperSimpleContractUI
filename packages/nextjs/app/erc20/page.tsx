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
    return <div className="text-center mt-10">Loading contract data...</div>;
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
    <div className="flex flex-col items-center flex-grow pt-10 px-4 w-full max-w-[600px] mx-auto">
      <h1 className="text-center mb-8">
        <span className="block text-2xl mb-2">You are now interacting with</span>
        <span className="block text-4xl font-bold">
          {tokenName} {tokenSymbol ? `(${tokenSymbol})` : ''}
        </span>
      </h1>

      {/* Token Info */}
      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        <p>Your Balance: {formatEther(userBalance)} {tokenSymbol}</p>
      </div>

      {/* Transfer Section */}
      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        <h2 className="text-xl font-bold mb-4">Transfer Tokens</h2>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !amount}
          className="btn btn-primary w-full"
        >
          Transfer
        </button>
      </div>

      {/* Approve Section */}
      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        <h2 className="text-xl font-bold mb-4">Approve Spender</h2>
        <input
          type="text"
          value={spenderAddress}
          onChange={(e) => setSpenderAddress(e.target.value)}
          placeholder="Spender address"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <button
          onClick={handleApprove}
          disabled={!isAddress(spenderAddress) || !amount}
          className="btn btn-primary w-full"
        >
          Approve
        </button>
      </div>
    </div>
  );
} 