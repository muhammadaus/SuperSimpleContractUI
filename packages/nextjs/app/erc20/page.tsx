"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useTransactor } from '~~/hooks/scaffold-eth';
import { useTargetNetwork } from '~~/hooks/scaffold-eth/useTargetNetwork';

// Standard ERC20 ABI for common functions
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
] as const;

const Erc20Page = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));

  const { address: userAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();

  // Read token info
  const { data: nameData } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'name',
    enabled: isAddress(tokenAddress),
  });

  const { data: symbolData } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
    enabled: isAddress(tokenAddress),
  });

  const { data: balanceData } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    enabled: isAddress(tokenAddress) && !!userAddress,
  });

  // Write operations
  const { writeContractAsync: transferToken } = useWriteContract();
  const { writeContractAsync: approveToken } = useWriteContract();

  useEffect(() => {
    if (nameData) setTokenName(nameData);
    if (symbolData) setTokenSymbol(symbolData);
    if (balanceData) setUserBalance(balanceData);
  }, [nameData, symbolData, balanceData]);

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !amount || !transferToken) return;
    
    try {
      const makeTransfer = () =>
        transferToken({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, parseEther(amount)],
        });
      
      await writeTxn(makeTransfer);
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const handleApprove = async () => {
    if (!isAddress(spenderAddress) || !amount || !approveToken) return;
    
    try {
      const makeApprove = () =>
        approveToken({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spenderAddress as `0x${string}`, parseEther(amount)],
        });
      
      await writeTxn(makeApprove);
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  return (
    <div className="flex flex-col items-center flex-grow pt-10 px-4 w-full max-w-[600px] mx-auto">
      <h1 className="text-4xl font-bold mb-8">ERC20 Token Interface</h1>

      {/* Token Address Input */}
      <div className="w-full mb-8">
        <label className="block text-sm font-medium mb-2">Token Address</label>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Enter ERC20 token address"
          className="w-full p-3 rounded-xl bg-base-200"
        />
      </div>

      {/* Token Info */}
      {tokenName && tokenSymbol && (
        <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
          <h2 className="text-xl font-bold mb-2">{tokenName} ({tokenSymbol})</h2>
          <p>Your Balance: {formatEther(userBalance)} {tokenSymbol}</p>
        </div>
      )}

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
};

export default Erc20Page; 