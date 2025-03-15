"use client";

import React, { useEffect, useState } from 'react';
import { createPublicClient, http, isAddress } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";

export default function NFT() {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [approvedAddress, setApprovedAddress] = useState('');

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

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !tokenId || !transferToken || !contractData) return;
    
    try {
      const makeTransfer = async () => {
        const result = await transferToken({
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

  const handleApprove = async () => {
    if (!isAddress(approvedAddress) || !tokenId || !approveToken || !contractData) return;
    
    try {
      const makeApprove = async () => {
        const result = await approveToken({
          address: contractData.address,
          abi: contractData.abi,
          functionName: 'approve',
          args: [approvedAddress as `0x${string}`, BigInt(tokenId)],
        });
        return result as `0x${string}`;
      };
      
      await writeTxn(makeApprove);
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  // Show loading if contract data is not available
  if (!contractData) {
    return <div className="text-center mt-10">Loading contract data...</div>;
  }

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
        <p>Your NFT Balance: {userBalance.toString()}</p>
      </div>

      {/* Transfer Section */}
      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        <h2 className="text-xl font-bold mb-4">Transfer NFT</h2>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <input
          type="number"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <button
          onClick={handleTransfer}
          disabled={!isAddress(recipientAddress) || !tokenId}
          className="btn btn-primary w-full"
        >
          Transfer NFT
        </button>
      </div>

      {/* Approve Section */}
      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        <h2 className="text-xl font-bold mb-4">Approve NFT</h2>
        <input
          type="text"
          value={approvedAddress}
          onChange={(e) => setApprovedAddress(e.target.value)}
          placeholder="Approved address"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <input
          type="number"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
          className="w-full p-3 rounded-xl mb-3 bg-base-100"
        />
        <button
          onClick={handleApprove}
          disabled={!isAddress(approvedAddress) || !tokenId}
          className="btn btn-primary w-full"
        >
          Approve NFT
        </button>
      </div>
    </div>
  );
} 