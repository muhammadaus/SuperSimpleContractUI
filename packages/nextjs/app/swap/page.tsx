"use client";

import React, { useEffect, useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits, isAddress, Address, createWalletClient, custom, encodeFunctionData } from 'viem';
// Remove wagmi imports
// import { useAccount, useWriteContract, useContractRead } from 'wagmi';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";
import { TOKEN_LIST } from "../../utils/scaffold-eth/tokens";
import { useDeployedContractInfo } from "../../hooks/scaffold-eth/useDeployedContractInfo";
import { notification } from "../../utils/scaffold-eth/notification";

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

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
  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
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
  const [swapQuote, setSwapQuote] = useState<any>(null);

  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const routerContract = contracts?.[targetNetwork.id]?.YourContract;

  // Mock write operation
  const executeSwap = async (params: any) => {
    console.log("Swap params:", params);
    return "0x0";
  };

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

      if ((allowance as bigint) < amount) {
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
      const minOutputAmount = parsedAmount * BigInt(Math.floor((1 - slippagePercent) * 1000)) / BigInt(1000);

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

  const getSwapQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) return;
    
    setIsLoading(true);
    
    try {
      // Mock API call to get swap quote
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock response
      const mockQuote = {
        fromToken: fromToken,
        toToken: toToken,
        fromAmount: fromAmount,
        toAmount: (parseFloat(fromAmount) * 1.5).toString(),
        exchangeRate: 1.5,
        estimatedGas: "100000",
        validFor: "30 seconds",
      };
      
      setSwapQuote(mockQuote);
    } catch (error) {
      console.error("Error getting swap quote:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading if contract data is not available
  if (!routerContract) {
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

  return (
    <div className="flex flex-col items-center flex-grow pt-10 w-full px-4 min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Decentralized</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Token Swap
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Swap tokens directly from your wallet
        </p>
      </div>

      {/* Notice about ERC20 approval */}
      <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
        <p>Note: Swapping ERC20 tokens requires approval first. This will be handled automatically during the swap process.</p>
      </div>

      {/* Swap Form */}
      <div className="w-full max-w-md my-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        {/* From Token */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2 text-gray-300">From</h2>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl mb-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-col gap-2">
            {/* Token Input Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customFromAddress}
                onChange={(e) => setCustomFromAddress(e.target.value)}
                placeholder="Token Address (0x...)"
                className={`flex-1 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
                  ${!isAddress(customFromAddress) && customFromAddress ? 'border-red-500' : 'border-gray-700'}
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                  ${!isAddress(customFromAddress) && customFromAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
              />
              <button
                onClick={() => isAddress(customFromAddress) && handleGetTokenName(customFromAddress, true)}
                disabled={!isAddress(customFromAddress) || isLoadingFromToken}
                className={`px-4 py-2 rounded-xl shadow-lg transition-all duration-200 
                  ${(!isAddress(customFromAddress) || isLoadingFromToken)
                    ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                  } font-medium min-w-[120px]`}
              >
                {isLoadingFromToken ? (
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  "Get Token"
                )}
              </button>
            </div>

            {/* Common Tokens */}
            <div className="flex gap-2 flex-wrap">
              {tokens.map(token => (
                <button
                  key={token.address}
                  onClick={() => setFromToken(token)}
                  className={`px-3 py-1 rounded-lg text-sm ${fromToken?.address === token.address 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
          {fromToken && (
            <div className="mt-2 text-sm text-blue-400">
              Selected: {fromToken.name} ({fromToken.symbol})
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center my-4">
          <button 
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
              const tempAddress = customFromAddress;
              setCustomFromAddress(customToAddress);
              setCustomToAddress(tempAddress);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2 text-gray-300">To</h2>
          <input
            type="number"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl mb-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className={`flex-1 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
                  ${!isAddress(customToAddress) && customToAddress ? 'border-red-500' : 'border-gray-700'}
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
                  ${!isAddress(customToAddress) && customToAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
              />
              <button
                onClick={() => isAddress(customToAddress) && handleGetTokenName(customToAddress, false)}
                disabled={!isAddress(customToAddress) || isLoadingToToken}
                className={`px-4 py-2 rounded-xl shadow-lg transition-all duration-200 
                  ${(!isAddress(customToAddress) || isLoadingToToken)
                    ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                  } font-medium min-w-[120px]`}
              >
                {isLoadingToToken ? (
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  "Get Token"
                )}
              </button>
            </div>

            {/* Common Tokens */}
            <div className="flex gap-2 flex-wrap">
              {tokens.map(token => (
                <button
                  key={token.address}
                  onClick={() => setToToken(token)}
                  className={`px-3 py-1 rounded-lg text-sm ${toToken?.address === token.address 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
          {toToken && (
            <div className="mt-2 text-sm text-blue-400">
              Selected: {toToken.name} ({toToken.symbol})
            </div>
          )}
        </div>

        {/* Slippage Setting */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Slippage Tolerance (%)</label>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            step="0.1"
            min="0.1"
            max="5"
          />
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={isLoading || !fromToken || !toToken || !fromAmount}
          className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative
            ${(isLoading || !fromToken || !toToken || !fromAmount)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            Swap Tokens
          </span>
          
          {isLoading && (
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
    </div>
  );
} 