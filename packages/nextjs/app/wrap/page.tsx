"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, createWalletClient, custom, Address } from 'viem';
import { useTransactor } from '../../hooks/scaffold-eth/useTransactor';
import { useTargetNetwork } from '../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../utils/scaffold-eth/contract";
import { notification } from "../../utils/scaffold-eth/notification";
import { useRouter } from 'next/navigation';
import { useQRTransactionFlow } from '../../hooks/scaffold-eth/useQRTransactionFlow';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import ClientOnly from '../components/ClientOnly';
import { ReadWriteInterface } from "../readwrite/interface";

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Define token types
type TokenType = 'ETH_WETH' | 'STETH_WSTETH';
type TabType = 'wrap' | 'transfer' | 'readwrite';

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

function WrapComponent() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap, false = unwrap
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTokenType, setSelectedTokenType] = useState<TokenType>('ETH_WETH');
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [wrappedBalance, setWrappedBalance] = useState<bigint>(BigInt(0));
  const [detectedTokenType, setDetectedTokenType] = useState<TokenType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('wrap');
  
  // ERC20 Transfer States
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  
  // Update address state to handle connected wallet
  const [address, setAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const { targetNetwork } = useTargetNetwork();
  const writeTxn = useTransactor();
  
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

  // Log the current target network info for debugging
  useEffect(() => {
    console.log("Current target network:", {
      id: targetNetwork.id,
      name: targetNetwork.name,
      nativeCurrency: targetNetwork.nativeCurrency
    });
  }, [targetNetwork]);

  // Function to connect wallet and get address
  const connectWallet = async () => {
    if (!window.ethereum) {
      notification.error("No Ethereum wallet detected. Please install MetaMask or another wallet.");
      return;
    }

    setIsConnecting(true);
    
    try {
      // First try to switch to the correct network
      try {
        console.log("Attempting to switch to network ID:", targetNetwork.id);
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
        });
        console.log("Successfully switched to network:", targetNetwork.name);
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            // Try to add the network
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${targetNetwork.id.toString(16)}`,
                  chainName: targetNetwork.name,
                  nativeCurrency: targetNetwork.nativeCurrency,
                  rpcUrls: [targetNetwork.rpcUrls.default.http[0]],
                  blockExplorerUrls: [targetNetwork.blockExplorers?.default.url],
                },
              ],
            });
            console.log("Added network to wallet:", targetNetwork.name);
          } catch (addError) {
            console.error("Error adding network:", addError);
            notification.error("Could not add network to your wallet. Please add it manually.");
          }
        } else {
          console.error("Error switching network:", switchError);
          notification.info(`Please connect to the ${targetNetwork.name} network manually in your wallet.`);
        }
      }

      // Then request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        notification.success(`Wallet connected on ${targetNetwork.name} network!`);
      } else {
        notification.error("No accounts found. Please check your wallet.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      notification.error(`Failed to connect wallet: ${(error as Error).message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        setAddress('');
        setIsConnected(false);
        notification.info("Wallet disconnected");
      } else {
        // User switched accounts
        setAddress(accounts[0]);
        setIsConnected(true);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      console.log("Chain changed to:", chainId);
      
      // Check if the chain matches our target network
      if (chainId !== targetNetwork.id) {
        notification.info(`Network changed to chain ID ${chainId}. This app works best on ${targetNetwork.name} (${targetNetwork.id}).`);
      } else {
        notification.success(`Connected to ${targetNetwork.name} network!`);
      }
      
      // Force a page refresh to update all state
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          
          // Also check if we're on the right chain
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const connectedChainId = parseInt(chainId, 16);
          
          if (connectedChainId !== targetNetwork.id) {
            notification.info(`You're connected to chain ID ${connectedChainId}. This app works best on ${targetNetwork.name} (${targetNetwork.id}).`);
          }
        }
      } catch (error) {
        console.error("Error checking connection:", error);
      }
    };
    
    checkConnection();

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [targetNetwork]);

  // Define token types and their info
  const tokenTypes: Record<TokenType, TokenInfo> = {
    'ETH_WETH': {
      name: 'Ether',
      symbol: 'ETH',
      wrappedName: 'Wrapped Ether',
      wrappedSymbol: 'wETH',
      contractAddress: contractData?.address || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // Use contract address from detected contract or fallback to Sepolia WETH
      abi: contractData?.abi || [
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":true,"internalType":"address","name":"guy","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"dst","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":true,"internalType":"address","name":"dst","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"guy","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"src","type":"address"},{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}
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
    console.log("Detected contract address:", contractData.address);
    
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
      console.log("Detected WETH contract");
    } else if (isWstETH) {
      setSelectedTokenType('STETH_WSTETH');
      setDetectedTokenType('STETH_WSTETH');
      console.log("Detected wstETH contract");
    } else {
      console.log("Unknown contract type");
    }

    // If contract address is provided, update the token info
    if (contractData.address) {
      if (isWETH) {
        tokenTypes['ETH_WETH'].contractAddress = contractData.address;
        tokenTypes['ETH_WETH'].abi = contractData.abi;
        console.log("Updated WETH contract address to:", contractData.address);
      } else if (isWstETH) {
        tokenTypes['STETH_WSTETH'].contractAddress = contractData.address;
        tokenTypes['STETH_WSTETH'].abi = contractData.abi;
        console.log("Updated wstETH contract address to:", contractData.address);
      }
    }
  }, [contractData]);

  // Get current token info
  const currentToken = tokenTypes[selectedTokenType];

  useEffect(() => {
    const fetchBalances = async () => {
      if (!window.ethereum || !isConnected || !address) return;

      // Ensure address is a valid Ethereum address
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        console.warn("Invalid address format, skipping balance fetch");
        return;
      }

      try {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });

        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address: address as Address });
        setUserBalance(ethBalance);

        // Fetch wrapped token balance
        if (currentToken.contractAddress) {
          const wrappedTokenBalance = await publicClient.readContract({
            address: currentToken.contractAddress as Address,
            abi: currentToken.abi,
            functionName: 'balanceOf',
            args: [address as Address],
          });
          setWrappedBalance(wrappedTokenBalance as bigint);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [address, isConnected, targetNetwork, currentToken, selectedTokenType]);

  // Modify handleWrap to use AppKit for all transactions
  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    // Check if we need to switch networks first (if using window.ethereum directly)
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const connectedChainId = parseInt(chainId, 16);
        
        if (connectedChainId !== targetNetwork.id) {
          notification.info(`Please switch to the ${targetNetwork.name} network before transacting.`);
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
            });
            notification.success(`Switched to ${targetNetwork.name} network!`);
          } catch (switchError) {
            console.error("Failed to switch network:", switchError);
            notification.error("Please switch networks manually in your wallet.");
            return; // Don't proceed with transaction
          }
        }
      } catch (error) {
        console.error("Error checking chain:", error);
      }
    }

    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }

    try {
      const parsedAmount = parseEther(amount);
      
      // Handle transaction using AppKit
      try {
        if (selectedTokenType === 'ETH_WETH') {
          if (isWrapping) {
            // Wrap ETH to WETH
            console.log("Initiating wrap transaction");
            console.log("Amount:", amount, "Parsed amount:", parsedAmount.toString());
            console.log("Contract target address:", currentToken.contractAddress);
            console.log("Current chain ID:", targetNetwork.id);
            
            // Verify the contract address is valid for this chain
            if (selectedTokenType === 'ETH_WETH' && targetNetwork.id !== 11155111 && currentToken.contractAddress === '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9') {
              notification.error(`The contract address is for Sepolia network. Please switch to Sepolia or use a different contract address.`);
              return;
            }
            
            try {
              notification.info(`Initiating wrapping of ${amount} ${currentToken.symbol} to ${currentToken.wrappedSymbol} on ${targetNetwork.name}...`);
              
              await initiateQRTransaction(
                currentToken.contractAddress as Address,
                '0xd0e30db0', // deposit() function signature
                parsedAmount
              );
            } catch (error) {
              console.error("Failed to initiate wrap transaction:", error);
              notification.error(`Failed to initiate wrap: ${(error as Error).message}`);
            }
          } else {
            // Unwrap WETH to ETH
            const data = '0x2e1a7d4d' + parsedAmount.toString(16).padStart(64, '0'); // withdraw(uint) function
            
            console.log("Initiating unwrap transaction with data:", data);
            console.log("Amount:", amount, "Parsed amount:", parsedAmount.toString());
            console.log("Contract target address:", currentToken.contractAddress);
            console.log("Current chain ID:", targetNetwork.id);
            
            // Verify the contract address is valid for this chain
            if (selectedTokenType === 'ETH_WETH' && targetNetwork.id !== 11155111 && currentToken.contractAddress === '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9') {
              notification.error(`The contract address is for Sepolia network. Please switch to Sepolia or use a different contract address.`);
              return;
            }
            
            // For unwrapping, we're sending 0 value since we're calling a contract method
            try {
              notification.info(`Initiating unwrapping of ${amount} ${currentToken.wrappedSymbol} to ${currentToken.symbol} on ${targetNetwork.name}...`);
              
              await initiateQRTransaction(
                currentToken.contractAddress as Address,
                data,
                BigInt(0) // Explicitly set value to 0 for unwrapping
              );
            } catch (error) {
              console.error("Failed to initiate unwrap transaction:", error);
              notification.error(`Failed to initiate unwrap: ${(error as Error).message}`);
            }
          }
        } else if (selectedTokenType === 'STETH_WSTETH') {
          if (isWrapping) {
            // Create public client for reading
            const publicClient = createPublicClient({
              chain: targetNetwork,
              transport: http(),
            });
            
            // First get stETH contract address
            const stEthAddress = await publicClient.readContract({
              address: currentToken.contractAddress as Address,
              abi: currentToken.abi,
              functionName: 'stETH',
              args: []
            }) as Address;
            
            // Approve stETH
            const approveData = '0x095ea7b3' + 
              currentToken.contractAddress.slice(2).padStart(64, '0') +
              parsedAmount.toString(16).padStart(64, '0');
              
            await initiateQRTransaction(stEthAddress, approveData);
            
            // Then wrap stETH
            const wrapData = '0xea598cb0' + parsedAmount.toString(16).padStart(64, '0');
            await initiateQRTransaction(
              currentToken.contractAddress as Address,
              wrapData
            );
          } else {
            // Unwrap wstETH
            const data = '0xde0e9a3e' + parsedAmount.toString(16).padStart(64, '0');
            await initiateQRTransaction(
              currentToken.contractAddress as Address,
              data
            );
          }
        }
        
        // Reset amount after transaction is initiated
        setAmount('');
      } catch (error) {
        console.error("Transaction failed:", error);
        notification.error(`Transaction failed: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Transaction failed:", error);
      
      // Handle timeout errors specifically
      if ((error as Error).message.includes('timeout') || (error as Error).message.includes('timed out')) {
        notification.error(`Network connection timed out. Please try again or use a different network.`);
      } else {
        notification.error(`Transaction failed: ${(error as Error).message}`);
      }
    } finally {
      // Only reset loading if AppKit is not executing
      if (!isExecuting) {
        setIsLoading(false);
      }
    }
  };

  const handleTransfer = async () => {
    if (!isAddress(recipientAddress) || !transferAmount || !tokenTypes[selectedTokenType]?.contractAddress) return;
    
    // Don't set loading if the transaction is already executing through AppKit
    if (!isExecuting) {
      setIsLoading(true);
    }
    
    try {
      const parsedAmount = parseEther(transferAmount);
      
      // Create the transfer data
      // For ERC20 transfer: function transfer(address to, uint256 amount)
      // Function signature: 0xa9059cbb
      const transferData = '0xa9059cbb' + 
        recipientAddress.substring(2).padStart(64, '0') + 
        parsedAmount.toString(16).padStart(64, '0');
      
      console.log("Initiating transfer transaction");
      console.log("Amount:", transferAmount, "Parsed amount:", parsedAmount.toString());
      console.log("Recipient:", recipientAddress);
      
      try {
        notification.info(`Initiating transfer of ${transferAmount} ${tokenTypes[selectedTokenType]?.wrappedSymbol} to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(38)} on ${targetNetwork.name}...`);
        
        await initiateQRTransaction(
          tokenTypes[selectedTokenType]?.contractAddress as Address,
          transferData,
          BigInt(0) // No ETH value is sent for token transfers
        );
        
        // Reset amount after transaction is initiated
        setTransferAmount('');
      } catch (error) {
        console.error("Failed to initiate transfer transaction:", error);
        notification.error(`Failed to initiate transfer: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error("Transfer failed:", error);
      notification.error(`Transaction failed: ${(error as Error).message}`);
    } finally {
      // Only reset loading if AppKit is not executing
      if (!isExecuting) {
        setIsLoading(false);
      }
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Mock test for WETH transfer functionality
  const testTransferFunction = async () => {
    try {
      // Setup mock data
      const mockRecipient = '0x1234567890123456789012345678901234567890';
      const mockAmount = '0.01';
      
      console.log(`Testing transfer of ${mockAmount} WETH to ${mockRecipient}`);
      
      // Create the transfer data (this is what would be sent to the contract)
      const mockParsedAmount = parseEther(mockAmount);
      
      // For ERC20 transfer: function transfer(address to, uint256 amount)
      // Function signature: 0xa9059cbb
      const transferData = '0xa9059cbb' + 
        mockRecipient.substring(2).padStart(64, '0') + 
        mockParsedAmount.toString(16).padStart(64, '0');
      
      // Log the transaction data that would be sent
      console.log("Transfer function data:", transferData);
      
      // Simulate transaction (in a real scenario this would call the contract)
      console.log("Transaction successful (simulated)");
      console.log(`Transferred ${mockAmount} WETH to ${mockRecipient}`);
      
      return {
        success: true,
        message: `Successfully transferred ${mockAmount} WETH to ${mockRecipient}`,
        txData: transferData
      };
    } catch (error) {
      console.error("Test transfer failed:", error);
      return {
        success: false,
        message: `Failed to transfer: ${(error as Error).message}`,
        error
      };
    }
  };
  
  // Run the test once on load
  useEffect(() => {
    const runTest = async () => {
      const result = await testTransferFunction();
      if (result.success) {
        console.log("WETH Transfer Test:", result.message);
        console.log("Transaction Data:", result.txData);
      } else {
        console.error("WETH Transfer Test Failed:", result.message);
      }
    };
    
    // Only run in development
    if (process.env.NODE_ENV === 'development') {
      runTest();
    }
  }, []);

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
          <span className="block text-2xl mb-2 text-gray-300">Wrapped Token Interface</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            {isWrapping
              ? `${tokenTypes[selectedTokenType]?.name} → ${tokenTypes[selectedTokenType]?.wrappedName}`
              : `${tokenTypes[selectedTokenType]?.wrappedName} → ${tokenTypes[selectedTokenType]?.name}`}
          </span>
        </h1>
      </div>

      {/* Token Type Selection */}
      <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 bg-gray-800/70 p-2 rounded-xl">
        <span className="text-gray-300 text-sm">Select Token:</span>
        {Object.keys(tokenTypes).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedTokenType(type as TokenType)}
            className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium
              ${selectedTokenType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {tokenTypes[type as TokenType]?.name} / {tokenTypes[type as TokenType]?.wrappedName}
          </button>
        ))}
      </div>

      {/* Tab selection */}
      <div className="flex w-full max-w-md gap-2 mt-4 mb-2">
        <button
          onClick={() => handleTabChange('wrap')}
          className={`flex-1 px-4 py-2 rounded-tl-lg rounded-tr-lg font-medium transition-colors
            ${activeTab === 'wrap'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Wrap/Unwrap
        </button>
        <button
          onClick={() => handleTabChange('transfer')}
          className={`flex-1 px-4 py-2 rounded-tl-lg rounded-tr-lg font-medium transition-colors
            ${activeTab === 'transfer'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Transfer
        </button>
        <button
          onClick={() => handleTabChange('readwrite')}
          className={`flex-1 px-4 py-2 rounded-tl-lg rounded-tr-lg font-medium transition-colors
            ${activeTab === 'readwrite'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Read/Write
        </button>
      </div>

      {/* Wallet Connection & Balances */}
      <div className="w-full max-w-md my-4 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-center">
        {!isConnected ? (
          <button
            onClick={connectWallet}
            className={`px-6 py-3 rounded-xl shadow-lg transition-all duration-200 ${
              isConnecting
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
            } text-white font-medium relative`}
          >
            <span className={isConnecting ? 'opacity-0' : 'opacity-100'}>Connect Wallet</span>
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-left">
              <div className="text-sm text-gray-400">Connected as:</div>
              <div className="font-mono text-sm text-gray-300 truncate max-w-[180px]">{address}</div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex gap-1 text-sm">
                <span className="text-gray-400">{tokenTypes[selectedTokenType]?.name}:</span>
                <span className="font-medium">{formatEther(userBalance || BigInt(0))} {tokenTypes[selectedTokenType]?.symbol}</span>
              </div>
              <div className="flex gap-1 text-sm">
                <span className="text-gray-400">{tokenTypes[selectedTokenType]?.wrappedName}:</span>
                <span className="font-medium">{formatEther(wrappedBalance || BigInt(0))} {tokenTypes[selectedTokenType]?.wrappedSymbol}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'wrap' && (
        <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
          {/* Wrap/Unwrap UI */}
          <div className="flex justify-between mb-4">
            <button
              onClick={() => setIsWrapping(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isWrapping
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Wrap
            </button>
            <button
              onClick={() => setIsWrapping(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                !isWrapping
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Unwrap
            </button>
          </div>

          {/* Existing Wrap/Unwrap UI */}
          {/* ... existing code ... */}
        </div>
      )}

      {activeTab === 'transfer' && isConnected && (
        <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
          <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Transfer {tokenTypes[selectedTokenType]?.wrappedSymbol}
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
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="Amount"
            className="w-full my-2 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleTransfer}
            disabled={!isAddress(recipientAddress) || !transferAmount || isLoading || isExecuting}
            className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative
              ${(!isAddress(recipientAddress) || !transferAmount || isLoading || isExecuting)
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
              } font-medium`}
          >
            <span className={`${isLoading || isExecuting ? 'opacity-0' : 'opacity-100'}`}>
              Transfer
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
        </div>
      )}

      {activeTab === 'readwrite' && isConnected && tokenTypes[selectedTokenType]?.contractAddress && (
        <div className="w-full max-w-md mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
          <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            {tokenTypes[selectedTokenType]?.wrappedName} Contract
          </h2>
          <ReadWriteInterface 
            contractAddress={tokenTypes[selectedTokenType]?.contractAddress}
            abi={tokenTypes[selectedTokenType]?.abi || []}
            chainId={targetNetwork.id}
          />
        </div>
      )}

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
        </ul>
      </div>

      {/* Cancel transaction option during loading/executing */}
      {(isLoading || isExecuting) && (
        <div className="w-full max-w-md mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="text-center mb-2">
            Transaction in progress. Please check your wallet for confirmation requests.
          </p>
          <button
            onClick={() => {
              cancelTransaction();
              setIsLoading(false); // Also reset the local loading state
              setAmount(''); // Reset the amount input
              setTransferAmount(''); // Reset the transfer amount input
            }}
            className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Render QR Transaction Modal */}
      <QRTransactionModalComponent />
    </div>
  );
}

export default function Wrap() {
  return (
    <ClientOnly fallback={<div className="container mx-auto p-4">Loading wrap/unwrap interface...</div>}>
      <WrapComponent />
    </ClientOnly>
  );
} 