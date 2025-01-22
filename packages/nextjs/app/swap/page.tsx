"use client";

import React, { useEffect, useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits, isAddress, Address, createWalletClient, custom, encodeFunctionData } from 'viem';
import { useAccount, useWriteContract, useContractRead } from 'wagmi';
import { useTransactor } from '~~/hooks/scaffold-eth';
import { useTargetNetwork } from '~~/hooks/scaffold-eth';
import { useContractStore } from "~~/utils/scaffold-eth/contract";
import { TOKEN_LIST } from "~~/utils/scaffold-eth/tokens";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

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
  const { address: userAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  const { data: deployedContractData } = useDeployedContractInfo("YourContract");
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [customFromAddress, setCustomFromAddress] = useState('');
  const [customToAddress, setCustomToAddress] = useState('');
  const [isLoadingFromToken, setIsLoadingFromToken] = useState(false);
  const [isLoadingToToken, setIsLoadingToToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const routerContract = contracts?.[targetNetwork.id]?.YourContract;

  // Write operation
  const { writeContractAsync: executeSwap } = useWriteContract();

  // Get token list for current network
  const tokens = TOKEN_LIST[targetNetwork.id as keyof typeof TOKEN_LIST] || [];

  const checkAndApproveToken = async (tokenAddress: Address, amount: bigint) => {
    if (!window.ethereum || !userAddress || !deployedContractData?.address) {
      notification.error("Please connect your wallet");
      return;
    }

    // Skip approval for native token
    if (tokenAddress.toLowerCase() === "0x0000000000000000000000000000000000001010".toLowerCase()) {
      return;
    }

    try {
      // Create public client for reading with chain
      const publicClient = createPublicClient({
        chain: targetNetwork,
        transport: custom(window.ethereum),
      });

      // Create wallet client for writing with account and chain
      const walletClient = createWalletClient({
        account: userAddress as Address,
        chain: targetNetwork,
        transport: custom(window.ethereum)
      });

      // Check allowance using public client
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress, deployedContractData.address]
      });

      if (allowance < amount) {
        notification.info("Approving token...");
        
        // Need to approve using wallet client
        const approveTx = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [deployedContractData.address, amount]
        });

        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        notification.success("Token approved successfully!");
      }
    } catch (error) {
      console.error('Approval error:', error);
      notification.error("Failed to approve token: " + (error as Error).message);
      throw error; // Re-throw to handle in the swap function
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !deployedContractData?.address || !userAddress) {
      notification.error("Please fill in all fields");
      return;
    }

    if (!window.ethereum) {
      notification.error("Please install MetaMask");
      return;
    }

    try {
      setIsLoading(true);

      // Create wallet client with account and chain
      const client = createWalletClient({
        account: userAddress as Address,
        chain: targetNetwork,
        transport: custom(window.ethereum)
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      const slippagePercent = parseFloat(slippage) / 100;
      const parsedAmount = parseUnits(fromAmount, fromToken.decimals);
      const minOutputAmount = parsedAmount * BigInt(Math.floor((1 - slippagePercent) * 1000)) / 1000n;

      // Check if dealing with native token (ETH/MATIC)
      const nativeToken = "0x0000000000000000000000000000000000001010";
      const isFromNative = fromToken.address.toLowerCase() === nativeToken.toLowerCase();
      const isToNative = toToken.address.toLowerCase() === nativeToken.toLowerCase();

      let txHash;

      if (isFromNative) {
        // Native -> Token
        txHash = await client.writeContract({
          account: userAddress as Address,
          address: deployedContractData.address as Address,
          abi: deployedContractData.abi,
          functionName: 'swapExactETHForTokens',
          args: [
            minOutputAmount,
            [deployedContractData.WETH || nativeToken, toToken.address],
            userAddress,
            deadline
          ],
          value: parsedAmount
        });
      } else if (isToNative) {
        // Token -> Native
        if (!isFromNative) {
          await checkAndApproveToken(fromToken.address as Address, parsedAmount);
        }
        txHash = await client.writeContract({
          account: userAddress as Address,
          address: deployedContractData.address as Address,
          abi: deployedContractData.abi,
          functionName: 'swapExactTokensForETH',
          args: [
            parsedAmount,
            minOutputAmount,
            [fromToken.address, deployedContractData.WETH || nativeToken],
            userAddress,
            deadline
          ]
        });
      } else {
        // Token -> Token
        await checkAndApproveToken(fromToken.address as Address, parsedAmount);
        txHash = await client.writeContract({
          account: userAddress as Address,
          address: deployedContractData.address as Address,
          abi: deployedContractData.abi,
          functionName: 'swapExactTokensForTokens',
          args: [
            parsedAmount,
            minOutputAmount,
            [fromToken.address, toToken.address],
            userAddress,
            deadline
          ]
        });
      }

      console.log('Swap transaction submitted:', txHash);
      notification.success("Swap transaction submitted!");

    } catch (err) {
      console.error('Swap failed:', err);
      notification.error("Swap failed: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to validate and get token name
  const handleGetTokenName = async (address: string, isFromToken: boolean) => {
    if (!isAddress(address)) {
      notification.error("Invalid address format");
      return;
    }

    try {
      isFromToken ? setIsLoadingFromToken(true) : setIsLoadingToToken(true);
      
      const client = createPublicClient({
        chain: targetNetwork,
        transport: custom(window.ethereum),
      });

      // Try to read token info
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        client.readContract({
          address: address as Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
        })
      ]);

      // Add token to the list if it's not already there
      const newToken = {
        address: address as Address,
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
      };

      // Update token lists
      if (isFromToken) {
        setFromToken(newToken);
        setCustomFromAddress('');
        notification.success(`Token loaded: ${newToken.name} (${newToken.symbol})`);
      } else {
        setToToken(newToken);
        setCustomToAddress('');
        notification.success(`Token loaded: ${newToken.name} (${newToken.symbol})`);
      }

    } catch (error) {
      console.error('Error loading token:', error);
      notification.error("Failed to load token. Make sure this is a valid ERC20 token address.");
    } finally {
      isFromToken ? setIsLoadingFromToken(false) : setIsLoadingToToken(false);
    }
  };

  // Add this effect to update token info when tokens are selected from the list
  useEffect(() => {
    if (fromToken) {
      const token = tokens.find(t => t.address.toLowerCase() === fromToken.address.toLowerCase());
      if (token) {
        setCustomFromAddress('');
      }
    }
  }, [fromToken, tokens]);

  useEffect(() => {
    if (toToken) {
      const token = tokens.find(t => t.address.toLowerCase() === toToken.address.toLowerCase());
      if (token) {
        setCustomToAddress('');
      }
    }
  }, [toToken, tokens]);

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
          <div className="text-sm">Make sure to approve ERC20 tokens before swapping. You can do this through the token's contract on Etherscan. This will not be required after the next Ethereum protocol upgrade in 2025.</div>
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
          disabled={isLoading || !fromToken || !toToken || !fromAmount}
          className="btn btn-primary w-full"
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "Swap Tokens"
          )}
        </button>
      </div>
    </div>
  );
} 