"use client";

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Link from "next/link";
import type { NextPage } from "next";
import { PencilIcon, TableCellsIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import Select, { SingleValue } from 'react-select';
import * as viemChains from 'viem/chains';
import { isAddress } from 'viem';
import { setContracts } from '@/utils/scaffold-eth/contract';
import scaffoldConfig from '@/scaffold.config';
import { Chain } from 'viem/chains';
import { Address } from "viem";
import { GenericContractsDeclaration } from "@/utils/scaffold-eth/contract";
import { useRouter } from 'next/navigation';
import { useContractStore } from "@/utils/scaffold-eth/contract";
import { setTargetNetwork } from "@/utils/scaffold-eth/networks";
import { getAllContracts } from "@/utils/scaffold-eth/contractsData";
import { notification } from "@/utils/scaffold-eth/notification";
import dynamic from 'next/dynamic';
import { ethers } from "ethers";
import { useBatchStore } from "../utils/batch";
import { BatchPanel } from "../utils/batch";
import { TransactionPreview } from "../utils/foundry/TransactionPreview";

// Lazy load contract interfaces
const ERC20Interface = dynamic(() => import('./erc20/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading ERC20 interface...</div>
});

const NFTInterface = dynamic(() => import('./nft/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading NFT interface...</div>
});

const WrapInterface = dynamic(() => import('./wrap/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading interface...</div>
});

const BridgeInterface = dynamic(() => import('./bridge/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading interface...</div>
});

const LiquidityInterface = dynamic(() => import('./liquidity/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading interface...</div>
});

const SwapInterface = dynamic(() => import('./swap/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading interface...</div>
});

const ReadWriteInterface = dynamic(() => import('./readwrite/interface').then(mod => mod.default || mod), { 
  ssr: false,
  loading: () => <div>Loading interface...</div>
});

// Define the chain names type from viem/chains
type ChainName = keyof typeof viemChains;

// Define the ChainOption interface
interface ChainOption {
  value: ChainName;
  label: string;
}

// Define ABI function type for table view
interface ABIFunction {
  type: string;
  name: string;
  inputs: { type: string; name: string }[];
  outputs?: { type: string; name: string }[];
  stateMutability?: string;
}

// Define the batch operation interface
interface BatchOperation {
  type: string;
  interfaceType: 'erc20' | 'nft' | 'wrap' | 'bridge' | 'liquidity' | 'swap' | 'readwrite';
  to: string;
  data: string;
  value: string;
  description: string;
}

const Home: NextPage = () => {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [abi, setAbi] = useState('');
  const [formattedAbi, setFormattedAbi] = useState('');
  const [isAddressEmpty, setIsAddressEmpty] = useState(true);
  const [isAddressTooShort, setIsAddressTooShort] = useState(false);
  const [isAbiInvalid, setIsAbiInvalid] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<ChainOption>({ 
    value: 'mainnet' as ChainName, 
    label: 'mainnet' 
  });
  const [isContractLoaded, setIsContractLoaded] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [isValidAbi, setIsValidAbi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [parsedAbi, setParsedAbi] = useState<any[]>([]);
  const [showTutorial, setShowTutorial] = useState(true);
  const [contractInterface, setContractInterface] = useState<string | null>(null);
  
  // Batch functionality
  const { addOperation, removeOperation, clearOperations, operations, isLoading: batchIsLoading, showPanel, togglePanel } = useBatchStore();

  // Add state for transaction preview
  const [showTransactionPreview, setShowTransactionPreview] = useState(false);

  // Get all chain information
  const chainInfo = useMemo(() => {
    const chains = Object.entries(viemChains)
      .filter(([name, chain]) => 
        typeof chain === 'object' && 
        'id' in chain && 
        'name' in chain
      )
      .map(([name, chain]) => ({
        name,
        id: chain.id,
        displayName: chain.name,
      }));

    console.log("Available Chains:", chains);
    
    // Create a mapping of chain IDs to names
    const chainIdToName = Object.fromEntries(
      chains.map(chain => [chain.id, chain.name])
    );
    console.log("Chain ID to Name mapping:", chainIdToName);

    return {
      chains,
      chainIdToName,
    };
  }, []);

  const options: ChainOption[] = Object.keys(viemChains).map(chain => ({ 
    value: chain as ChainName, 
    label: chain 
  }));

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setAddress(newAddress);
    setIsAddressEmpty(!newAddress);
    setIsAddressTooShort(newAddress.length < 42);
    setIsValidAddress(isAddress(newAddress));
  };

  const handleAbiChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAbi = e.target.value;
    setAbi(newAbi);
    try {
      const parsed = JSON.parse(newAbi);
      setParsedAbi(parsed);
      setIsAbiInvalid(false);
      setIsValidAbi(true);
      
      // Format the ABI with proper indentation for display
      setFormattedAbi(JSON.stringify(parsed, null, 2));
    } catch (error) {
      setIsAbiInvalid(true);
      setIsValidAbi(false);
      setFormattedAbi(newAbi);
    }
  };

  // Format ABI on initial load
  useEffect(() => {
    if (abi) {
      try {
        const parsed = JSON.parse(abi);
        setFormattedAbi(JSON.stringify(parsed, null, 2));
      } catch (error) {
        setFormattedAbi(abi);
      }
    }
  }, []);

  const handleNetworkChange = (selected: SingleValue<ChainOption>) => {
    if (selected) {
      setSelectedNetwork(selected);
      const newNetwork = (viemChains as any)[selected.value];
      setTargetNetwork(newNetwork);
    }
  };

  const isERC20Contract = (abi: any[]) => {
    const requiredMethods = [
      'transfer',
      'balanceOf',
      'totalSupply',
      'approve',
      'allowance'
    ];
    
    const abiMethods = abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    return requiredMethods.every(method => 
      abiMethods.includes(method)
    );
  };

  const isERC721Contract = (abi: any[]) => {
    const requiredMethods = [
      'balanceOf',
      'ownerOf',
      'transferFrom',
      'approve',
      'setApprovalForAll'
    ];
    
    const abiMethods = abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    return requiredMethods.every(method => 
      abiMethods.includes(method)
    );
  };

  const isBridgeContract = (abi: any[]) => {
    // Check for common bridge functions and events
    const bridgeIndicators = [
      'depositV3',
      'deposit',
      'relayMessage',
      'relayTokens',
      'l2GasPrice',
      'l1Inbox',
      'MessageRelayed',
      'TokensRelayed',
      'FundsDeposited',
      'FilledRelay'
    ];
    
    const abiElements = abi.map(item => 
      item.type === 'function' || item.type === 'event' ? item.name : ''
    );
    
    // If the ABI contains several of these indicators, it's likely a bridge
    const matchCount = bridgeIndicators.filter(indicator => 
      abiElements.includes(indicator)
    ).length;

    // Consider it a bridge if it matches 2 or more indicators
    return matchCount >= 2;
  };

  // Add this function to detect wrappable tokens
  const isWrappableToken = (abi: any[]): boolean => {
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

    return isWETH || isWstETH;
  };

  // Add this function to detect liquidity pool contracts
  const isLiquidityPoolContract = (abi: any[]): boolean => {
    // Check for key Uniswap V4 functions that indicate a liquidity pool manager
    
    // Check for pool manager singleton contract first - if it matches, don't classify it as liquidity pool
    const isPoolManagerSingleton = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'unlock'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'settle'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'collectProtocolFees'
    );
    
    // If this is the pool manager singleton contract, return false to prevent identifying it as a liquidity pool
    if (isPoolManagerSingleton) {
      console.log("Detected Uniswap V4 Pool Manager singleton contract");
      return false;
    }
    
    // Check for initialize function with PoolKey tuple
    const hasInitialize = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'initialize' &&
        item.inputs?.length >= 1 &&
        item.inputs.some((input: any) => 
          input.type === 'tuple' && 
          input.components?.some((comp: any) => 
            comp.name === 'currency0' || 
            comp.name === 'currency1' ||
            comp.name === 'fee' ||
            comp.name === 'tickSpacing'
          )
        )
    );
    
    // Check for modifyLiquidity function
    const hasModifyLiquidity = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'modifyLiquidity'
    );
    
    // Check for swap function
    const hasSwap = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'swap'
    );
    
    // Check for key events
    const hasPoolEvents = abi.some(
      (item: any) =>
        item.type === 'event' &&
        (item.name === 'Initialize' ||
         item.name === 'ModifyLiquidity' ||
         item.name === 'Swap')
    );
    
    // Require at least initialize, modifyLiquidity and either swap or events
    return hasInitialize && hasModifyLiquidity && (hasSwap || hasPoolEvents);
  };

  // Add this function to detect Uniswap V4 Position Manager contract
  const isPositionManagerContract = (abi: any[]): boolean => {
    // Check for key functions that indicate a position manager
    const hasMulticall = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'multicall'
    );
    
    // Check for mint or settleAndMint function, which is a key indicator of a Position Manager
    const hasMint = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'mint' &&
        item.inputs?.some((input: any) => 
          input.type === 'tuple' && 
          input.components?.some((comp: any) => 
            comp.name === 'currency0' || 
            comp.name === 'currency1'
          )
        )
    );
    
    const hasSettleAndMint = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'settleAndMint'
    );
    
    // Check for any other position manager indicators
    const hasSettle = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'settle'
    );
    
    const hasModifyLiquidities = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'modifyLiquidities'
    );
    
    const hasAddLiquidity = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'addLiquidity'
    );
    
    const hasRemoveLiquidity = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'removeLiquidity'
    );
    
    // Contract name check (if available)
    const contractNameMatch = abi.some(
      (item: any) =>
        item.name === 'PositionManager' ||
        (typeof item.name === 'string' && item.name.includes('PositionManager'))
    );
    
    console.log("Position Manager detection:", {
      hasMulticall,
      hasMint,
      hasSettleAndMint,
      hasSettle,
      hasModifyLiquidities,
      hasAddLiquidity,
      hasRemoveLiquidity,
      contractNameMatch
    });
    
    // Require multicall and at least one of the other functions
    const isLikelyPositionManager = hasMulticall && (
      hasMint || 
      hasSettleAndMint || 
      hasSettle || 
      hasModifyLiquidities || 
      hasAddLiquidity || 
      hasRemoveLiquidity ||
      contractNameMatch
    );
    
    return isLikelyPositionManager;
  };

  const isUniversalRouter = (abi: any[]) => {
    // Universal Router has execute() function with commands bytes parameter
    const hasExecuteWithCommands = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'execute' &&
        item.inputs?.length >= 1 &&
        item.inputs[0]?.type === 'bytes'
    );
    
    // Additional check for poolManager function
    const hasPoolManagerFunction = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'poolManager'
    );
    
    // Additional check for key router error types
    const hasRouterErrors = abi.some(
      (item: any) => 
        item.type === 'error' && 
        (item.name === 'InvalidCommandType' || 
         item.name === 'V3InvalidSwap' || 
         item.name === 'V4TooLittleReceived')
    );
    
    return hasExecuteWithCommands && (hasPoolManagerFunction || hasRouterErrors);
  };

  const handleReadWrite = async () => {
    if (!address) {
      setIsAddressEmpty(true);
      return;
    }

    setIsLoading(true);

    let parsedAbi;
    try {
      parsedAbi = JSON.parse(abi);
    } catch (error) {
      console.error('Invalid ABI:', error);
      setIsAbiInvalid(true);
      setIsLoading(false);
      return;
    }

    const formattedAddress = address as `0x${string}`;
    
    try {
      // Check contract type
      const isRouter = isUniversalRouter(parsedAbi);
      console.log("Universal Router detection result:", isRouter);
      
      const isPoolManagerSingleton = parsedAbi.some(
        (item: any) => 
          item.type === 'function' && 
          item.name === 'unlock'
      ) && parsedAbi.some(
        (item: any) => 
          item.type === 'function' && 
          item.name === 'settle'
      ) && parsedAbi.some(
        (item: any) => 
          item.type === 'function' && 
          item.name === 'collectProtocolFees'
      );

      const isBridge = isBridgeContract(parsedAbi);
      const isWrappable = isWrappableToken(parsedAbi);
      const isERC20 = isERC20Contract(parsedAbi);
      const isERC721 = isERC721Contract(parsedAbi);
      const isLiquidityPool = isLiquidityPoolContract(parsedAbi);
      const isPositionManager = isPositionManagerContract(parsedAbi);

      // Get the network ID from the selected network
      const selectedChain = (viemChains as any)[selectedNetwork.value];
      if (!selectedChain || !selectedChain.id) {
        throw new Error(`Invalid network selected: ${selectedNetwork.value}`);
      }
      const networkId = selectedChain.id;
      
      // Set the target network
      setTargetNetwork(selectedChain);
      
      // Get current contracts state
      const currentContracts = useContractStore.getState().contracts;
      console.log("Current contracts:", currentContracts);
      
      // Create a fresh contracts object to ensure updates trigger state changes
      const mergedContracts: GenericContractsDeclaration = {};
      
      // Add all networks from current contracts 
      Object.keys(currentContracts).forEach(chainIdStr => {
        const chainId = Number(chainIdStr);
        // Create a new object for each network to avoid reference issues
        mergedContracts[chainId] = { ...currentContracts[chainId] };
      });
      
      // Make sure the network exists in our contracts object
      if (!mergedContracts[networkId]) {
        mergedContracts[networkId] = {};
      }
      
      // Update with the new contract
      if (isRouter) {
        console.log(`Adding UniversalRouter to network ${networkId} at ${formattedAddress}`);
        
        // Create a new network object to avoid reference issues
        mergedContracts[networkId] = { 
          ...mergedContracts[networkId],
          "UniversalRouter": {
            address: formattedAddress,
            abi: parsedAbi,
            inheritedFunctions: {}
          }
        };
      } else if (isLiquidityPool) {
        mergedContracts[networkId] = {
          ...mergedContracts[networkId],
          "LiquidityPoolManager": {
            address: formattedAddress,
            abi: parsedAbi,
            inheritedFunctions: {}
          }
        };
      } else if (isPositionManager) {
        mergedContracts[networkId] = {
          ...mergedContracts[networkId], 
          "PositionManager": {
            address: formattedAddress,
            abi: parsedAbi,
            inheritedFunctions: {}
          }
        };
      } else {
        mergedContracts[networkId] = {
          ...mergedContracts[networkId],
          "YourContract": {
            address: formattedAddress,
            abi: parsedAbi,
            inheritedFunctions: {}
          }
        };
      }
      
      // Set the merged contracts in the store
      console.log("Setting contracts:", mergedContracts);
      await setContracts(mergedContracts);
      
      // Debug information
      console.log("Contract detection results:", {
        isRouter,
        isLiquidityPool,
        isPositionManager,
        networkId,
        contractKey: isRouter ? "UniversalRouter" :
                    isLiquidityPool ? "LiquidityPoolManager" : 
                    isPositionManager ? "PositionManager" : 
                    "YourContract",
      });
      
      // Wait a bit to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify the contract was added correctly
      const updatedContracts = useContractStore.getState().contracts;
      console.log("Updated contracts:", updatedContracts);
      console.log(`Checking for ${networkId}.UniversalRouter:`, 
        updatedContracts[networkId]?.UniversalRouter ? "Found" : "Not found");
      
      // Set up the appropriate interface
      setIsContractLoaded(true);
      setShowTableView(true);
      setShowTutorial(false);

      // Set the appropriate interface based on contract type
      if (isRouter) {
        setContractInterface('swap');
        notification.success("Universal Router contract detected!");
      } else if (isLiquidityPool || isPositionManager) {
        setContractInterface('liquidity');
        notification.success(isLiquidityPool ? 
          "Liquidity pool contract detected!" : 
          "Position manager contract detected!");
      } else if (isPoolManagerSingleton) {
        setContractInterface('swap');
        notification.success("Pool Manager contract detected!");
      } else if (isWrappable) {
        setContractInterface('wrap');
        notification.success("Wrapped token contract detected!");
      } else if (isBridge) {
        setContractInterface('bridge');
        notification.success("Bridge contract detected!");
      } else if (isERC20) {
        setContractInterface('erc20');
        notification.success("ERC20 token contract detected!");
      } else if (isERC721) {
        setContractInterface('nft');
        notification.success("NFT contract detected!");
      } else {
        setContractInterface('readwrite');
        notification.success("Contract loaded successfully!");
      }

    } catch (error) {
      console.error('Error:', error);
      notification.error('Error setting contract: ' + (error as Error).message);
      setContractInterface(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to render syntax highlighted JSON
  const renderSyntaxHighlightedJson = (json: string) => {
    if (!json) return '';
    
    // Simple syntax highlighting
    return json
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'text-blue-400'; // strings
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-purple-400'; // keys
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-green-400'; // booleans
        } else if (/null/.test(match)) {
          cls = 'text-red-400'; // null
        } else {
          cls = 'text-yellow-400'; // numbers
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/[{}\[\]]/g, (match) => {
        return `<span class="text-gray-300">${match}</span>`;
      })
      .replace(/,/g, '<span class="text-gray-300">,</span>');
  };

  console.log("Chain Names:", chainInfo.chains.map(c => c.name));
  console.log("Chain IDs:", chainInfo.chains.map(c => c.id));

  const addToBatch = (operation: BatchOperation) => {
    // Cast the operation to match the expected type
    const typedOperation = {
      ...operation,
      type: operation.type as 'transfer' | 'approve' | 'call' | 'payable_call',
      interfaceType: operation.interfaceType as 'erc20' | 'erc721' | 'universalRouter' | 'bridge' | 'liquidityPool' | 'positionManager' | 'wrappableToken' | 'readwrite'
    };
    
    addOperation(typedOperation);
    notification.success(`Added operation to batch`);
  };

  const removeFromBatch = (index: number) => {
    removeOperation(index);
    notification.info(`Removed operation from batch`);
  };

  const clearBatch = () => {
    clearOperations();
    notification.info(`Cleared all batch operations`);
  };

  const executeBatch = async () => {
    if (operations.length === 0) {
      notification.info("No operations in batch");
      return;
    }

    // Show transaction preview
    setShowTransactionPreview(true);
  };

  // Function to handle the actual execution after confirmation
  const handleExecuteBatch = async () => {
    setIsLoading(true);
    setShowTransactionPreview(false);
    
    try {
      // We'll rely on the execution logic inside useBatchStore
      await useBatchStore.getState().executeBatch();
    } catch (error) {
      console.error("Batch execution failed:", error);
      notification.error(`Batch execution failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center py-10">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Interact with</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            EVM Smart Contract
          </span>
        </h1>
        <p className="text-lg text-gray-300">
          Input your{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            smart contract address
          </code>{" "}
          and the designated{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            abi(application binary interface)
          </code>
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-grow px-4 pb-10 gap-6">
        {/* Left Column - Contract Input Form */}
        <div className="md:w-1/2">
          <div className="w-full mb-4">
        <label htmlFor="networkSelector" className="block text-sm font-medium text-gray-300 mb-2">
          Select Network:
        </label>
        <Select
          id="networkSelector"
          value={selectedNetwork}
          options={options}
          onChange={handleNetworkChange}
          styles={{
            control: (base) => ({
              ...base,
              backgroundColor: '#1f2937',
              borderColor: '#374151',
              color: '#fff',
              boxShadow: 'none',
              '&:hover': {
                borderColor: '#4b5563'
              }
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: '#1f2937',
              border: '1px solid #374151'
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isFocused ? '#374151' : '#1f2937',
              color: '#fff',
              '&:hover': {
                backgroundColor: '#374151'
              }
            }),
            singleValue: (base) => ({
              ...base,
              color: '#fff'
            }),
            input: (base) => ({
              ...base,
              color: '#fff'
            })
          }}
          className="mt-1"
        />
      </div>

      <input
        type="text"
        value={address}
        onChange={handleAddressChange}
        placeholder="Enter Smart Contract Address"
            className={`w-full my-4 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
          ${!isValidAddress ? 'border-red-500' : 'border-gray-700'}
          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
          ${!isValidAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
      />

          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="abiInput" className="block text-sm font-medium text-gray-300">
                Contract ABI (JSON format):
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => { setShowTableView(false); setShowTutorial(true); }}
                  className={`p-1.5 rounded-md ${!showTableView ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="JSON View"
                >
                  <CodeBracketIcon className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => { 
                    if (parsedAbi.length > 0) {
                      setShowTableView(true); 
                      setShowTutorial(false); 
                    }
                  }}
                  className={`p-1.5 rounded-md ${showTableView ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="Table View"
                >
                  <TableCellsIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

      <textarea
              id="abiInput"
        value={abi}
        onChange={handleAbiChange}
        placeholder="Enter Contract ABI (JSON format)"
              className={`w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
          ${!isValidAbi ? 'border-red-500' : 'border-gray-700'}
          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
          ${!isValidAbi ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        rows={8}
              style={{ fontFamily: 'monospace' }}
            />
            
            {isAbiInvalid && (
              <p className="mt-1 text-sm text-red-500">
                Invalid JSON format. Please check your ABI.
              </p>
            )}
          </div>

      <button
        onClick={handleReadWrite}
        disabled={!isValidAddress || !isValidAbi || !address || !abi || isLoading}
            className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative mb-4
          ${(!isValidAddress || !isValidAbi || !address || !abi || isLoading)
            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
          } font-medium`}
      >
        <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          Load Contract
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
          
          {/* ABI Table View */}
          {showTableView && parsedAbi.length > 0 && (
            <div className="border border-gray-700 rounded-xl bg-gray-800/50 backdrop-blur-sm overflow-auto max-h-[500px] mb-4">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Inputs</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Outputs</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">State Mutability</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                  {parsedAbi.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-700/50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-400">{item.type}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-purple-400">{item.name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        {item.inputs?.map((input: any, i: number) => (
                          <div key={i} className="mb-1">
                            <span className="text-yellow-400">{input.type}</span>
                            {input.name && <span className="text-gray-400"> {input.name}</span>}
                          </div>
                        )) || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        {item.outputs?.map((output: any, i: number) => (
                          <div key={i} className="mb-1">
                            <span className="text-green-400">{output.type}</span>
                            {output.name && <span className="text-gray-400"> {output.name}</span>}
                          </div>
                        )) || '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.stateMutability ? (
                          <span className={`
                            ${item.stateMutability === 'view' || item.stateMutability === 'pure' ? 'text-blue-400' : ''}
                            ${item.stateMutability === 'nonpayable' ? 'text-yellow-400' : ''}
                            ${item.stateMutability === 'payable' ? 'text-red-400' : ''}
                          `}>
                            {item.stateMutability}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column - Interface */}
        <div className="md:w-1/2">
          <div className="border border-gray-700 rounded-xl bg-gray-800/50 backdrop-blur-sm p-4">
            {/* Tutorial Section */}
            {showTutorial && (
              <div className="prose prose-sm max-w-none prose-invert">
                <h3 className="text-xl font-bold text-blue-400 mb-4">How to Use</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Enter a valid Ethereum contract address.</li>
                  <li>Paste the contract ABI in JSON format.</li>
                  <li>Click "Load Contract" to analyze and interact with the contract.</li>
                  <li>The app will detect the contract type and show the appropriate interface.</li>
                  <li>For any contract, you can use the Read/Write interface to access all functions.</li>
                </ol>

                <h4 className="text-lg font-bold text-blue-400 mt-6 mb-3">Batch Operations</h4>
                <p>
                  Pure Contracts allows you to queue multiple operations and execute them in a single batch:
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Add operations to your batch using the "Add to Batch" buttons.</li>
                  <li>Review and manage your batch in the batch panel.</li>
                  <li>Execute all operations in sequence with a single click.</li>
                  <li>If an operation fails, you'll have the option to continue or stop.</li>
                </ol>

                <h4 className="text-lg font-bold text-blue-400 mt-6 mb-3">Contract Types</h4>
                <p>
                  The app automatically detects different contract types:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><span className="font-semibold text-blue-400">ERC20 Tokens:</span> Transfer, approve, check balances.</li>
                  <li><span className="font-semibold text-blue-400">ERC721 NFTs:</span> View, transfer, and manage NFTs.</li>
                  <li><span className="font-semibold text-blue-400">Universal Router:</span> Interact with advanced router contracts.</li>
                  <li><span className="font-semibold text-blue-400">Bridges:</span> Cross-chain bridging operations.</li>
                  <li><span className="font-semibold text-blue-400">Liquidity Pools:</span> Manage liquidity positions.</li>
                  <li><span className="font-semibold text-blue-400">Position Managers:</span> Manage NFT positions.</li>
                  <li><span className="font-semibold text-blue-400">Wrappable Tokens:</span> Wrap and unwrap tokens.</li>
                </ul>
              </div>
            )}

            {/* Render the selected interface */}
            {!showTutorial && (
              <>
                {contractInterface === 'erc20' && (
                  <ERC20Interface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'nft' && (
                  <NFTInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'wrap' && (
                  <WrapInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'bridge' && (
                  <BridgeInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'liquidity' && (
                  <LiquidityInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'swap' && (
                  <SwapInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
                {contractInterface === 'readwrite' && (
                  <ReadWriteInterface 
                    contractAddress={address} 
                    abi={parsedAbi} 
                    chainId={selectedNetwork ? parseInt(selectedNetwork.value) : undefined} 
                    addToBatch={addToBatch} 
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Optional: Add a loading overlay for the entire page */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl shadow-xl border border-gray-800">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-white">Loading Contract Interface...</p>
            </div>
          </div>
        </div>
      )}

      <BatchPanel />

      {/* Add the transaction preview component */}
      <TransactionPreview
        operations={operations}
        isOpen={showTransactionPreview}
        onClose={() => setShowTransactionPreview(false)}
        onConfirm={handleExecuteBatch}
        isLoading={isLoading}
      />
    </div>
  );
};

export default Home;