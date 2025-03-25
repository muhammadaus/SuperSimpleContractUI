"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
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
import { BrowserProvider, ethers } from 'ethers';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Utility function to convert viem chain to AppKit network
const convertViemChainToAppKitNetwork = (chainId: number): AppKitNetwork => {
  // Find the chain in viem chains
  const viemChain = Object.values(viemChains).find(
    (chain) => typeof chain === 'object' && chain !== null && 'id' in chain && chain.id === chainId
  );
  
  if (!viemChain || typeof viemChain !== 'object') {
    throw new Error(`Chain with ID ${chainId} not found in viem chains`);
  }
  
  // Convert to AppKit network format
  return {
    id: chainId,
    name: 'name' in viemChain ? String(viemChain.name) : `Chain ${chainId}`,
    rpcUrls: {
      default: {
        http: [
          'rpcUrls' in viemChain && 
          viemChain.rpcUrls && 
          'default' in viemChain.rpcUrls && 
          'http' in viemChain.rpcUrls.default && 
          Array.isArray(viemChain.rpcUrls.default.http) && 
          viemChain.rpcUrls.default.http.length > 0
            ? viemChain.rpcUrls.default.http[0]
            : `https://rpc.ankr.com/${chainId}`
        ]
      }
    },
    nativeCurrency: {
      name: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? String(viemChain.nativeCurrency.name) : 'Ether',
      symbol: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? String(viemChain.nativeCurrency.symbol) : 'ETH',
      decimals: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? Number(viemChain.nativeCurrency.decimals) : 18,
    },
    blockExplorers: {
      default: {
        url: 'blockExplorers' in viemChain && 
             viemChain.blockExplorers && 
             'default' in viemChain.blockExplorers && 
             'url' in viemChain.blockExplorers.default
          ? String(viemChain.blockExplorers.default.url)
          : `https://etherscan.io`,
        name: 'Explorer'
      }
    }
  };
};

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in readwrite interface...');
    // Project metadata
    const metadata = {
      name: 'Contract Interface',
      description: 'Read and write to any contract',
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
    console.log('AppKit initialized in readwrite interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

interface ReadWriteInterfaceProps {
  contractAddress?: string;
  abi?: any;
}

export default function ReadWriteInterface({ contractAddress, abi }: ReadWriteInterfaceProps) {
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [functionInputs, setFunctionInputs] = useState<{[key: string]: string}>({});
  const [functionResult, setFunctionResult] = useState<string>('');
  const [availableFunctions, setAvailableFunctions] = useState<any[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txValue, setTxValue] = useState<string>('0');
  const [contractInfo, setContractInfo] = useState<{name: string, symbol: string}>({
    name: "",
    symbol: ""
  });
  
  // Get user address and network from AppKit
  const { targetNetwork } = useTargetNetwork();
  const { isConnected, address: userAddress } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  const { walletProvider } = useAppKitProvider<any>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contractAddress && abi ? { address: contractAddress, abi } : contracts?.[targetNetwork.id]?.YourContract;

  // Parse ABI and extract functions
  useEffect(() => {
    if (!contractData?.abi) return;

    try {
      const abi = contractData.abi;
      
      // Extract all functions from ABI
      const functions = abi.filter((item: any) => item.type === 'function');
      
      // Set available functions
      setAvailableFunctions(functions);
      
      // Try to get name and symbol if available
      const getContractInfo = async () => {
        const publicClient = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });
        
        try {
          // Check if contract has name() and symbol() functions
          const hasName = abi.some((item: any) => 
            item.type === 'function' && item.name === 'name' && item.inputs.length === 0);
          
          const hasSymbol = abi.some((item: any) => 
            item.type === 'function' && item.name === 'symbol' && item.inputs.length === 0);
          
          if (hasName && contractData.address) {
            const name = await publicClient.readContract({
              address: contractData.address as Address,
              abi: abi,
              functionName: 'name',
              args: [] as const
            });
            
            setContractInfo(prev => ({ ...prev, name: name as string }));
          }
          
          if (hasSymbol && contractData.address) {
            const symbol = await publicClient.readContract({
              address: contractData.address as Address,
              abi: abi,
              functionName: 'symbol',
              args: [] as const
            });
            
            setContractInfo(prev => ({ ...prev, symbol: symbol as string }));
          }
        } catch (error) {
          console.error("Error fetching contract info:", error);
        }
      };
      
      getContractInfo();
    } catch (error) {
      console.error("Error parsing ABI:", error);
    }
  }, [contractData, targetNetwork]);

  // When function is selected, reset inputs and results
  useEffect(() => {
    if (selectedFunction) {
      const functionDef = availableFunctions.find(f => f.name === selectedFunction);
      if (functionDef) {
        // Create empty input object
        const inputs: {[key: string]: string} = {};
        functionDef.inputs.forEach((input: any) => {
          inputs[input.name || `param${input.position}`] = '';
        });
        
        setFunctionInputs(inputs);
        setFunctionResult('');
        
        // Determine if function is read-only
        const stateMutability = functionDef.stateMutability || '';
        setIsReadOnly(stateMutability === 'view' || stateMutability === 'pure');
      }
    }
  }, [selectedFunction, availableFunctions]);

  const handleInputChange = (name: string, value: string) => {
    setFunctionInputs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleValueChange = (value: string) => {
    setTxValue(value);
  };

  const handleInvoke = async () => {
    if (!selectedFunction || !contractData?.address) return;
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !userAddress) {
      notification.info("Please connect your wallet first");
      try {
        // Open AppKit to connect wallet
        openAppKit();
        return;
      } catch (error) {
        console.error("Error opening wallet:", error);
        notification.error("Could not open wallet connection");
        return;
      }
    }
    
    // Check if a transaction is already in progress
    if (isLoading) {
      notification.info("Please wait for the current operation to complete");
      return;
    }
    
    const functionDef = availableFunctions.find(f => f.name === selectedFunction);
    if (!functionDef) {
      notification.error("Function not found in ABI");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Check if we need to switch networks
      if (currentChainId !== targetNetwork.id) {
        notification.info(`Switching to ${targetNetwork.name} network...`);
        try {
          // Direct wallet provider call to switch chains
          if (walletProvider && walletProvider.request) {
            try {
              // First try to switch to the chain
              await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetNetwork.id.toString(16)}` }],
              });
              notification.success(`Switched to ${targetNetwork.name}!`);
            } catch (switchError: any) {
              // If the chain hasn't been added to the wallet yet, try to add it
              if (switchError.code === 4902 || 
                  switchError.message?.includes('wallet_addEthereumChain') ||
                  switchError.message?.includes('Unrecognized chain ID')) {
                try {
                  // Find the chain details from viem
                  const viemChain = Object.values(viemChains).find(
                    (chain) => typeof chain === 'object' && 
                              chain !== null && 
                              'id' in chain && 
                              chain.id === targetNetwork.id
                  );
                  
                  if (!viemChain || typeof viemChain !== 'object') {
                    throw new Error(`Chain with ID ${targetNetwork.id} not found in viem chains`);
                  }
                  
                  // Add the chain to the wallet
                  await walletProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: `0x${targetNetwork.id.toString(16)}`,
                      chainName: targetNetwork.name,
                      nativeCurrency: {
                        name: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.name : 'Ether',
                        symbol: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.symbol : 'ETH',
                        decimals: 'nativeCurrency' in viemChain && viemChain.nativeCurrency ? 
                          viemChain.nativeCurrency.decimals : 18
                      },
                      rpcUrls: 'rpcUrls' in viemChain && 
                               viemChain.rpcUrls && 
                               'default' in viemChain.rpcUrls && 
                               'http' in viemChain.rpcUrls.default ? 
                                 viemChain.rpcUrls.default.http : 
                                 [`https://rpc.ankr.com/${targetNetwork.id}`],
                      blockExplorerUrls: 'blockExplorers' in viemChain && 
                                         viemChain.blockExplorers && 
                                         'default' in viemChain.blockExplorers ? 
                                           [viemChain.blockExplorers.default.url] : 
                                           ['https://etherscan.io']
                    }]
                  });
                  
                  notification.success(`Added and switched to ${targetNetwork.name}`);
                } catch (addError) {
                  console.error("Error adding chain to wallet:", addError);
                  notification.error(`Could not add ${targetNetwork.name} to your wallet`);
                  setIsLoading(false);
                  return;
                }
              } else {
                console.error("Error switching chain:", switchError);
                notification.error(`Could not switch to ${targetNetwork.name}`);
                setIsLoading(false);
                return;
              }
            }
          } else {
            throw new Error("Wallet provider not available or doesn't support network switching");
          }
        } catch (switchError) {
          console.error("Failed to switch network:", switchError);
          notification.error(`Failed to switch network: ${(switchError as Error).message}`);
          setIsLoading(false);
          return;
        }
      }
      
      // Create ethers provider and signer
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsLoading(false);
        return;
      }
      
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      
      // Prepare function arguments
      const args = functionDef.inputs.map((input: any) => {
        const value = functionInputs[input.name || `param${input.position}`];
        
        // Handle different input types
        if (input.type.includes('int')) {
          // For integer types, check if it needs to be converted to wei
          if (input.name?.toLowerCase().includes('amount') || 
              input.name?.toLowerCase().includes('value') || 
              input.name?.toLowerCase().includes('price')) {
            try { 
              return parseEther(value || '0');
            } catch (error) {
              // If parseEther fails, try to use the value as is
              return value ? BigInt(value) : BigInt(0);
            }
          }
          // Other integer values
          return value ? BigInt(value) : BigInt(0);
        }
        
        // For addresses, ensure they're properly formatted
        if (input.type === 'address') {
          return value;
        }
        
        // For arrays
        if (input.type.includes('[]')) {
          try {
            // Try to parse as JSON
            return JSON.parse(value || '[]');
          } catch {
            // If not valid JSON, split by comma
            return value ? value.split(',').map(item => item.trim()) : [];
          }
        }
        
        // For booleans
        if (input.type === 'bool') {
          return value?.toLowerCase() === 'true';
        }
        
        // Default case
        return value;
      });
      
      try {
        // Create contract interface
        const contract = new ethers.Contract(contractData.address, contractData.abi, isReadOnly ? provider : signer);
        
        if (isReadOnly) {
          // For read-only functions
          notification.info(`Reading from ${selectedFunction}...`);
          
          const result = await contract[selectedFunction](...args);
          console.log("Read result:", result);
          
          // Format the result for display
          let formattedResult;
          if (typeof result === 'bigint') {
            // Check if this could be an amount in wei that should be formatted as ether
            formattedResult = `${result.toString()} (${formatEther(result)} ETH)`;
          } else if (Array.isArray(result)) {
            formattedResult = JSON.stringify(result, (key, value) => 
              typeof value === 'bigint' ? value.toString() : value, 2);
          } else if (typeof result === 'object' && result !== null) {
            formattedResult = JSON.stringify(result, (key, value) => 
              typeof value === 'bigint' ? value.toString() : value, 2);
          } else {
            formattedResult = String(result);
          }
          
          setFunctionResult(formattedResult);
          notification.success(`Read from ${selectedFunction} completed!`);
        } else {
          // For write functions
          notification.info(`Executing ${selectedFunction}...`);
          
          // Check if function is payable and add value if needed
          const isParsedValue = txValue && txValue !== '0';
          const overrides = isParsedValue ? { value: parseEther(txValue) } : {};
          
          const tx = await contract[selectedFunction](...args, overrides);
          
          notification.success(`Transaction sent: ${tx.hash}`);
          console.log("Transaction:", tx.hash);
          
          setFunctionResult(`Transaction hash: ${tx.hash}`);
          
          // Wait for transaction
          notification.info("Waiting for transaction confirmation...");
          const receipt = await tx.wait();
          
          notification.success(`Transaction confirmed in block ${receipt.blockNumber}!`);
          setFunctionResult(prev => `${prev}\nTransaction confirmed in block ${receipt.blockNumber}`);
        }
      } catch (contractError) {
        console.error(`Contract interaction failed:`, contractError);
        notification.error(`Contract error: ${(contractError as Error).message}`);
        setFunctionResult(`Error: ${(contractError as Error).message}`);
      }
    } catch (error) {
      console.error(`Function invocation failed:`, error);
      notification.error(`Error: ${(error as Error).message}`);
      setFunctionResult(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Group functions by type (read vs. write)
  const readFunctions = availableFunctions.filter(f => 
    f.stateMutability === 'view' || f.stateMutability === 'pure');
  
  const writeFunctions = availableFunctions.filter(f => 
    f.stateMutability !== 'view' && f.stateMutability !== 'pure');

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Contract Interface
        </h2>
        <p className="text-md text-gray-300 mt-2">
          {contractInfo.name ? contractInfo.name : "Interact with smart contracts"}
          {contractInfo.symbol ? ` (${contractInfo.symbol})` : ""}
        </p>
        {contractData?.address && (
          <p className="text-sm text-gray-400 mt-1">
            {contractData.address}
          </p>
        )}
      </div>

      {/* Function selection */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Function Type
          </label>
          <div className="flex justify-between mb-4">
            <button
              onClick={() => setIsReadOnly(true)}
              className={`flex-1 py-2 rounded-l-lg ${
                isReadOnly
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Read Functions
            </button>
            <button
              onClick={() => setIsReadOnly(false)}
              className={`flex-1 py-2 rounded-r-lg ${
                !isReadOnly
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Write Functions
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Function
          </label>
          <select
            value={selectedFunction}
            onChange={(e) => setSelectedFunction(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a function</option>
            {isReadOnly
              ? readFunctions.map(fn => (
                  <option key={fn.name} value={fn.name}>
                    {fn.name}
                  </option>
                ))
              : writeFunctions.map(fn => (
                  <option key={fn.name} value={fn.name}>
                    {fn.name} {fn.stateMutability === 'payable' ? '(payable)' : ''}
                  </option>
                ))
            }
          </select>
        </div>
        
        {selectedFunction && (
          <>
            {/* Function Inputs */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Function Parameters
              </label>
              {availableFunctions.find(f => f.name === selectedFunction)?.inputs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">This function has no parameters</p>
              ) : (
                availableFunctions.find(f => f.name === selectedFunction)?.inputs.map((input: any, index: number) => (
                  <div key={index} className="mb-2">
                    <label className="block text-xs text-gray-400 mb-1">
                      {input.name || `Parameter ${index + 1}`} ({input.type})
                    </label>
                    <input
                      type="text"
                      value={functionInputs[input.name || `param${input.position}`] || ''}
                      onChange={(e) => handleInputChange(input.name || `param${input.position}`, e.target.value)}
                      placeholder={`Enter ${input.type} value`}
                      className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))
              )}
            </div>
            
            {/* Value input for payable functions */}
            {!isReadOnly && 
             availableFunctions.find(f => f.name === selectedFunction)?.stateMutability === 'payable' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Transaction Value (ETH)
                </label>
                <input
                  type="text"
                  value={txValue}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="0.0"
                  className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            
            {/* Invoke Button */}
            <button
              onClick={handleInvoke}
              disabled={!selectedFunction || isLoading}
              className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
                ${(!selectedFunction || isLoading)
                  ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                } font-medium text-sm`}
            >
              <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                {isReadOnly ? `Call ${selectedFunction}` : `Execute ${selectedFunction}`}
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
          </>
        )}
      </div>
      
      {/* Function Result */}
      {functionResult && (
        <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <h3 className="font-bold mb-2">Result</h3>
          <pre className="whitespace-pre-wrap overflow-x-auto">
            {functionResult}
          </pre>
        </div>
      )}
      
      {/* Information Card */}
      <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
        <h3 className="font-bold mb-2">Contract Information</h3>
        <p className="text-sm mb-2">
          This interface allows you to interact with any smart contract by calling its functions and viewing the results.
        </p>
        <ul className="list-disc list-inside text-sm">
          <li className="mb-1">Select between Read and Write functions</li>
          <li className="mb-1">Choose a specific function and provide parameters</li>
          <li className="mb-1">For payable functions, specify the amount of ETH to send</li>
        </ul>
      </div>
    </div>
  );
} 