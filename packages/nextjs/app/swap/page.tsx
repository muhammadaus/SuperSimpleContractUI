"use client";

import React, { useEffect, useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits, isAddress } from 'viem';
import { useAccount, useWriteContract, useContractRead } from 'wagmi';
import { useTransactor } from '~~/hooks/scaffold-eth';
import { useTargetNetwork } from '~~/hooks/scaffold-eth';
import { useContractStore } from "~~/utils/scaffold-eth/contract";
import { TOKEN_LIST } from "~~/utils/scaffold-eth/tokens";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
] as const;

interface TokenOption {
  value: string;
  label: string;
  isCustom?: boolean;
}

export default function Swap() {
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [customFromAddress, setCustomFromAddress] = useState('');
  const [customToAddress, setCustomToAddress] = useState('');
  const [isLoadingFromToken, setIsLoadingFromToken] = useState(false);
  const [isLoadingToToken, setIsLoadingToToken] = useState(false);

  const { address: userAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const routerContract = contracts?.[targetNetwork.id]?.YourContract;

  // Write operation
  const { writeContractAsync: executeSwap } = useWriteContract();

  // Get token list for current network
  const tokens = TOKEN_LIST[targetNetwork.id as keyof typeof TOKEN_LIST] || [];

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !routerContract) return;

    try {
      // Here you would:
      // 1. Get quote from API or quoter contract
      // 2. Encode the swap commands
      // 3. Execute the swap
      console.log("Swap not implemented yet");
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  // Function to validate and get token name
  const handleGetTokenName = async (address: string, isFromToken: boolean) => {
    if (!isAddress(address)) return;

    try {
      isFromToken ? setIsLoadingFromToken(true) : setIsLoadingToToken(true);
      
      const client = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });

      // Try to read token info
      const name = await client.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      });

      const symbol = await client.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      });

      const decimals = await client.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

      const token = {
        address,
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
      };

      if (isFromToken) {
        setFromToken(token);
      } else {
        setToToken(token);
      }
    } catch (error) {
      console.error('Error loading token name:', error);
    } finally {
      isFromToken ? setIsLoadingFromToken(false) : setIsLoadingToToken(false);
    }
  };

  return (
    <div className="flex flex-col items-center flex-grow pt-10 px-4 w-full max-w-[600px] mx-auto">
      <h1 className="text-center mb-8">
        <span className="block text-4xl font-bold">Swap</span>
      </h1>

      {/* Notice about ERC20 approval */}
      <div className="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 className="font-bold">Important!</h3>
          <div className="text-sm">Make sure to approve ERC20 tokens before swapping. You can do this through the token's contract on Etherscan.</div>
        </div>
      </div>

      <div className="w-full mb-8 p-4 rounded-xl bg-base-200">
        {/* From Token */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">From</h2>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl mb-2 bg-base-100"
          />
          <div className="flex flex-col gap-2">
            {/* Token Input Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customFromAddress}
                onChange={(e) => setCustomFromAddress(e.target.value)}
                placeholder="Token Address (0x...)"
                className="flex-1 p-3 rounded-xl bg-base-100"
              />
              <button
                onClick={() => isAddress(customFromAddress) && handleGetTokenName(customFromAddress, true)}
                disabled={!isAddress(customFromAddress) || isLoadingFromToken}
                className="btn btn-primary min-w-[120px]"
              >
                {isLoadingFromToken ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  "Get Token Name"
                )}
              </button>
            </div>

            {/* Common Tokens */}
            <div className="flex gap-2 flex-wrap">
              {tokens.map(token => (
                <button
                  key={token.address}
                  onClick={() => setFromToken(token)}
                  className={`btn btn-sm ${fromToken?.address === token.address ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
          {fromToken && (
            <div className="mt-2 text-sm">
              Selected: {fromToken.name} ({fromToken.symbol})
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <button 
          className="btn btn-circle btn-ghost my-2"
          onClick={() => {
            const temp = fromToken;
            setFromToken(toToken);
            setToToken(temp);
            const tempAddress = customFromAddress;
            setCustomFromAddress(customToAddress);
            setCustomToAddress(tempAddress);
          }}
        >
          ↓
        </button>

        {/* To Token */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">To</h2>
          <input
            type="number"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl mb-2 bg-base-100"
            disabled
          />
          <div className="flex flex-col gap-2">
            {/* Token Input Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customToAddress}
                onChange={(e) => setCustomToAddress(e.target.value)}
                placeholder="Token Address (0x...)"
                className="flex-1 p-3 rounded-xl bg-base-100"
              />
              <button
                onClick={() => isAddress(customToAddress) && handleGetTokenName(customToAddress, false)}
                disabled={!isAddress(customToAddress) || isLoadingToToken}
                className="btn btn-primary min-w-[120px]"
              >
                {isLoadingToToken ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  "Get Token Name"
                )}
              </button>
            </div>

            {/* Common Tokens */}
            <div className="flex gap-2 flex-wrap">
              {tokens.map(token => (
                <button
                  key={token.address}
                  onClick={() => setToToken(token)}
                  className={`btn btn-sm ${toToken?.address === token.address ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
          {toToken && (
            <div className="mt-2 text-sm">
              Selected: {toToken.name} ({toToken.symbol})
            </div>
          )}
        </div>

        {/* Slippage Setting */}
        <div className="mb-4">
          <label className="text-sm">Slippage Tolerance (%)</label>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="w-full p-2 rounded-xl bg-base-100"
            step="0.1"
            min="0.1"
            max="5"
          />
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!fromToken || !toToken || !fromAmount}
          className="btn btn-primary w-full"
        >
          Swap
        </button>
      </div>
    </div>
  );
} 