"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, createWalletClient, custom, Address } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";
import { notification } from "../../utils/scaffold-eth/notification";
import { useRouter } from 'next/navigation';

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Define token types
type TokenType = 'ETH_WETH' | 'STETH_WSTETH';

// Define token info
interface TokenInfo {
  name: string;
  symbol: string;
  wrappedName: string;
  wrappedSymbol: string;
  contractAddress: string;
  abi: any;
  description: string;
}

export default function Wrap() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap, false = unwrap
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTokenType, setSelectedTokenType] = useState<TokenType>('ETH_WETH');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [wrappedBalance, setWrappedBalance] = useState<bigint>(BigInt(0));
  const [detectedTokenType, setDetectedTokenType] = useState<TokenType | null>(null);

  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;
  
  // Define token types and their info
  const tokenTypes: Record<TokenType, TokenInfo> = {
    'ETH_WETH': {
      name: 'Ether',
      symbol: 'ETH',
      wrappedName: 'Wrapped Ether',
      wrappedSymbol: 'wETH',
      contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Mainnet WETH address
      abi: [
        {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"guy","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},
        {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"src","type":"address"},{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"stateMutability":"payable","type":"receive"}
      ],
      description: 'Wrap your ETH into wETH for use in DeFi protocols. wETH is an ERC-20 token that represents ETH 1:1.'
    },
    'STETH_WSTETH': {
      name: 'Staked Ether',
      symbol: 'stETH',
      wrappedName: 'Wrapped Staked Ether',
      wrappedSymbol: 'wstETH',
      contractAddress: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // Mainnet wstETH address
      abi: [
        {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_wstETHAmount","type":"uint256"}],"name":"getStETHByWstETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_stETHAmount","type":"uint256"}],"name":"getWstETHByStETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"stETH","outputs":[{"internalType":"contract IStETH","name":"","type":"address"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_wstETHAmount","type":"uint256"}],"name":"unwrap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_stETHAmount","type":"uint256"}],"name":"wrap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}
      ],
      description: 'Wrap your stETH into wstETH. wstETH represents stETH with a fixed balance, making it easier to integrate with DeFi protocols.'
    }
  };

  // Detect token type from contract ABI
  useEffect(() => {
    if (!contractData?.abi) return;

    const abi = contractData.abi;
    
    // Check for WETH (has deposit and withdraw functions)
    const isWETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'deposit' &&
        item.stateMutability === 'payable'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'withdraw'
    );

    // Check for wstETH (has wrap and unwrap functions)
    const isWstETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'wrap'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'unwrap'
    );

    if (isWETH) {
      setSelectedTokenType('ETH_WETH');
      setDetectedTokenType('ETH_WETH');
    } else if (isWstETH) {
      setSelectedTokenType('STETH_WSTETH');
      setDetectedTokenType('STETH_WSTETH');
    }

    // If contract address is provided, update the token info
    if (contractData.address) {
      if (isWETH) {
        tokenTypes['ETH_WETH'].contractAddress = contractData.address;
      } else if (isWstETH) {
        tokenTypes['STETH_WSTETH'].contractAddress = contractData.address;
      }
    }
  }, [contractData]);

  // Get current token info
  const currentToken = tokenTypes[selectedTokenType];

  useEffect(() => {
    const fetchBalances = async () => {
      if (!window.ethereum || !userAddress) return;

      try {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address: userAddress as Address });
        setUserBalance(ethBalance);

        // Fetch wrapped token balance
        if (currentToken.contractAddress) {
          const wrappedTokenBalance = await publicClient.readContract({
            address: currentToken.contractAddress as Address,
            abi: currentToken.abi,
            functionName: 'balanceOf',
            args: [userAddress as Address],
          });
          setWrappedBalance(wrappedTokenBalance as bigint);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [userAddress, targetNetwork, currentToken, selectedTokenType]);

  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0 || !window.ethereum || !userAddress) {
      notification.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);

    try {
      const parsedAmount = parseEther(amount);
      
      // Create wallet client
      const walletClient = createWalletClient({
        account: userAddress as Address,
        chain: targetNetwork,
        transport: custom(window.ethereum)
      });
      
      // Create public client for reading
      const publicClient = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });

      if (selectedTokenType === 'ETH_WETH') {
        if (isWrapping) {
          // Wrap ETH to WETH
          const wrapTx = async () => {
            const hash = await walletClient.writeContract({
              address: currentToken.contractAddress as Address,
              abi: currentToken.abi,
              functionName: 'deposit',
              args: [], // Empty args array for deposit
              value: parsedAmount
            });
            return hash;
          };
          
          await writeTxn(wrapTx);
          notification.success(`Successfully wrapped ${amount} ${currentToken.symbol} to ${currentToken.wrappedSymbol}`);
        } else {
          // Unwrap WETH to ETH
          const unwrapTx = async () => {
            const hash = await walletClient.writeContract({
              address: currentToken.contractAddress as Address,
              abi: currentToken.abi,
              functionName: 'withdraw',
              args: [parsedAmount]
            });
            return hash;
          };
          
          await writeTxn(unwrapTx);
          notification.success(`Successfully unwrapped ${amount} ${currentToken.wrappedSymbol} to ${currentToken.symbol}`);
        }
      } else if (selectedTokenType === 'STETH_WSTETH') {
        // For stETH/wstETH we need to handle approvals first if wrapping
        if (isWrapping) {
          // First get stETH contract address
          const stEthAddress = await publicClient.readContract({
            address: currentToken.contractAddress as Address,
            abi: currentToken.abi,
            functionName: 'stETH',
            args: []
          }) as Address;
          
          // Approve stETH contract to spend tokens
          const approveTx = async () => {
            const hash = await walletClient.writeContract({
              address: stEthAddress,
              abi: [
                {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
              ],
              functionName: 'approve',
              args: [currentToken.contractAddress as Address, parsedAmount]
            });
            return hash;
          };
          
          await writeTxn(approveTx);
          notification.success(`Approved ${currentToken.symbol} for wrapping`);
          
          // Now wrap stETH to wstETH
          const wrapTx = async () => {
            const hash = await walletClient.writeContract({
              address: currentToken.contractAddress as Address,
              abi: currentToken.abi,
              functionName: 'wrap',
              args: [parsedAmount]
            });
            return hash;
          };
          
          await writeTxn(wrapTx);
          notification.success(`Successfully wrapped ${amount} ${currentToken.symbol} to ${currentToken.wrappedSymbol}`);
        } else {
          // Unwrap wstETH to stETH
          const unwrapTx = async () => {
            const hash = await walletClient.writeContract({
              address: currentToken.contractAddress as Address,
              abi: currentToken.abi,
              functionName: 'unwrap',
              args: [parsedAmount]
            });
            return hash;
          };
          
          await writeTxn(unwrapTx);
          notification.success(`Successfully unwrapped ${amount} ${currentToken.wrappedSymbol} to ${currentToken.symbol}`);
        }
      }
      
      // Reset form and refresh balances
      setAmount('');
      
      // Refresh balances after transaction
      const ethBalance = await publicClient.getBalance({ address: userAddress as Address });
      setUserBalance(ethBalance);
      
      const wrappedTokenBalance = await publicClient.readContract({
        address: currentToken.contractAddress as Address,
        abi: currentToken.abi,
        functionName: 'balanceOf',
        args: [userAddress as Address],
      });
      setWrappedBalance(wrappedTokenBalance as bigint);
      
    } catch (error) {
      console.error("Transaction failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="flex flex-col items-center flex-grow pt-10 w-full px-4 min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Token</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Wrapper
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Wrap and unwrap tokens for DeFi compatibility
        </p>
      </div>

      {/* Token Selection */}
      <div className="w-full max-w-md mt-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Select Token Pair
        </h2>
        
        <div className="flex gap-2 mb-4">
          {(Object.keys(tokenTypes) as TokenType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedTokenType(type)}
              className={`px-4 py-2 rounded-lg ${
                selectedTokenType === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tokenTypes[type].symbol} ↔ {tokenTypes[type].wrappedSymbol}
            </button>
          ))}
        </div>
        
        {detectedTokenType && (
          <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
            <p>
              <span className="font-semibold">Detected contract type:</span> {tokenTypes[detectedTokenType].wrappedName} ({tokenTypes[detectedTokenType].wrappedSymbol})
            </p>
          </div>
        )}
        
        <p className="text-sm text-gray-400 mb-4">
          {currentToken.description}
        </p>
        
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>Your {isWrapping ? currentToken.symbol : currentToken.wrappedSymbol} Balance:</span>
          <span className="font-medium">
            {formatEther(isWrapping ? userBalance : wrappedBalance)} {isWrapping ? currentToken.symbol : currentToken.wrappedSymbol}
          </span>
        </div>
      </div>

      {/* Wrap/Unwrap Form */}
      <div className="w-full max-w-md my-6 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <div className="flex justify-between mb-4">
          <button
            onClick={() => setIsWrapping(true)}
            className={`flex-1 py-2 rounded-l-lg ${
              isWrapping
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Wrap
          </button>
          <button
            onClick={() => setIsWrapping(false)}
            className={`flex-1 py-2 rounded-r-lg ${
              !isWrapping
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Unwrap
          </button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              {isWrapping ? `Amount of ${currentToken.symbol} to wrap` : `Amount of ${currentToken.wrappedSymbol} to unwrap`}
            </label>
            <button
              onClick={() => {
                const maxBalance = isWrapping ? userBalance : wrappedBalance;
                setAmount(formatEther(maxBalance));
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Max
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-400">
              You will receive:
            </span>
            <span className="text-gray-300">
              {amount ? amount : '0'} {isWrapping ? currentToken.wrappedSymbol : currentToken.symbol}
            </span>
          </div>
        </div>

        <button
          onClick={handleWrap}
          disabled={!amount || parseFloat(amount) <= 0 || isLoading}
          className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative
            ${(!amount || parseFloat(amount) <= 0 || isLoading)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            {isWrapping ? `Wrap ${currentToken.symbol} to ${currentToken.wrappedSymbol}` : `Unwrap ${currentToken.wrappedSymbol} to ${currentToken.symbol}`}
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

      {/* Information Card */}
      <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200">
        <h3 className="font-bold mb-2">What are wrapped tokens?</h3>
        <p className="text-sm mb-3">
          Wrapped tokens are ERC-20 representations of non-ERC-20 assets or tokens with different standards. They allow these assets to be used in DeFi protocols that require ERC-20 compatibility.
        </p>
        <h4 className="font-semibold mb-1">Common wrapped tokens:</h4>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><strong>wETH</strong>: Wrapped Ether, an ERC-20 version of ETH</li>
          <li><strong>wstETH</strong>: Wrapped stETH, which maintains a constant balance while stETH rebases</li>
          <li><strong>wBTC</strong>: Wrapped Bitcoin, an ERC-20 representation of BTC</li>
        </ul>
      </div>
    </div>
  );
} 