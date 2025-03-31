"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { isAddress, formatEther, parseEther, createPublicClient, http, Address } from 'viem';
import * as viemChains from 'viem/chains';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { 
  useAppKit, 
  useAppKitAccount, 
  useAppKitProvider, 
  useAppKitNetwork,
  useDisconnect,
  createAppKit
} from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { BrowserProvider } from 'ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { ethers } from "ethers";
import { formatUnits, parseUnits } from "viem";
import { useNotification } from "../../../utils/scaffold-eth";
import { BatchOperation } from "../../../types/batch";

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in ERC20 interface...');
    // Project metadata
    const metadata = {
      name: 'WrapTX ERC20',
      description: 'Interact with ERC20 tokens',
      url: 'https://reown.net',
      icons: ['https://reown.net/images/logo.png'],
    };
    
    // WalletConnect project ID (get from environment or use placeholder)
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';
    
    // Create ethers adapter
    const ethersAdapter = new EthersAdapter();
    
    // Generate AppKit networks from all available viem chains
    const viemChainsArray = Object.values(viemChains).filter(
      (chain): chain is typeof viemChains.mainnet => 
        typeof chain === 'object' && 
        chain !== null && 
        'id' in chain && 
        typeof chain.id === 'number'
    );
    
    // Convert viem chains to AppKit networks
    const appKitNetworks: AppKitNetwork[] = viemChainsArray.map(chain => ({
      id: chain.id,
      name: chain.name || `Chain ${chain.id}`,
      rpcUrls: {
        default: {
          http: chain.rpcUrls?.default?.http || [`https://rpc.ankr.com/${chain.id}`]
        }
      },
      nativeCurrency: {
        name: chain.nativeCurrency?.name || 'Ether',
        symbol: chain.nativeCurrency?.symbol || 'ETH',
        decimals: chain.nativeCurrency?.decimals || 18,
      },
      blockExplorers: chain.blockExplorers?.default 
        ? {
            default: {
              url: chain.blockExplorers.default.url,
              name: chain.blockExplorers.default.name || 'Explorer'
            }
          }
        : {
            default: {
              url: `https://etherscan.io`,
              name: 'Explorer'
            }
          }
    }));
    
    // Ensure we have at least mainnet as the first item
    const mainnetNetwork = appKitNetworks.find(n => n.id === 1);
    if (mainnetNetwork) {
      // Move mainnet to the beginning of the array
      const filteredNetworks = appKitNetworks.filter(n => n.id !== 1);
      const networks = [mainnetNetwork, ...filteredNetworks] as [AppKitNetwork, ...AppKitNetwork[]];
      
      console.log(`Initializing AppKit with ${networks.length} networks`);
      console.log('Networks included:', networks.map(n => `${n.name} (${n.id})`).slice(0, 5), '...');
      
      createAppKit({
        adapters: [ethersAdapter],
        networks,
        metadata,
        projectId,
        themeMode: 'dark',
        features: {
          analytics: true,
        },
        themeVariables: {
          // Theme customization if needed
        },
      });
    } else {
      throw new Error("Mainnet network not found in viem chains");
    }
    
    // Mark as initialized
    (window as any).__APPKIT_INITIALIZED__ = true;
    console.log('AppKit initialized in ERC20 interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

export interface ERC20InterfaceProps {
  contractAddress: string;
  abi: any[] | [];
  chainId?: number;
  addToBatch?: (operation: BatchOperation) => void;
}

export const ERC20Interface = ({ contractAddress, abi, chainId, addToBatch }: ERC20InterfaceProps) => {
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [userBalance, setUserBalance] = useState<string>("0");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [spenderAddress, setSpenderAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [decimals, setDecimals] = useState<number>(18);
  const [totalSupply, setTotalSupply] = useState<string>("0");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);

  const isValidRecipient = isAddress(recipientAddress) && recipientAddress !== contractAddress;
  const isValidSpender = isAddress(spenderAddress);
  const isValidAmount = amount !== "" && !isNaN(Number(amount)) && Number(amount) > 0;

  // Initialize contract and fetch token info
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!contractAddress) return;
      
      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(`https://rpc.ankr.com/eth${chainId ? `_${chainId}` : ""}`);
        const contract = new ethers.Contract(contractAddress, abi, provider);

        const [name, symbol, dec, supply] = await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.decimals(),
          contract.totalSupply()
        ]);

        setTokenName(name);
        setTokenSymbol(symbol);
        setDecimals(Number(dec));
        setTotalSupply(formatUnits(BigInt(supply.toString()), Number(dec)));
        
        if (accountAddress) {
          const balance = await contract.balanceOf(accountAddress);
          setUserBalance(formatUnits(BigInt(balance.toString()), Number(dec)));
        }
      } catch (error) {
        console.error("Error fetching token info:", error);
        notification.error("Error fetching token information");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenInfo();
  }, [contractAddress, accountAddress, abi, chainId, notification]);

  // Function to refresh user balance
  const refreshBalance = useCallback(async () => {
    if (!contractAddress || !accountAddress) return;
    
    try {
      const provider = new ethers.JsonRpcProvider(`https://rpc.ankr.com/eth${chainId ? `_${chainId}` : ""}`);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const balance = await contract.balanceOf(accountAddress);
      setUserBalance(formatUnits(BigInt(balance.toString()), decimals));
          } catch (error) {
      console.error("Error refreshing balance:", error);
    }
  }, [contractAddress, accountAddress, abi, decimals, chainId]);

  // Transfer tokens
  const handleTransfer = async () => {
    if (!contractAddress || !accountAddress || !isValidRecipient || !isValidAmount) return;
    
    setIsTransferring(true);
    try {
      // Verify recipient is not the token contract itself
      if (recipientAddress.toLowerCase() === contractAddress.toLowerCase()) {
        notification.error("Cannot transfer tokens to the token contract itself");
        setIsTransferring(false);
        return;
      }

      const parsedAmount = parseUnits(amount, decimals);
      
      try {
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error("Ethereum provider not available");
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, abi, signer);
        
        // Get gas estimate and add 20% buffer
        const gasEstimate = await provider.estimateGas({
          from: accountAddress,
          to: contractAddress,
          data: contract.interface.encodeFunctionData("transfer", [recipientAddress, parsedAmount])
        });
        
        const gasLimit = (gasEstimate * 120n) / 100n; // Adding 20% buffer
        
        // Send transaction with gas buffer
        const tx = await contract.transfer(recipientAddress, parsedAmount, {
          gasLimit
        });
        
        notification.success(`Transfer initiated! Transaction hash: ${tx.hash}`);
        setRecipientAddress("");
        setAmount("");
        
        // Wait a moment and refresh balance
        setTimeout(refreshBalance, 2000);
      } catch (error: any) {
        console.error("Error executing transfer:", error);
        
        // Enhanced error messages
        if (error.message.includes("insufficient funds")) {
          notification.error("Insufficient token balance for this transfer");
        } else if (error.message.includes("execution reverted")) {
          notification.error("Transaction reverted: Possible reasons include insufficient balance or contract restrictions");
        } else {
          notification.error(`Error: ${error.message.slice(0, 100)}...`);
        }
      }
    } catch (error) {
      console.error("Error with transfer:", error);
      notification.error("Error initiating transfer");
    } finally {
      setIsTransferring(false);
    }
  };

  // Add transfer to batch
  const addTransferToBatch = () => {
    if (!contractAddress || !accountAddress || !isValidRecipient || !isValidAmount || !addToBatch) return;
    
    try {
      // Verify recipient is not the token contract itself
      if (recipientAddress.toLowerCase() === contractAddress.toLowerCase()) {
        notification.error("Cannot transfer tokens to the token contract itself");
        return;
      }
      
      const parsedAmount = parseUnits(amount, decimals);
      
      // Create the contract interface
      const iface = new ethers.Interface(abi);
      
      // Encode the transfer function call
      const data = iface.encodeFunctionData("transfer", [recipientAddress, parsedAmount]);
      
      // Add to batch
      addToBatch({
        type: 'transfer',
        interfaceType: 'erc20',
        to: contractAddress,
        data: data,
        value: "0",
        description: `Transfer ${amount} ${tokenSymbol} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`
      });
      
      notification.success(`Added transfer of ${amount} ${tokenSymbol} to batch queue!`);
    } catch (error) {
      console.error("Error adding transfer to batch:", error);
      notification.error("Error adding transfer to batch");
    }
  };

  // Approve tokens
  const handleApprove = async () => {
    if (!contractAddress || !accountAddress || !isValidSpender || !isValidAmount) return;
    
    setIsApproving(true);
    try {
      const parsedAmount = parseUnits(amount, decimals);
      
      try {
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error("Ethereum provider not available");
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, abi, signer);
        
        // Get gas estimate and add 20% buffer
        const gasEstimate = await provider.estimateGas({
          from: accountAddress,
          to: contractAddress,
          data: contract.interface.encodeFunctionData("approve", [spenderAddress, parsedAmount])
        });
        
        const gasLimit = (gasEstimate * 120n) / 100n; // Adding 20% buffer
        
        // Send transaction with gas buffer
        const tx = await contract.approve(spenderAddress, parsedAmount, {
          gasLimit
        });
        
        notification.success(`Approval initiated! Transaction hash: ${tx.hash}`);
        setSpenderAddress("");
        setAmount("");
      } catch (error: any) {
        console.error("Error executing approval:", error);
        
        // Enhanced error messages
        if (error.message.includes("insufficient funds")) {
          notification.error("Insufficient funds for gas");
        } else if (error.message.includes("execution reverted")) {
          notification.error("Transaction reverted: The contract rejected this approval");
        } else {
          notification.error(`Error: ${error.message.slice(0, 100)}...`);
        }
      }
    } catch (error) {
      console.error("Error with approval:", error);
      notification.error("Error initiating approval");
    } finally {
      setIsApproving(false);
    }
  };

  // Add approve to batch
  const addApproveToBatch = () => {
    if (!contractAddress || !accountAddress || !isValidSpender || !isValidAmount || !addToBatch) return;
    
    try {
      const parsedAmount = parseEther(amount);
      
      // Create the contract interface
      const iface = new ethers.Interface(abi);
      
      // Encode the approve function call
      const data = iface.encodeFunctionData("approve", [spenderAddress, parsedAmount]);
      
      // Add to batch
      addToBatch({
        type: 'approve',
        interfaceType: 'erc20',
        to: contractAddress,
        data: data,
        value: "0",
        description: `Approve ${spenderAddress.slice(0, 6)}...${spenderAddress.slice(-4)} to spend ${amount} ${tokenSymbol}`
      });
      
      notification.success(`Added approval of ${amount} ${tokenSymbol} to batch queue!`);
    } catch (error) {
      console.error("Error adding approval to batch:", error);
      notification.error("Error adding approval to batch");
    }
  };

  // Check if wallet is connected
  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccountAddress(accounts[0].address);
          } else {
            setAccountAddress(null);
          }
        } catch (error) {
          console.error("Error checking wallet:", error);
          setAccountAddress(null);
        }
      }
    };
    
    checkWallet();
    
    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', checkWallet);
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', checkWallet);
      }
    };
  }, []);

  // Add a connectWallet function after the wallet check useEffect

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      notification.error("Ethereum provider not available. Please use a Web3 browser.");
      return;
    }
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccountAddress(accounts[0].address);
        notification.success("Wallet connected!");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      notification.error("Error connecting wallet: " + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-blue-400">ERC20 Token Interface</h2>
        <div className="text-sm text-gray-400">
          {isLoading ? "Loading..." : `${tokenName} (${tokenSymbol})`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/30 rounded-xl p-4">
          <h3 className="text-lg font-medium text-blue-400 mb-3">Token Information</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Name:</span>
              <span className="text-white">{isLoading ? "Loading..." : tokenName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Symbol:</span>
              <span className="text-white">{isLoading ? "Loading..." : tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Decimals:</span>
              <span className="text-white">{isLoading ? "Loading..." : decimals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Supply:</span>
              <span className="text-white">{isLoading ? "Loading..." : `${Number(totalSupply).toLocaleString()} ${tokenSymbol}`}</span>
            </div>
            {accountAddress && (
              <div className="flex justify-between">
                <span className="text-gray-400">Your Balance:</span>
                <div className="text-white flex items-center gap-2">
                  {isLoading ? "Loading..." : `${Number(userBalance).toLocaleString()} ${tokenSymbol}`}
                  <button 
                    onClick={refreshBalance}
                    className="text-xs bg-gray-700 hover:bg-gray-600 p-1 rounded-md transition-colors"
                    title="Refresh Balance"
                  >
                    ↻
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-800/30 rounded-xl p-4">
          <h3 className="text-lg font-medium text-blue-400 mb-3">Transfer Tokens</h3>
          {!accountAddress ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="text-yellow-400 text-sm">Connect your wallet to transfer tokens</div>
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-gray-300 mb-1">
                  Recipient Address:
                </label>
        <input
                  id="recipient"
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className={`w-full p-2 rounded-md bg-gray-700 text-white ${
                    recipientAddress && !isValidRecipient ? "border border-red-500" : ""
                  }`}
                />
                {recipientAddress && !isValidRecipient && (
                  <p className="text-red-500 text-xs mt-1">
                    {recipientAddress === contractAddress 
                      ? "Cannot transfer to token contract" 
                      : "Invalid address format"}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="transferAmount" className="block text-sm font-medium text-gray-300 mb-1">
                  Amount:
                </label>
                <div className="flex">
        <input
                    id="transferAmount"
                    type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className={`w-full p-2 rounded-l-md bg-gray-700 text-white ${
                      amount && !isValidAmount ? "border border-red-500" : ""
                    }`}
                  />
                  <div className="bg-gray-600 text-white px-2 flex items-center rounded-r-md">
                    {tokenSymbol}
                  </div>
                </div>
                {amount && !isValidAmount && (
                  <p className="text-red-500 text-xs mt-1">Please enter a valid amount</p>
                )}
              </div>
              
              <div className="flex gap-2">
        <button
          onClick={handleTransfer}
                  disabled={!isValidRecipient || !isValidAmount || isTransferring}
                  className={`px-4 py-2 rounded-md transition-colors flex-1 ${
                    !isValidRecipient || !isValidAmount || isTransferring
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isTransferring ? "Transferring..." : "Transfer"}
                </button>
                
                {addToBatch && (
                  <button
                    onClick={addTransferToBatch}
                    disabled={!isValidRecipient || !isValidAmount}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      !isValidRecipient || !isValidAmount
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    Add to Batch
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800/30 rounded-xl p-4">
        <h3 className="text-lg font-medium text-blue-400 mb-3">Approve Spender</h3>
        {!accountAddress ? (
          <div className="flex flex-col items-center space-y-2">
            <div className="text-yellow-400 text-sm">Connect your wallet to approve tokens</div>
            <button
              onClick={connectWallet}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="spender" className="block text-sm font-medium text-gray-300 mb-1">
                Spender Address:
              </label>
        <input
                id="spender"
          type="text"
          value={spenderAddress}
          onChange={(e) => setSpenderAddress(e.target.value)}
                placeholder="0x..."
                className={`w-full p-2 rounded-md bg-gray-700 text-white ${
                  spenderAddress && !isValidSpender ? "border border-red-500" : ""
                }`}
              />
              {spenderAddress && !isValidSpender && (
                <p className="text-red-500 text-xs mt-1">Invalid address format</p>
              )}
            </div>
            
            <div>
              <label htmlFor="approveAmount" className="block text-sm font-medium text-gray-300 mb-1">
                Amount:
              </label>
              <div className="flex">
        <input
                  id="approveAmount"
                  type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className={`w-full p-2 rounded-l-md bg-gray-700 text-white ${
                    amount && !isValidAmount ? "border border-red-500" : ""
                  }`}
                />
                <div className="bg-gray-600 text-white px-2 flex items-center rounded-r-md">
                  {tokenSymbol}
                </div>
              </div>
              {amount && !isValidAmount && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid amount</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={!isValidSpender || !isValidAmount || isApproving}
                className={`px-4 py-2 rounded-md transition-colors flex-1 ${
                  !isValidSpender || !isValidAmount || isApproving
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                {isApproving ? "Approving..." : "Approve"}
        </button>
              
              {addToBatch && (
          <button
                  onClick={addApproveToBatch}
                  disabled={!isValidSpender || !isValidAmount}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    !isValidSpender || !isValidAmount
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  Add to Batch
          </button>
              )}
            </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ERC20Interface; 