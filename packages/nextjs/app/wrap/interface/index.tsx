"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";

export default function WrapInterface() {
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap, false = unwrap
  const [isLoading, setIsLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [wrappedBalance, setWrappedBalance] = useState<bigint>(BigInt(0));
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [wrappedSymbol, setWrappedSymbol] = useState<string>("");
  
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

  // Detect token type and set names
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
      setTokenName("Ether");
      setTokenSymbol("ETH");
      setWrappedSymbol("WETH");
    } else if (isWstETH) {
      setTokenName("Staked Ether");
      setTokenSymbol("stETH");
      setWrappedSymbol("wstETH");
    }
  }, [contractData?.abi]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!userAddress || !contractData?.address) return;

      try {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address: userAddress as Address });
        setUserBalance(ethBalance);

        // Fetch wrapped token balance
        if (contractData.address) {
          const wrappedTokenBalance = await publicClient.readContract({
            address: contractData.address as Address,
            abi: contractData.abi,
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
  }, [userAddress, contractData, targetNetwork]);

  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0 || !contractData?.address) return;

    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
      const parsedAmount = parseEther(amount);
      
      try {
        if (isWrapping) {
          // For WETH wrapping, we use the deposit() function (0xd0e30db0)
          // This is a payable function, so we send ETH with it
          notification.info(`Initiating wrapping of ${amount} ${tokenSymbol} to ${wrappedSymbol} on ${targetNetwork.name}...`);
          
          await initiateQRTransaction(
            contractData.address as Address,
            '0xd0e30db0', // deposit() function signature
            parsedAmount
          );
        } else {
          // For WETH unwrapping, we use the withdraw(uint) function
          // Function signature: 0x2e1a7d4d
          // No ETH is sent for unwrapping
          const data = '0x2e1a7d4d' + parsedAmount.toString(16).padStart(64, '0');
          
          notification.info(`Initiating unwrapping of ${amount} ${wrappedSymbol} to ${tokenSymbol} on ${targetNetwork.name}...`);
          
          await initiateQRTransaction(
            contractData.address as Address,
            data,
            BigInt(0) // Explicitly set value to 0 for unwrapping
          );
        }
        
        // Reset amount after transaction is initiated
        setAmount('');
      } catch (error) {
        console.error(`Failed to initiate ${isWrapping ? 'wrap' : 'unwrap'} transaction:`, error);
        notification.error(`Failed to initiate ${isWrapping ? 'wrap' : 'unwrap'}: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error(`${isWrapping ? 'Wrap' : 'Unwrap'} failed:`, error);
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
          Token Wrapper
        </h2>
        <p className="text-md text-gray-300 mt-2">
          Wrap and unwrap tokens for DeFi compatibility
        </p>
      </div>

      {/* Toggle Wrap/Unwrap */}
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

      {/* Input Amount */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <div className="flex justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            {isWrapping ? `Amount of ${tokenSymbol} to wrap` : `Amount of ${wrappedSymbol} to unwrap`}
          </label>
          {userAddress && (
            <button
              onClick={() => {
                const maxBalance = isWrapping ? userBalance : wrappedBalance;
                setAmount(formatEther(maxBalance));
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Max
            </button>
          )}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-gray-400">
            You will receive:
          </span>
          <span className="text-gray-300">
            {amount ? amount : '0'} {isWrapping ? wrappedSymbol : tokenSymbol}
          </span>
        </div>
        
        {userAddress && (
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Balance:</span>
            <span>
              {formatEther(isWrapping ? userBalance : wrappedBalance)} {isWrapping ? tokenSymbol : wrappedSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={handleWrap}
        disabled={!amount || parseFloat(amount) <= 0 || isLoading || isExecuting}
        className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
          ${(!amount || parseFloat(amount) <= 0 || isLoading || isExecuting)
            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
          } font-medium text-sm`}
      >
        <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
          {isWrapping ? `Wrap ${tokenSymbol}` : `Unwrap ${wrappedSymbol}`}
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
      
      {/* Cancel transaction option during loading/executing */}
      {(isLoading || isExecuting) && (
        <div className="mt-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
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

      {/* Information Card */}
      <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
        <h3 className="font-bold mb-2">What are wrapped tokens?</h3>
        <p className="text-sm mb-2">
          Wrapped tokens are ERC-20 representations of non-ERC-20 assets or tokens with different standards. They allow these assets to be used in DeFi protocols that require ERC-20 compatibility.
        </p>
      </div>

      {/* Render QR Transaction Modal */}
      <QRTransactionModalComponent />
    </div>
  );
} 