"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, encodeFunctionData, Address } from 'viem';
import * as viemChains from 'viem/chains';
import { ethers } from 'ethers';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { setContracts } from '../../../utils/scaffold-eth/contract';
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
import type { AppKitNetwork } from '@reown/appkit/networks';

// Initialize AppKit at module level
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in Liquidity Pool interface...');
    // Project metadata
    const metadata = {
      name: 'WrapTX Liquidity',
      description: 'Create and manage liquidity pools',
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
    console.log('AppKit initialized in Liquidity Pool interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

// UniswapV4 constants
const EMPTY_BYTES = '0x';
const EMPTY_HOOK = '0x0000000000000000000000000000000000000000';
const FeeAmount = {
  LOWEST: 100,   // 0.01%
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000    // 1%
};

const TICK_SPACINGS = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200
};

// Add this constant at the top with other constants
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'; // ADDRESS_ZERO for native token (ETH)

// Add these constants at the top with the other constants
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'; // Standard Permit2 contract address

// Position Manager ABI - just the functions we need
const V4_POSITION_MANAGER_ABI = [
  {
    "inputs": [{"internalType": "bytes[]", "name": "data", "type": "bytes[]"}],
    "name": "multicall",
    "outputs": [{"internalType": "bytes[]", "name": "results", "type": "bytes[]"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes", "name": "data", "type": "bytes"},
      {"internalType": "uint256", "name": "deadline", "type": "uint256"}
    ],
    "name": "modifyLiquidities",
    "outputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "currency0", "type": "address"},
          {"internalType": "address", "name": "currency1", "type": "address"},
          {"internalType": "uint24", "name": "fee", "type": "uint24"},
          {"internalType": "int24", "name": "tickSpacing", "type": "int24"},
          {"internalType": "address", "name": "hooks", "type": "address"}
        ],
        "internalType": "struct IPoolManager.PoolKey",
        "name": "key",
        "type": "tuple"
      },
      {"internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"}
    ],
    "name": "initializePool",
    "outputs": [{"internalType": "int24", "name": "tick", "type": "int24"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Helper class to emulate the Multicall functionality from the Uniswap SDK
class Multicall {
  static encodeMulticall(calldataList: string[]): string {
    // No need to pad to 42 elements - this is causing our problems
    console.log(`Creating multicall for ${calldataList.length} elements`);
    
    // Create a new Interface for the multicall function
    const multicallInterface = new ethers.Interface([
      "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)"
    ]);
    
    // We only need the actual elements we want to call, not empty placeholders
    console.log(`Using direct interface encoding instead of padding to 42 elements`);
    
    // Directly encode the function call with the actual calldata list
    const encodedCalldata = multicallInterface.encodeFunctionData("multicall", [calldataList]);
    
    // Log information about the encoded calldata
    console.log(`Final multicall calldata length: ${encodedCalldata.length / 2 - 1} bytes`);
    console.log(`Multicall selector: ${encodedCalldata.substring(0, 10)}`);
    
    // Add hexdump for debugging the first 16 chunks
    console.log("\n===== CALLDATA HEX DUMP =====");
    console.log(`Selector: ${encodedCalldata.substring(0, 10)}`);
    
    const maxChunks = 16;
    for (let i = 0; i < maxChunks && i * 64 + 10 < encodedCalldata.length; i++) {
      const startPos = i * 64 + 10;
      const chunk = encodedCalldata.substring(startPos, startPos + 64);
      console.log(`[${i}]: ${chunk}`);
    }
    console.log("===== END CALLDATA DUMP =====\n");
    
    return encodedCalldata;
  }
}

// Helper class for Position Manager actions
class Actions {
  static readonly MINT_POSITION = 0x02;
  static readonly SETTLE_PAIR = 0x0D;
  static readonly BURN_POSITION = 0x03;
  static readonly SWEEP = 0x0C;
}

// V4 Position Manager helper class similar to the SDK
class V4PositionManager {
  static readonly INTERFACE = new ethers.Interface(V4_POSITION_MANAGER_ABI);
  
  // Encode initializePool
  static encodeInitializePool(poolKey: any, sqrtPriceX96: string): string {
    // Ensure addresses in poolKey are valid
    const validatedPoolKey = {
      currency0: ensureValidAddress(poolKey.currency0),
      currency1: ensureValidAddress(poolKey.currency1),
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: ensureValidAddress(poolKey.hooks)
    };
    
    return V4PositionManager.INTERFACE.encodeFunctionData('initializePool', [
      validatedPoolKey,
      sqrtPriceX96
    ]);
  }
  
  // Encode modifyLiquidities
  static encodeModifyLiquidities(data: string, deadline: number): string {
    return V4PositionManager.INTERFACE.encodeFunctionData('modifyLiquidities', [
      data,
      deadline
    ]);
  }
}

// Helper function to ensure valid addresses
function ensureValidAddress(address: string): string {
  // Special case for native token (0x0)
  if (address === NATIVE_TOKEN_ADDRESS || address === '0x0' || address === '0x') {
    return NATIVE_TOKEN_ADDRESS;
  }
  
  // Ensure it's a valid address
  if (!ethers.isAddress(address)) {
    console.warn(`Invalid address detected: ${address}, using empty hook address instead`);
    return EMPTY_HOOK;
  }
  
  // Return properly checksummed address
  return ethers.getAddress(address);
}

// Helper class for planner
class V4PositionPlanner {
  private actions: number[] = [];
  private params: any[][] = [];
  
  addMint(
    poolKey: any,
    tickLower: number,
    tickUpper: number,
    liquidity: string | bigint,
    amount0Max: string,
    amount1Max: string,
    recipient: string,
    hookData: string = EMPTY_BYTES
  ): void {
    this.actions.push(Actions.MINT_POSITION);
    
    // Make sure poolKey properties are properly formatted
    const formattedPoolKey = {
      currency0: ensureValidAddress(poolKey.currency0),
      currency1: ensureValidAddress(poolKey.currency1),
      fee: parseInt(poolKey.fee.toString()),
      tickSpacing: parseInt(poolKey.tickSpacing.toString()),
      hooks: ensureValidAddress(poolKey.hooks)
    };
    
    // Convert numeric values to proper formats
    const liquidityValue = ethers.isHexString(liquidity) ? liquidity : ethers.parseUnits(liquidity.toString(), 0).toString();
    const amount0MaxValue = ethers.isHexString(amount0Max) ? amount0Max : ethers.parseUnits(amount0Max.toString(), 0).toString();
    const amount1MaxValue = ethers.isHexString(amount1Max) ? amount1Max : ethers.parseUnits(amount1Max.toString(), 0).toString();
    
    console.log("Formatted parameters for addMint:");
    console.log("- tickLower:", tickLower);
    console.log("- tickUpper:", tickUpper);
    console.log("- liquidity:", liquidityValue);
    console.log("- amount0Max:", amount0MaxValue);
    console.log("- amount1Max:", amount1MaxValue);
    
    this.params.push([
      formattedPoolKey,
      tickLower,
      tickUpper,
      liquidityValue,
      amount0MaxValue,
      amount1MaxValue,
      recipient,
      hookData
    ]);
    return;
  }
  
  addSettlePair(currency0: string, currency1: string): void {
    // Special handling for native token (address zero)
    let safeCurrency0;
    if (currency0 === NATIVE_TOKEN_ADDRESS || currency0 === '0x0' || currency0 === '0x') {
      safeCurrency0 = NATIVE_TOKEN_ADDRESS;
    } else {
      safeCurrency0 = ethers.isAddress(currency0) ? ethers.getAddress(currency0) : EMPTY_HOOK;
    }
    
    let safeCurrency1;
    if (currency1 === NATIVE_TOKEN_ADDRESS || currency1 === '0x0' || currency1 === '0x') {
      safeCurrency1 = NATIVE_TOKEN_ADDRESS;
    } else {
      safeCurrency1 = ethers.isAddress(currency1) ? ethers.getAddress(currency1) : EMPTY_HOOK;
    }
    
    this.actions.push(Actions.SETTLE_PAIR);
    this.params.push([safeCurrency0, safeCurrency1]);
  }
  
  finalize(): string {
    try {
      // Encode actions as bytes
      console.log("Actions to encode: ", this.actions);
      const hexActions = this.actions.map(action => `0x${action.toString(16).padStart(2, '0')}`);
      console.log("Individual action bytes: ", hexActions);
      
      // Concatenate action bytes
      let actionsBytes = "0x";
      for (const hex of hexActions) {
        actionsBytes += hex.slice(2); // Remove '0x' prefix after the first one
      }
      console.log("Successfully concatenated actions bytes:", actionsBytes);
      
      // Verify actions are correctly formatted
      if (actionsBytes.length % 2 !== 0) {
        console.error("ERROR: Actions bytes are not properly aligned. Length:", actionsBytes.length);
        throw new Error("Actions bytes are not properly aligned");
      }
      
      console.log("Preparing to encode parameters...");
      // Encode parameters for each action
      const encodedParams: string[] = [];
      for (let i = 0; i < this.actions.length; i++) {
        const actionId = this.actions[i];
        const paramSet = this.params[i];
        
        // Get the parameter types for this action
        const types = getParamTypes(paramSet);
        console.log(`Encoding param set ${i} for action ${actionId} with types: `, types);
        console.log("Parameters: ", paramSet);
        
        try {
          // Encode the parameters
          const coder = ethers.AbiCoder.defaultAbiCoder();
          const encoded = coder.encode(types, paramSet);
          encodedParams.push(encoded);
        } catch (error) {
          console.error(`Failed to encode parameters for action ${actionId}:`, error);
          throw new Error(`Failed to encode parameters for action ${actionId}: ${error}`);
        }
      }
      console.log("Successfully encoded individual param sets");
      
      // Validate the actions and parameters before final encoding
      validateModifyLiquiditiesParams(actionsBytes, encodedParams);
      
      // Encode the complete modifyLiquidities data
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const modifyLiquiditiesData = coder.encode(
        ["bytes", "bytes[]"],
        [actionsBytes, encodedParams]
      );
      
      return modifyLiquiditiesData;
    } catch (error) {
      console.error("Error in V4PositionPlanner.finalize:", error);
      throw error;
    }
  }
}

// Helper function to determine parameter types based on the values
function getParamTypes(params: any[]): string[] {
  // Check if this matches the pattern for poolKey, ticks, liquidity, etc. (MINT_POSITION)
  if (params.length === 8 && params[0] && typeof params[0] === 'object' && 'currency0' in params[0]) {
    return [
      'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)',
      'int24',    // tickLower
      'int24',    // tickUpper
      'uint128',  // liquidity
      'uint256',  // amount0Max
      'uint256',  // amount1Max
      'address',  // recipient
      'bytes'     // hookData
    ];
  }
  
  // Check if this is a SETTLE_PAIR params (two addresses)
  if (params.length === 2 && 
      typeof params[0] === 'string' && 
      typeof params[1] === 'string' && 
      params[0].startsWith('0x') && 
      params[1].startsWith('0x')) {
    return ['address', 'address'];
  }
  
  // For other cases, do individual type detection
  return params.map(p => {
    if (p === null || p === undefined) {
      return 'bytes'; // Default to bytes for null/undefined
    }
    
    if (typeof p === 'object') {
      if ('currency0' in p && 'currency1' in p && 'fee' in p) {
        return 'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)';
      }
      return 'bytes'; // Default for other objects
    }
    
    if (typeof p === 'string') {
      if (p === '' || p === '0x') return 'bytes';
      if (p.startsWith('0x')) {
        if (p.length >= 42) return 'address';
        return 'bytes';
      }
      // Convert numeric strings to appropriate numeric types
      if (/^\d+$/.test(p)) {
        const num = BigInt(p);
        if (num <= BigInt(2**128-1)) return 'uint128';
        return 'uint256';
      }
      return 'string';
    }
    
    if (typeof p === 'number') {
      if (p < 0) return 'int24';
      if (p <= 65535) return 'uint24'; // Common size for fee
      if (p <= 2**32-1) return 'uint32';
      return 'uint256';
    }
    
    if (typeof p === 'boolean') {
      return 'bool';
    }
    
    // Default
    return 'bytes';
  });
}

// Custom hook to get V4 Position Manager contract
const useV4NFTPositionManagerContract = (
  address: string | undefined,
  withSigner = true
): ethers.Contract | null => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    const getContract = async () => {
      if (!address || !isAddress(address)) {
        setContract(null);
        return;
      }

      try {
        // Get provider from window.ethereum
        if (!window.ethereum) {
          console.error("No provider available");
          return null;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // If we need a signer, connect to the account
        if (withSigner) {
          const signer = await provider.getSigner();
          const newContract = new ethers.Contract(
            address,
            V4_POSITION_MANAGER_ABI,
            signer
          );
          setContract(newContract);
        } else {
          const newContract = new ethers.Contract(
            address,
            V4_POSITION_MANAGER_ABI,
            provider
          );
          setContract(newContract);
        }
      } catch (error) {
        console.error("Failed to create contract:", error);
        setContract(null);
      }
    };

    getContract();
  }, [address, withSigner]);

  return contract;
};

// Add these utility functions for price-tick conversion
// Convert price to sqrtPriceX96
function priceToSqrtPriceX96(price: number): string {
  const sqrtPrice = Math.sqrt(price);
  
  // Q64.96 format requires multiplying by 2^96
  const multiplier = Math.pow(2, 96);
  
  // Use BigInt for precise calculation
  try {
    const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * multiplier));
    return sqrtPriceX96.toString();
  } catch (e) {
    console.error("Error calculating sqrtPriceX96:", e);
    // Default to 1.0 price in sqrt terms
    return "79228162514264337593543950336"; // sqrtPriceX96 for price 1.0
  }
}

// Convert price to tick (approximation)
function getTickFromPrice(price: number): number {
  // Formula: tick = log(price) / log(1.0001)
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return tick;
}

// Helper function to get price from tick (for UI display)
function getPriceFromTick(tick: number): number {
  // Formula: price = 1.0001^tick
  return Math.pow(1.0001, tick);
}

// Add this helper function to print calldata in chunks
/**
 * Prints a calldata hex string in readable chunks for debugging
 * @param calldata The calldata hex string
 * @param chunkSize Size of each chunk in bytes
 * @param maxChunks Maximum number of chunks to print
 */
function printCalldataDebug(calldata: string, chunkSize: number = 32, maxChunks: number = 20): void {
  if (!calldata || !calldata.startsWith('0x')) {
    console.error("Invalid calldata for debug printing");
    return;
  }
  
  // Remove 0x prefix for processing
  const data = calldata.substring(2);
  const selector = '0x' + data.substring(0, 8);
  console.log(`\n===== CALLDATA DEBUG (${calldata.length / 2 - 1} bytes) =====`);
  console.log(`Selector: ${selector}`);
  
  // Calculate bytes per chunk (2 hex chars = 1 byte)
  const bytesPerChunk = chunkSize * 2;
  
  // Print the data in chunks
  for (let i = 0; i < Math.min(data.length / bytesPerChunk, maxChunks); i++) {
    const start = i * bytesPerChunk + 8; // Skip the selector
    const end = Math.min(start + bytesPerChunk, data.length);
    if (start < data.length) {
      const chunk = data.substring(start, end);
      console.log(`Chunk ${i + 1}: 0x${chunk}`);
    }
  }
  
  if (data.length / bytesPerChunk > maxChunks) {
    console.log(`... (${Math.ceil(data.length / bytesPerChunk) - maxChunks} more chunks not shown)`);
  }
  
  console.log("===== END CALLDATA DEBUG =====\n");
}

export default function LiquidityPoolInterface() {
  // State variables for pool creation
  const [token0Address, setToken0Address] = useState<string>('');
  const [token1Address, setToken1Address] = useState<string>('');
  const [useNativeToken, setUseNativeToken] = useState<boolean>(false);
  const [fee, setFee] = useState<string>('500'); // Default 0.05% fee
  const [tickSpacing, setTickSpacing] = useState<number>(10); // Will be calculated based on fee
  const [hooksAddress, setHooksAddress] = useState<string>('0x0000000000000000000000000000000000000000');
  
  // Price inputs instead of sqrtPriceX96
  const [initialPrice, setInitialPrice] = useState<string>('1'); // Direct price input (token1/token0)
  const [initialSqrtPriceX96, setInitialSqrtPriceX96] = useState<string>('79228162514264337593543950336'); // Default price of 1:1
  
  // Price range inputs instead of ticks
  const [minPrice, setMinPrice] = useState<string>('0.5'); // 50% below the initial price
  const [maxPrice, setMaxPrice] = useState<string>('2'); // 100% above the initial price
  const [tickLower, setTickLower] = useState<number>(-6932); // Will be calculated from minPrice
  const [tickUpper, setTickUpper] = useState<number>(6935); // Will be calculated from maxPrice
  
  const [liquidityAmount, setLiquidityAmount] = useState<string>('');
  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');
  
  // Contract addresses
  const [positionManagerAddress, setPositionManagerAddress] = useState<string>('');
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [encodedParams, setEncodedParams] = useState<{
    initialize: string;
    modifyLiquidity: string;
  }>({
    initialize: '',
    modifyLiquidity: '',
  });

  // Get user address from AppKit
  const { targetNetwork } = useTargetNetwork();
  const { isConnected, address: userAddress } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  const { walletProvider } = useAppKitProvider<any>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const positionManagerData = contracts?.[targetNetwork.id]?.PositionManager;

  // Debug log for contracts
  useEffect(() => {
    console.log("Target network ID:", targetNetwork.id);
    console.log("All contracts in store:", contracts);
    
    if (contracts && targetNetwork.id) {
      const networkContracts = contracts[targetNetwork.id];
      console.log("Contracts for current network:", networkContracts);
      
      if (networkContracts) {
        console.log("Keys in network contracts:", Object.keys(networkContracts));
        console.log("Position Manager exists:", !!networkContracts.PositionManager);
        console.log("Position Manager data:", networkContracts.PositionManager);
      }
    }
  }, [contracts, targetNetwork.id]);

  // Effect to handle native token selection
  useEffect(() => {
    if (useNativeToken) {
      setToken0Address(NATIVE_TOKEN_ADDRESS);
    } else if (token0Address === NATIVE_TOKEN_ADDRESS) {
      // Clear if no longer using native token
      setToken0Address('');
    }
  }, [useNativeToken]);

  // Update tick spacing when fee changes
  useEffect(() => {
    const feeValue = parseInt(fee);
    const newTickSpacing = TICK_SPACINGS[feeValue] || 60;
    setTickSpacing(newTickSpacing);
  }, [fee]);

  // Update sqrtPriceX96 when initialPrice changes
  useEffect(() => {
    if (initialPrice && !isNaN(parseFloat(initialPrice)) && parseFloat(initialPrice) > 0) {
      const price = parseFloat(initialPrice);
      const newSqrtPriceX96 = priceToSqrtPriceX96(price);
      setInitialSqrtPriceX96(newSqrtPriceX96);
    }
  }, [initialPrice]);

  // Update ticks when price range changes
  useEffect(() => {
    if (minPrice && maxPrice && 
        !isNaN(parseFloat(minPrice)) && !isNaN(parseFloat(maxPrice)) && 
        parseFloat(minPrice) > 0 && parseFloat(maxPrice) > 0) {
      
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      
      // Calculate ticks from price
      let newTickLower = getTickFromPrice(min);
      let newTickUpper = getTickFromPrice(max);
      
      // Adjust ticks to be multiples of tickSpacing
      newTickLower = Math.floor(newTickLower / tickSpacing) * tickSpacing;
      newTickUpper = Math.ceil(newTickUpper / tickSpacing) * tickSpacing;
      
      setTickLower(newTickLower);
      setTickUpper(newTickUpper);
    }
  }, [minPrice, maxPrice, tickSpacing]);

  // Effect to populate the contract addresses from the store if available
  useEffect(() => {
    if (positionManagerData?.address) {
      setPositionManagerAddress(positionManagerData.address);
    }
  }, [positionManagerData]);
  
  // Manual loading of position manager if needed
  const handleManuallySetPositionManager = async () => {
    if (!isAddress(positionManagerAddress)) {
      notification.error("Please enter a valid Position Manager address");
      return;
    }
    
    console.log("Manually setting Position Manager address:", positionManagerAddress);
    notification.info("Position Manager address set manually");
    
    // If you have the ABI, you could set it in the contract store manually
    try {
      if (contracts && targetNetwork.id) {
        // Create a copy of the current contracts
        const updatedContracts = { ...contracts };
        
        // Make sure network exists
        if (!updatedContracts[targetNetwork.id]) {
          updatedContracts[targetNetwork.id] = {};
        }
        
        // Add position manager contract with a more complete minimal ABI
        // This ABI contains the key functions needed to identify it as a Position Manager
        const positionManagerAbi = [
          {
            "inputs": [
              {
                "internalType": "bytes[]",
                "name": "data",
                "type": "bytes[]"
              }
            ],
            "name": "multicall",
            "outputs": [
              {
                "internalType": "bytes[]",
                "name": "results",
                "type": "bytes[]"
              }
            ],
            "stateMutability": "payable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "bytes",
                "name": "actions",
                "type": "bytes"
              },
              {
                "internalType": "bytes[]",
                "name": "params",
                "type": "bytes[]"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              }
            ],
            "name": "modifyLiquidities",
            "outputs": [
              {
                "internalType": "bytes",
                "name": "",
                "type": "bytes"
              }
            ],
            "stateMutability": "payable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "tuple",
                "name": "key",
                "type": "tuple",
                "components": [
                  {
                    "internalType": "address",
                    "name": "currency0",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "currency1",
                    "type": "address"
                  },
                  {
                    "internalType": "uint24",
                    "name": "fee",
                    "type": "uint24"
                  },
                  {
                    "internalType": "int24",
                    "name": "tickSpacing",
                    "type": "int24"
                  },
                  {
                    "internalType": "address",
                    "name": "hooks",
                    "type": "address"
                  }
                ]
              },
              {
                "internalType": "int24",
                "name": "tickLower",
                "type": "int24"
              },
              {
                "internalType": "int24",
                "name": "tickUpper",
                "type": "int24"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
              }
            ],
            "name": "mint",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
              }
            ],
            "stateMutability": "payable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "tuple",
                "name": "key",
                "type": "tuple",
                "components": [
                  {
                    "internalType": "address",
                    "name": "currency0",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "currency1",
                    "type": "address"
                  },
                  {
                    "internalType": "uint24",
                    "name": "fee",
                    "type": "uint24"
                  },
                  {
                    "internalType": "int24",
                    "name": "tickSpacing",
                    "type": "int24"
                  },
                  {
                    "internalType": "address",
                    "name": "hooks",
                    "type": "address"
                  }
                ]
              },
              {
                "internalType": "int24",
                "name": "tickLower",
                "type": "int24"
              },
              {
                "internalType": "int24",
                "name": "tickUpper",
                "type": "int24"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "hookData",
                "type": "bytes"
              },
              {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
              }
            ],
            "name": "settleAndMint",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
              }
            ],
            "stateMutability": "payable",
            "type": "function"
          }
        ];
        
        // Set the contract in the store
        updatedContracts[targetNetwork.id].PositionManager = {
          address: positionManagerAddress as `0x${string}`,
          abi: positionManagerAbi,
          inheritedFunctions: {}
        };
        
        // Use the imported setContracts function
        await setContracts(updatedContracts);
        
        console.log("Manual position manager contract set:", updatedContracts[targetNetwork.id].PositionManager);
        
        // Verify it was set correctly
        setTimeout(() => {
          const refreshedContracts = useContractStore.getState().contracts;
          console.log("Refreshed contracts after manual set:", refreshedContracts);
          console.log("Position Manager in refreshed contracts:", refreshedContracts[targetNetwork.id]?.PositionManager);
        }, 500);
        
        notification.success("Position Manager contract manually added to store!");
      }
    } catch (error) {
      console.error("Error manually setting position manager:", error);
      notification.error("Failed to manually set Position Manager: " + (error as Error).message);
    }
  };

  // Effect to detect when both contracts are available and ready to use
  useEffect(() => {
    console.log("Contract status update:", {
      positionManager: !!positionManagerData
    });
    
    // When both contracts are loaded, we can perform additional setup if needed
    if (positionManagerData) {
      notification.success("Position Manager contract loaded successfully!");
    }
  }, [positionManagerData]);
  
  // Determine if we have the necessary contracts
  const hasPositionManager = isAddress(positionManagerAddress);

  const encodeModifyLiquidityParams = () => {
    // Validate inputs
    if (!isAddress(token0Address) || !isAddress(token1Address)) {
      notification.error("Invalid token addresses");
      return null;
    }

    if (parseInt(fee) <= 0) {
      notification.error("Fee must be greater than 0");
      return null;
    }

    if (!liquidityAmount || parseFloat(liquidityAmount) <= 0) {
      notification.error("Liquidity amount must be greater than 0");
      return null;
    }

    // Create pool key (same as for initialize)
    const poolKey = {
      currency0: token0Address,
      currency1: token1Address,
      fee: parseInt(fee),
      tickSpacing: tickSpacing,
      hooks: hooksAddress
    };

    // Create modify liquidity params
    const liquidityDelta = parseEther(liquidityAmount);
    const modifyParams = {
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidityDelta: liquidityDelta,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000000" // Default salt
    };

    try {
      console.log("Creating modify liquidity params with:", {
        poolKey,
        params: modifyParams,
        hookData: "0x" // Empty hook data
      });

      return { poolKey, params: modifyParams, hookData: "0x" };
    } catch (error) {
      console.error("Error encoding modify liquidity params:", error);
      notification.error("Failed to encode modify liquidity parameters");
      return null;
    }
  };

  const handleApproveTokens = async () => {
    try {
      // Validations
      if (!isConnected || !userAddress) {
        notification.error("Please connect your wallet");
        return;
      }

      if (!isAddress(positionManagerAddress)) {
        notification.error("Invalid Position Manager address");
        return;
      }

      // Skip approval for native token (token0)
      const isToken0Native = token0Address === NATIVE_TOKEN_ADDRESS;
      
      setIsLoading(true);
      notification.info("Approving tokens...");

      // Create ethers provider from walletProvider properly
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsLoading(false);
        return;
      }
      
      console.log("Creating ethers provider from walletProvider:", walletProvider);
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      console.log("Signer created successfully:", signer.address);

      // ERC20 ABI (minimal for approve)
      const erc20Abi = [
        "function approve(address spender, uint256 amount) returns (bool)"
      ];

      // First approve Permit2 as a spender for both tokens
      if (!isToken0Native) {
        notification.info("Approving token0 for Permit2...");
        const token0Contract = new ethers.Contract(token0Address, erc20Abi, signer);
        const tx1 = await token0Contract.approve(
          PERMIT2_ADDRESS, 
          ethers.MaxUint256
        );
        await tx1.wait();
        notification.success("Token0 approved for Permit2");
      }

      notification.info("Approving token1 for Permit2...");
      const token1Contract = new ethers.Contract(token1Address, erc20Abi, signer);
      const tx2 = await token1Contract.approve(
        PERMIT2_ADDRESS, 
        ethers.MaxUint256
      );
      await tx2.wait();
      notification.success("Token1 approved for Permit2");

      // Now approve Position Manager using Permit2
      const permit2Abi = [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
      ];
      const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, permit2Abi, signer);

      if (!isToken0Native) {
        notification.info("Approving token0 for Position Manager...");
        const tx3 = await permit2Contract.approve(
          token0Address,
          positionManagerAddress,
          BigInt('0xffffffffffffffffff'), // max uint160
          Number('0xffffffffffff')        // max uint48
        );
        await tx3.wait();
        notification.success("Token0 approved for Position Manager");
      }

      notification.info("Approving token1 for Position Manager...");
      const tx4 = await permit2Contract.approve(
        token1Address,
        positionManagerAddress,
        BigInt('0xffffffffffffffffff'), // max uint160
        Number('0xffffffffffff')        // max uint48
      );
      await tx4.wait();
      notification.success("Token1 approved for Position Manager");

      // Update approval states
      notification.success("All tokens approved successfully");
    } catch (error) {
      console.error("Error approving tokens:", error);
      notification.error("Failed to approve tokens: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // A simplified direct approach that doesn't rely on the V4PositionPlanner
  const simplifiedAddLiquidity = async () => {
    if (!positionManagerAddress) {
      notification.error("Position Manager address is required");
      return;
    }

    try {
      console.log("Starting simplified add liquidity process...");
      setIsLoading(true);

      if (!walletProvider) {
        notification.error("Wallet provider not available");
        return;
      }

      console.log("Creating ethers provider and getting signer...");
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      console.log("Signer created successfully:", signer.address);

      // Calculate value to send (for native ETH if token0 is native)
      const valueToSend = token0Address === NATIVE_TOKEN_ADDRESS 
        ? ethers.parseEther(amount0) 
        : ethers.parseEther("0");
      console.log(`Value to send: ${valueToSend.toString()}`);

      // Format addresses properly - with special handling for native token
      let token0;
      if (token0Address === NATIVE_TOKEN_ADDRESS || token0Address === '0x0' || token0Address === '0x') {
        token0 = NATIVE_TOKEN_ADDRESS;
        console.log("Using native token for token0");
      } else {
        if (!ethers.isAddress(token0Address)) {
          throw new Error(`Invalid token0 address: ${token0Address}`);
        }
        token0 = ethers.getAddress(token0Address);
      }
      
      if (!ethers.isAddress(token1Address)) {
        throw new Error(`Invalid token1 address: ${token1Address}`);
      }
      const token1 = ethers.getAddress(token1Address);
      
      const hooks = ethers.isAddress(hooksAddress) ? ethers.getAddress(hooksAddress) : EMPTY_HOOK;
      
      // Parameter values
      const liquidityBigInt = ethers.parseEther(liquidityAmount);
      const amount0Max = ethers.parseEther(amount0.toString());
      const amount1Max = ethers.parseEther(amount1.toString());
      
      console.log("Preparing simplified transaction with these values:");
      console.log("- token0:", token0);
      console.log("- token1:", token1);
      console.log("- hooks:", hooks);
      console.log("- fee:", parseInt(fee));
      console.log("- tickSpacing:", tickSpacing);
      console.log("- liquidityBigInt:", liquidityBigInt.toString());
      console.log("- amount0Max:", amount0Max.toString());
      console.log("- amount1Max:", amount1Max.toString());
      console.log("- tickLower:", tickLower);
      console.log("- tickUpper:", tickUpper);
      
      // Create contract instance directly with minimal ABI
      const positionManager = new ethers.Contract(
        positionManagerAddress,
        [
          {
            "inputs": [{"internalType": "bytes[]", "name": "data", "type": "bytes[]"}],
            "name": "multicall",
            "outputs": [{"internalType": "bytes[]", "name": "results", "type": "bytes[]"}],
            "stateMutability": "payable",
            "type": "function"
          }
        ],
        signer
      );
      
      // Create deadline (1 hour from now)
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      // Create a simple array with the key components - no complex objects
      const poolKeyComponents = [
        token0,               // currency0
        token1,               // currency1
        parseInt(fee),        // fee
        tickSpacing,          // tickSpacing
        hooks                 // hooks
      ];
      
      // Create a full array of 42 elements for multicall
      // This matches the expected format by the UniswapV4 position manager
      const fullCallsArray = Array(42).fill('0x');
      
      // Fill only the ones we need - the rest will remain as empty bytes
      fullCallsArray[0] = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(address,address,uint24,int24,address)', 'uint160'],
        [
          poolKeyComponents,
          initialSqrtPriceX96
        ]
      );
      
      // Action codes from documentation (we use MINT_POSITION = 0x02 and SETTLE_PAIR = 0x0D)
      const actions = ethers.concat([
        ethers.toBeHex(Actions.MINT_POSITION, 1), // 0x02
        ethers.toBeHex(Actions.SETTLE_PAIR, 1)    // 0x0D
      ]);
      
      console.log("Actions bytes:", ethers.hexlify(actions)); // Should be "0x020d"
      
      // Encode parameters for each action
      const params = [
        // Parameters for MINT_POSITION
        ethers.AbiCoder.defaultAbiCoder().encode(
          [
            'tuple(address,address,uint24,int24,address)', // poolKey
            'int24',    // tickLower
            'int24',    // tickUpper
            'uint128',  // liquidityDelta
            'uint256',  // amount0Max
            'uint256',  // amount1Max
            'address',  // recipient
            'bytes'     // hookData (empty)
          ],
          [
            poolKeyComponents,
            tickLower,
            tickUpper,
            liquidityBigInt.toString(),
            amount0Max.toString(),
            amount1Max.toString(),
            signer.address,
            '0x' // Empty bytes
          ]
        ),
        
        // Parameters for SETTLE_PAIR
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address'],
          [token0, token1]
        )
      ];
      
      console.log("Parameters array length:", params.length);
      console.log("First parameter sample:", params[0].substring(0, 66) + "...");
      
      // Add the encoded modifyLiquidities call to position 1 in the array
      fullCallsArray[1] = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes', 'bytes[]', 'uint256'],
        [actions, params, deadline]
      );
      
      console.log("Full calls array structure:");
      console.log("- Total elements:", fullCallsArray.length);
      console.log("- Non-empty elements:", fullCallsArray.filter(x => x !== '0x').length);
      
      // Define callsArray as our full array
      const callsArray = fullCallsArray;
      
      console.log("Simplified multicall parameters prepared successfully");
      console.log("Number of calls:", callsArray.length);
      console.log("First call preview:", callsArray[0].substring(0, 66) + "...");
      
      // Transaction options
      const txOptions = {
        value: valueToSend,
        gasLimit: ethers.parseUnits("30000000", "wei")
      };
      
      try {
        console.log("Sending simplified multicall transaction...");
        
        // Call multicall directly on the contract
        const tx = await positionManager.multicall(callsArray, txOptions);
        
        console.log(`Transaction submitted successfully. Hash: ${tx.hash}`);
        notification.success(`Transaction submitted: ${tx.hash}`);
        setTxHash(tx.hash);
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        console.log("Transaction receipt:", receipt);
        if (receipt && receipt.status === 1) {
          notification.success("Position created successfully!");
        } else {
          notification.error("Transaction failed on-chain.");
        }
      } catch (e: any) {
        console.error("Error in simplified approach:", e);
        
        if (e.message) {
          if (e.message.includes("insufficient funds")) {
            notification.error("Insufficient funds for transaction");
          } else if (e.message.includes("user rejected")) {
            notification.error("Transaction rejected by user");
          } else {
            notification.error(e.message);
          }
        } else {
          notification.error("Failed to add liquidity. See console for details.");
        }
        
        // Even if this fails, we still want to end our loading state
        throw e; // Re-throw to let the caller know this failed
      }
    } catch (error: any) {
      console.error("Error in simplified add liquidity:", error);
      notification.error(error.message || "Unknown error");
      throw error; // Re-throw to let the caller know this failed
    } finally {
      setIsLoading(false);
    }
  };

  // Modify the existing handleAddLiquidity function to try the simplified approach as fallback
  const handleAddLiquidity = async () => {
    if (!positionManagerAddress) {
      notification.error("Position Manager address is required");
      return;
    }

    try {
      console.log("Starting add liquidity process...");
      setIsLoading(true);

      if (!walletProvider) {
        notification.error("Wallet provider not available");
        return;
      }

      console.log("Creating ethers provider and getting signer...");
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      console.log("Signer created successfully:", signer.address);

      // Calculate value to send (for native ETH if token0 is native)
      const valueToSend = token0Address === NATIVE_TOKEN_ADDRESS 
        ? ethers.parseEther(amount0) 
        : ethers.parseEther("0");
      console.log(`Value to send: ${valueToSend.toString()}`);

      // Format addresses to ensure they're valid checksummed addresses
      // Handle case where token0 might be the native token address (0x0)
      let token0;
      if (token0Address === NATIVE_TOKEN_ADDRESS || token0Address === '0x0' || token0Address === '0x') {
        token0 = NATIVE_TOKEN_ADDRESS;
      } else {
        if (!ethers.isAddress(token0Address)) {
          throw new Error(`Invalid token0 address: ${token0Address}`);
        }
        token0 = ethers.getAddress(token0Address);
      }
      
      if (!ethers.isAddress(token1Address)) {
        throw new Error(`Invalid token1 address: ${token1Address}`);
      }
      const token1 = ethers.getAddress(token1Address);
      
      console.log("Token0 (checksummed):", token0);
      console.log("Token1 (checksummed):", token1);
      
      // Validate hooks address
      const safeHooksAddress = ethers.isAddress(hooksAddress) ? ethers.getAddress(hooksAddress) : EMPTY_HOOK;
      
      // Create the pool key with checksummed addresses
      const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: parseInt(fee),
        tickSpacing: tickSpacing,
        hooks: safeHooksAddress
      };
      
      console.log("Pool key details:");
      console.log("- currency0:", poolKey.currency0);
      console.log("- currency1:", poolKey.currency1);
      console.log("- fee:", poolKey.fee);
      console.log("- tickSpacing:", poolKey.tickSpacing);
      console.log("- hooks:", poolKey.hooks);
      
      // Parameter values
      const liquidityBigInt = ethers.parseEther(liquidityAmount);
      const amount0Max = ethers.parseEther(amount0.toString());
      const amount1Max = ethers.parseEther(amount1.toString());
      
      console.log("Parameter values:");
      console.log("- Liquidity amount:", liquidityBigInt.toString());
      console.log("- Amount0 max:", amount0Max.toString());
      console.log("- Amount1 max:", amount1Max.toString());
      console.log("- tickLower:", tickLower);
      console.log("- tickUpper:", tickUpper);

      try {
        // Try three different approaches in sequence, if one fails we try the next
        console.log("Beginning multi-approach liquidity add flow...");
        
        // Approach 1: Use V4PositionPlanner
        try {
          console.log("APPROACH 1: Using V4PositionPlanner...");
          notification.info("Attempting to add liquidity (Approach 1/3)");
          
          const planner = new V4PositionPlanner();
          
          // Add the MINT_POSITION action with the pool key and parameters
          planner.addMint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityBigInt,
            amount0Max.toString(),
            amount1Max.toString(),
            signer.address
          );
          
          // Add the SETTLE_PAIR action to settle any remaining tokens
          planner.addSettlePair(token0, token1);
          
          // Get the finalized modifyLiquidities data
          console.log("Finalizing modifyLiquidities data...");
          const modifyLiquiditiesData = planner.finalize();
          console.log("Actions bytes (from planner):", modifyLiquiditiesData.substring(0, 10));

          // Decode and log the modifyLiquidities data to debug
          try {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
              ["bytes", "bytes[]"],
              modifyLiquiditiesData
            );
            
            console.log("Decoded modifyLiquiditiesData:");
            console.log("- Actions:", decodedData[0]);
            console.log("- Number of params:", decodedData[1].length);
            
            // Log a preview of each parameter (first 64 chars)
            for (let i = 0; i < decodedData[1].length; i++) {
              const param = decodedData[1][i];
              console.log(`- Param ${i} (${param.substring(0, 64)}...)`);
            }
          } catch (error) {
            console.error("Failed to decode modifyLiquidities data:", error);
            notification.error("Failed to encode transaction data: There was an error preparing the transaction data. Please try again.");
            return;
          }
          
          // Set the deadline to 1 hour from now
          const deadline = Math.floor(Date.now() / 1000) + 3600;
          
          // Log the action bytes (should be 0x020d for MINT_POSITION and SETTLE_PAIR)
          console.log("Actions bytes (from planner):", modifyLiquiditiesData.substring(0, 10));
          
          // For debugging, decode the modifyLiquiditiesData to examine its structure
          try {
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const decoded = abiCoder.decode(['bytes', 'bytes[]'], modifyLiquiditiesData);
            
            console.log("Decoded modifyLiquiditiesData:");
            console.log("- Actions:", ethers.hexlify(decoded[0]));
            console.log("- Number of params:", decoded[1].length);
            
            // Log each parameter
            for (let i = 0; i < decoded[1].length; i++) {
              const param = decoded[1][i];
              if (typeof param === 'string' && param.length > 66) {
                console.log(`- Param ${i} (${param.substring(0, 66)}...)`);
              } else {
                console.log(`- Param ${i}: ${param}`);
              }
            }
          } catch (decodeError) {
            console.error("Error decoding modifyLiquiditiesData:", decodeError);
          }
          
          // Encode the modifyLiquidities call
          const modifyLiquiditiesCalldata = V4PositionManager.encodeModifyLiquidities(
            modifyLiquiditiesData,
            deadline
          );
          
          // Now prepare the initializePool calldata if needed
          const sqrtPriceX96 = initialSqrtPriceX96; // Use the previously calculated sqrtPriceX96
          const initializePoolCalldata = V4PositionManager.encodeInitializePool(
            poolKey,
            sqrtPriceX96
          );
          
          // Create the multicall array with both function calls
          const callsArray = [initializePoolCalldata, modifyLiquiditiesCalldata];
          
          // Use the Multicall helper to encode the multicall
          console.log("Encoding multicall with calldata array...");
          const multicallCalldata = Multicall.encodeMulticall(callsArray);
          
          console.log("Final multicall calldata length:", multicallCalldata.length);
          console.log("Multicall selector (should be 0xac9650d8):", multicallCalldata.substring(0, 10));
          
          // Add the validation step here
          if (!validateMulticallCalldata(multicallCalldata)) {
            console.error("CRITICAL ERROR: Multicall calldata validation failed");
            notification.error("Transaction preparation failed: Invalid calldata format");
            throw new Error("Invalid multicall calldata format");
          }
          
          console.log("Multicall calldata validation successful!");
          
          // Add detailed hex dump for better debugging
          console.log("\n===== CALLDATA HEX DUMP =====");
          console.log("Selector: " + multicallCalldata.substring(0, 10));
          for (let i = 10; i < Math.min(multicallCalldata.length, 1000); i += 64) {
            const chunk = multicallCalldata.substring(i, i + 64);
            console.log(`[${Math.floor((i-10)/64)}]: ${chunk}`);
          }
          console.log("===== END CALLDATA DUMP =====\n");
          
          // Create transaction request
          const txRequest = {
            to: positionManagerAddress,
            from: signer.address,
            data: multicallCalldata,
            value: valueToSend.toString(),
            gasLimit: ethers.parseUnits("30000000", "wei").toString()
          };
          
          console.log("Transaction request:", {
            to: txRequest.to,
            value: txRequest.value,
            gasLimit: txRequest.gasLimit,
            dataLength: txRequest.data.length,
            dataStart: txRequest.data.substring(0, 66) + "..."
          });
          
          // Safety check: Ensure the calldata is properly set
          if (!txRequest.data || !txRequest.data.startsWith("0xac9650d8")) {
            console.error("CRITICAL ERROR: Transaction data is missing or invalid!", txRequest);
            notification.error("Transaction preparation failed");
            throw new Error("Invalid transaction data. Multicall selector missing.");
          }

          console.log("Transaction data verified and includes multicall selector: 0xac9650d8");
          
          try {
            notification.info("Sending transaction...");
            
            let tx;
            try {
              // First try sending via the signer
              console.log("Attempting to send transaction via signer...");
              tx = await signer.sendTransaction(txRequest);
            } catch (signerError) {
              console.error("Error sending via signer, trying direct RPC call:", signerError);
              
              // Fallback to direct RPC method
              if (walletProvider && typeof walletProvider.request === 'function') {
                console.log("Sending transaction via direct RPC call...");
                notification.info("Trying alternative transaction method...");
                
                // Prepare the transaction parameters for RPC call
                const rpcTxParams = {
                  from: txRequest.from,
                  to: txRequest.to,
                  data: txRequest.data,
                  value: ethers.toBeHex(valueToSend), // Convert to hex
                  gas: ethers.toBeHex(ethers.parseUnits("30000000", "wei")) // Convert gas limit to hex
                };
                
                // Add additional debug info for the transaction data
                console.log("RPC transaction parameters:", {
                  from: rpcTxParams.from,
                  to: rpcTxParams.to,
                  value: rpcTxParams.value,
                  gas: rpcTxParams.gas,
                  dataLength: rpcTxParams.data.length,
                  dataStart: `${rpcTxParams.data.substring(0, 74)}...` // Show the function selector and the start of the data
                });
                
                // Verify the data includes the multicall selector
                if (!rpcTxParams.data.startsWith('0xac9650d8')) {
                  console.error("CRITICAL ERROR: Transaction data does not start with the multicall selector");
                  notification.error("Transaction Preparation Failed: The transaction data is invalid. Missing function selector.");
                  throw new Error("Invalid transaction data: missing multicall selector");
                }
                
                console.log("Transaction data verified and includes multicall selector: 0xac9650d8");
                
                // Print detailed debug information for the transaction data
                printCalldataDebug(rpcTxParams.data);
                
                // Final safety check - ensure the data field is not empty or missing
                if (!rpcTxParams.data || rpcTxParams.data === '0x' || rpcTxParams.data.length < 10) {
                  console.error("CRITICAL ERROR: Transaction data is empty or too short");
                  notification.error("Transaction Failed: Cannot send a transaction with empty data");
                  throw new Error("Invalid transaction data: empty or too short");
                }
                
                // Add more detailed logging to help diagnose any issues with the data
                console.log(`Invoking eth_sendTransaction directly via wallet provider to bypass any data manipulation by ethers.js`);
                console.log(`This ensures the raw data is sent exactly as prepared.`);
                
                // Send the transaction using the wallet provider's RPC request method
                const txHash = await walletProvider.request({
                  method: 'eth_sendTransaction',
                  params: [rpcTxParams]
                });
                
                // Create a tx object similar to what signer.sendTransaction would return
                tx = {
                  hash: txHash,
                  wait: async () => {
                    // Poll for the transaction receipt
                    let receipt = null;
                    const maxAttempts = 120; // 2 minutes with 1 second interval
                    let attempts = 0;
                    
                    while (!receipt && attempts < maxAttempts) {
                      try {
                        // Get transaction receipt using RPC
                        receipt = await walletProvider.request({
                          method: 'eth_getTransactionReceipt',
                          params: [txHash]
                        });
                        
                        if (!receipt) {
                          console.log(`Waiting for transaction receipt (attempt ${attempts + 1}/${maxAttempts})...`);
                          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                          attempts++;
                        }
                      } catch (e) {
                        console.error("Error checking transaction receipt:", e);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        attempts++;
                      }
                    }
                    
                    if (!receipt) {
                      throw new Error("Transaction receipt not found after multiple attempts");
                    }
                    
                    // Convert the receipt to the expected format
                    return {
                      ...receipt,
                      status: receipt.status === '0x1' ? 1 : 0
                    };
                  }
                };
                
                console.log("Direct RPC transaction submitted successfully");
              } else {
                // If no fallback is possible, rethrow the original error
                throw signerError;
              }
            }
            
            console.log(`Transaction submitted successfully. Hash: ${tx.hash}`);
            notification.success(`Transaction submitted: ${tx.hash}`);
            setTxHash(tx.hash);
            
            // Wait for transaction to be mined and get receipt
            console.log("Waiting for transaction to be mined...");
            
            try {
              const receipt = await tx.wait();
              console.log("Transaction receipt:", receipt);
              
              if (receipt && receipt.status === 1) {
                // Transaction was successful
                notification.success("Position created successfully!");
                // Removed redirection to my-positions
              } else {
                // Transaction failed
                console.error("Transaction failed:", receipt);
                notification.error("Transaction failed on-chain.");
              }
            } catch (receiptError) {
              console.error("Error waiting for receipt:", receiptError);
              notification.error("Error obtaining transaction receipt: " + (receiptError as Error).message);
            }
          } catch (e: any) {
            console.error("Error in handleAddLiquidity:", e);
            
            if (e.message) {
              if (e.message.includes("insufficient funds")) {
                notification.error("Insufficient funds for transaction");
              } else if (e.message.includes("user rejected")) {
                notification.error("Transaction rejected by user");
              } else if (e.message.includes("gas required exceeds")) {
                notification.error("Gas estimation failed: Transaction may require more gas than the block gas limit");
              } else {
                notification.error(e.message);
              }
            } else {
              notification.error("Failed to add liquidity. See console for details.");
            }
          }
        } catch (plannerError: any) {
          console.error("Error in position planning (Approach 1):", plannerError);
          notification.info("First approach failed, trying simplified method (Approach 2/3)...");
          
          try {
            // If planner approach fails, try the simplified approach
            console.log("APPROACH 2: Using simplified method...");
            await simplifiedAddLiquidity();
          } catch (simplifiedError: any) {
            console.error("Error in simplified approach (Approach 2):", simplifiedError);
            notification.info("Second approach failed, trying direct 42-array method (Approach 3/3)...");
            
            // If simplified approach fails, try the direct 42-array approach
            console.log("APPROACH 3: Using direct 42-array approach...");
            await direct42ArrayLiquidity();
          }
        }
      } catch (error: any) {
        console.error("All approaches failed:", error);
        notification.error("Failed to add liquidity with all methods. See console for details.");
      }
    } catch (error: any) {
      console.error("Error in handleAddLiquidity:", error);
      
      if (error.message) {
        if (error.message.includes("insufficient funds")) {
          notification.error("Insufficient funds for transaction");
        } else if (error.message.includes("user rejected")) {
          notification.error("Transaction rejected by user");
        } else if (error.message.includes("gas required exceeds")) {
          notification.error("Gas estimation failed: The transaction may require more gas than the block gas limit");
        } else {
          notification.error(error.message);
        }
      } else {
        notification.error("Failed to add liquidity. See console for details.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // A direct approach that specifically uses a 42-element array for the multicall
  const direct42ArrayLiquidity = async () => {
    if (!positionManagerAddress) {
      notification.error("Position Manager address is required");
      return;
    }

    try {
      console.log("Starting direct 42-array liquidity process...");
      setIsLoading(true);

      if (!walletProvider) {
        notification.error("Wallet provider not available");
        return;
      }

      console.log("Creating ethers provider and getting signer...");
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      console.log("Signer created successfully:", signer.address);

      // Calculate value to send (for native ETH if token0 is native)
      const valueToSend = token0Address === NATIVE_TOKEN_ADDRESS 
        ? ethers.parseEther(amount0) 
        : ethers.parseEther("0");
      console.log(`Value to send: ${valueToSend.toString()}`);

      // Format addresses properly - with special handling for native token
      let token0;
      if (token0Address === NATIVE_TOKEN_ADDRESS || token0Address === '0x0' || token0Address === '0x') {
        token0 = NATIVE_TOKEN_ADDRESS;
        console.log("Using native token for token0");
      } else {
        if (!ethers.isAddress(token0Address)) {
          throw new Error(`Invalid token0 address: ${token0Address}`);
        }
        token0 = ethers.getAddress(token0Address);
      }
      
      if (!ethers.isAddress(token1Address)) {
        throw new Error(`Invalid token1 address: ${token1Address}`);
      }
      const token1 = ethers.getAddress(token1Address);
      
      const hooks = ethers.isAddress(hooksAddress) ? ethers.getAddress(hooksAddress) : EMPTY_HOOK;
      
      // Create poolKey object
      const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: parseInt(fee),
        tickSpacing: tickSpacing,
        hooks: hooks
      };
      
      // Parameter values
      const liquidityBigInt = ethers.parseEther(liquidityAmount);
      const amount0Max = ethers.parseEther(amount0.toString());
      const amount1Max = ethers.parseEther(amount1.toString());
      
      console.log("Preparing direct 42-array transaction with these values:");
      console.log("- token0:", token0);
      console.log("- token1:", token1);
      console.log("- hooks:", hooks);
      console.log("- fee:", parseInt(fee));
      console.log("- tickSpacing:", tickSpacing);
      console.log("- liquidityBigInt:", liquidityBigInt.toString());
      console.log("- amount0Max:", amount0Max.toString());
      console.log("- amount1Max:", amount1Max.toString());
      console.log("- tickLower:", tickLower);
      console.log("- tickUpper:", tickUpper);
      
      // Create a mutable array with 42 elements
      let callsDataArray = Array(42).fill('0x');
      
      // First element: initializePool
      callsDataArray[0] = V4PositionManager.encodeInitializePool(
        poolKey,
        initialSqrtPriceX96
      );
      
      // Create action bytes for MINT_POSITION and SETTLE_PAIR
      const actions = ethers.concat([
        ethers.toBeHex(Actions.MINT_POSITION, 1), // 0x02
        ethers.toBeHex(Actions.SETTLE_PAIR, 1)    // 0x0D
      ]);
      
      console.log("Action bytes:", ethers.hexlify(actions)); // Should be "0x020d"
      
      // Create parameters for MINT_POSITION with detailed logging
      console.log("Encoding parameters for MINT_POSITION...");
      console.log("- Pool key tokens:", token0, token1);
      console.log("- Fee (numeric):", parseInt(fee));
      console.log("- Tick spacing:", tickSpacing);
      console.log("- Liquidity amount:", liquidityBigInt.toString());

      // Better debugging for the liquid parameter
      console.log("Type of liquidityAmount:", typeof liquidityAmount);
      console.log("Type of liquidityBigInt:", typeof liquidityBigInt);
      console.log("liquidityBigInt string representation:", String(liquidityBigInt));
      
      // Create poolKey as a proper object (not an array)
      const poolKeyObj = {
        currency0: token0, 
        currency1: token1, 
        fee: parseInt(fee), 
        tickSpacing: tickSpacing, 
        hooks: hooks
      };
      
      console.log("Pool key object:", poolKeyObj);
      console.log("Ticks:", tickLower, tickUpper);
      
      // Format numeric values as BigInts or strings without 0x prefix
      const liquidityBigIntValue = liquidityBigInt.toString();
      const amount0MaxValue = amount0Max.toString();
      const amount1MaxValue = amount1Max.toString();
      
      console.log("Formatted parameters:");
      console.log("- liquidityBigIntValue:", liquidityBigIntValue);
      console.log("- amount0MaxValue:", amount0MaxValue);
      console.log("- amount1MaxValue:", amount1MaxValue);
      
      const mintParams = ethers.AbiCoder.defaultAbiCoder().encode(
        [
          'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)', // poolKey
          'int24',    // tickLower
          'int24',    // tickUpper
          'uint128',  // liquidityDelta
          'uint256',  // amount0Max
          'uint256',  // amount1Max
          'address',  // recipient
          'bytes'     // hookData
        ],
        [
          poolKeyObj,
          tickLower,
          tickUpper,
          liquidityBigIntValue,
          amount0MaxValue,
          amount1MaxValue,
          signer.address,
          '0x' // Empty bytes
        ]
      );
      
      // Detailed logging for the encoded parameters
      console.log("MINT_POSITION params encoded successfully, length:", mintParams.length);
      console.log("MINT_POSITION params preview:", mintParams.substring(0, 66) + "...");
      
      // For debug purposes, count how many zeroes appear in the encoded params
      const zeroesCount = (mintParams.match(/0000/g) || []).length;
      console.log(`MINT_POSITION params contains ${zeroesCount} occurrences of '0000'`);
      
      // Additional diagnostic checks on the encoded data
      const hasValidPrefix = mintParams.startsWith('0x');
      console.log("MINT_POSITION params has valid 0x prefix:", hasValidPrefix);
      
      // Show the first 32 bytes chunks
      console.log("MINT_POSITION first data chunks:");
      for (let i = 2; i < Math.min(mintParams.length, 260); i += 64) {
        const chunk = mintParams.substring(i, i + 64);
        console.log(`[${Math.floor(i/64)}]: ${chunk}`);
      }
      
      // Create parameters for SETTLE_PAIR
      const settleParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address'],
        [token0, token1]
      );
      
      // Create deadline (1 hour from now)
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      // Second element: modifyLiquidities
      callsDataArray[1] = V4PositionManager.encodeModifyLiquidities(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes', 'bytes[]'],
          [actions, [mintParams, settleParams]]
        ),
        deadline
      );
      
      console.log("Calls array prepared:");
      console.log("- Total elements:", callsDataArray.length);
      console.log("- Non-empty elements:", callsDataArray.filter(x => x !== '0x').length);
      
      // Encode the multicall with enhanced logging
      console.log("Encoding multicall with 42 elements to satisfy UniswapV4 requirements...");
      console.log("First two elements are populated, rest are empty bytes (0x)");
      
      // Ensure the array has exactly 42 elements
      if (callsDataArray.length !== 42) {
        console.warn(`Warning: callsDataArray has ${callsDataArray.length} elements instead of 42. Adjusting...`);
        if (callsDataArray.length < 42) {
          // Pad with empty bytes
          callsDataArray = [...callsDataArray, ...Array(42 - callsDataArray.length).fill('0x')];
        } else if (callsDataArray.length > 42) {
          // Truncate to 42 elements
          callsDataArray = callsDataArray.slice(0, 42);
        }
      }
      
      console.log("Verified callsDataArray has exactly 42 elements:", callsDataArray.length);
      
      // Count non-empty elements
      const nonEmptyElements = callsDataArray.filter(x => x !== '0x');
      console.log("Non-empty elements count:", nonEmptyElements.length);
      
      // Log first two non-empty elements (if present)
      if (nonEmptyElements.length > 0) {
        console.log("First non-empty element preview:", nonEmptyElements[0].substring(0, 66) + "...");
        if (nonEmptyElements.length > 1) {
          console.log("Second non-empty element preview:", nonEmptyElements[1].substring(0, 66) + "...");
        }
      }
      
      // Encode the final multicall
      const multicallCalldata = Multicall.encodeMulticall(callsDataArray);
      
      console.log("Final multicall calldata length:", multicallCalldata.length);
      console.log("Multicall selector (should be 0xac9650d8):", multicallCalldata.substring(0, 10));
      
      // Add detailed hex dump for better debugging
      console.log("\n===== CALLDATA HEX DUMP =====");
      console.log("Selector: " + multicallCalldata.substring(0, 10));
      for (let i = 10; i < Math.min(multicallCalldata.length, 1000); i += 64) {
        const chunk = multicallCalldata.substring(i, i + 64);
        console.log(`[${Math.floor((i-10)/64)}]: ${chunk}`);
      }
      console.log("===== END CALLDATA DUMP =====\n");
      
      // Create transaction options
      const txOptions = {
        to: positionManagerAddress,
        from: signer.address,
        data: multicallCalldata,
        value: valueToSend.toString(),
        gasLimit: ethers.parseUnits("30000000", "wei").toString()
      };
      
      // Safety check for multicall selector
      if (!multicallCalldata.startsWith("0xac9650d8")) {
        throw new Error("Invalid transaction data. Multicall selector missing.");
      }
      
      console.log("Sending transaction with direct 42-array approach...");
      notification.info("Sending transaction...");
      
      // Send the transaction
      const tx = await signer.sendTransaction(txOptions);
      
      console.log(`Transaction submitted successfully. Hash: ${tx.hash}`);
      notification.success(`Transaction submitted: ${tx.hash}`);
      setTxHash(tx.hash);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      console.log("Transaction receipt:", receipt);
      if (receipt && receipt.status === 1) {
        notification.success("Position created successfully!");
      } else {
        notification.error("Transaction failed on-chain.");
      }
    } catch (error: any) {
      console.error("Error in direct 42-array approach:", error);
      
      if (error.message) {
        if (error.message.includes("insufficient funds")) {
          notification.error("Insufficient funds for transaction");
        } else if (error.message.includes("user rejected")) {
          notification.error("Transaction rejected by user");
        } else {
          notification.error(error.message);
        }
      } else {
        notification.error("Failed to add liquidity. See console for details.");
      }
      
      throw error; // Re-throw to let the caller know this failed
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center mt-10 max-w-4xl mx-auto p-5 bg-gray-900 rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-white">Liquidity Pool Management</h1>
      
      {/* Contract Configuration Section */}
      <div className="w-full mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white">Contract Configuration</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Position Manager Address</span>
            </label>
            <input
              type="text"
              placeholder="Position Manager contract address"
              className={`w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${positionManagerData?.address ? 'opacity-80 cursor-not-allowed' : ''}`}
              value={positionManagerAddress}
              onChange={(e) => setPositionManagerAddress(e.target.value)}
              readOnly={!!positionManagerData?.address}
            />
            {positionManagerData?.address && (
              <p className="text-xs mt-1 text-green-400">✓ Position Manager loaded from contracts</p>
            )}
            {!positionManagerData?.address && isAddress(positionManagerAddress) && (
              <button
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                onClick={handleManuallySetPositionManager}
              >
                Register Position Manager
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Pool Configuration Section */}
      <div className="w-full mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white">Pool Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Token0</span>
              <span className="label-text-alt text-gray-400">
                <div className="form-control">
                  <label className="cursor-pointer label">
                    <span className="label-text mr-2 text-gray-400">Use Native Token</span> 
                    <input 
                      type="checkbox" 
                      className="toggle toggle-sm toggle-primary" 
                      checked={useNativeToken}
                      onChange={(e) => setUseNativeToken(e.target.checked)}
                    />
                  </label>
                </div>
              </span>
            </label>
            <input
              type="text"
              placeholder="Token0 address"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              value={token0Address}
              onChange={(e) => !useNativeToken && setToken0Address(e.target.value)}
              disabled={useNativeToken}
            />
            {useNativeToken && (
              <p className="text-xs mt-1 text-blue-400">Using native token (ETH)</p>
            )}
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Token1</span>
            </label>
            <input
              type="text"
              placeholder="Token1 address"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={token1Address}
              onChange={(e) => setToken1Address(e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Fee</span>
            </label>
            <select
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            >
              <option value="100">0.01%</option>
              <option value="500">0.05%</option>
              <option value="3000">0.3%</option>
              <option value="10000">1%</option>
            </select>
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Tick Spacing</span>
            </label>
            <input
              type="number"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={tickSpacing}
              disabled
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Hooks Address</span>
            </label>
            <input
              type="text"
              placeholder="Hooks address"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={hooksAddress}
              onChange={(e) => setHooksAddress(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">
            <span className="label-text text-gray-300">Initial Price (token1/token0)</span>
          </label>
          <input
            type="text"
            placeholder="Initial price"
            className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={initialPrice}
            onChange={(e) => setInitialPrice(e.target.value)}
          />
          <div className="text-xs mt-1 text-gray-400">
            SqrtPriceX96: {initialSqrtPriceX96}
          </div>
        </div>
      </div>
      
      {/* Step 2: Add Liquidity */}
      <div className="w-full mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white">Step 2: Add Liquidity</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Min Price</span>
            </label>
            <input
              type="text"
              placeholder="Minimum price"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <div className="text-xs mt-1 text-gray-400">
              Tick Lower: {tickLower}
            </div>
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Max Price</span>
            </label>
            <input
              type="text"
              placeholder="Maximum price"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
            <div className="text-xs mt-1 text-gray-400">
              Tick Upper: {tickUpper}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Liquidity Amount</span>
            </label>
            <input
              type="text"
              placeholder="Liquidity amount"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={liquidityAmount}
              onChange={(e) => setLiquidityAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Amount Token0</span>
            </label>
            <input
              type="text"
              placeholder="Amount of token0"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text text-gray-300">Amount Token1</span>
            </label>
            <input
              type="text"
              placeholder="Amount of token1"
              className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <button
            className={`px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-medium rounded-xl shadow-lg transition-all duration-200 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            onClick={handleAddLiquidity}
            disabled={
              isLoading || 
              !isConnected || 
              !hasPositionManager || 
              !liquidityAmount
            }
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="flex gap-1 mr-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                Adding Liquidity...
              </div>
            ) : 'Add Liquidity'}
          </button>
        </div>

        {/* Missing Requirements Indicators */}
        {isConnected && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 text-white">Requirements:</h3>
            <ul className="text-xs space-y-1">
              <li className={hasPositionManager ? 'text-green-400' : 'text-red-400'}>
                {hasPositionManager ? '✓' : '✗'} Position Manager Contract
              </li>
              <li className={!!liquidityAmount ? 'text-green-400' : 'text-red-400'}>
                {!!liquidityAmount ? '✓' : '✗'} Liquidity Amount Set
              </li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Transaction Status */}
      {txHash && (
        <div className="w-full p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-2 text-white">Transaction</h2>
          <div className="break-all font-mono text-blue-400">
            <a 
              href={`${targetNetwork.blockExplorers?.default.url}/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {txHash}
            </a>
          </div>
        </div>
      )}
      
      {/* Connect Wallet */}
      {!isConnected && (
        <div className="w-full mt-6 p-4 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg">
          <div className="flex items-center justify-between">
            <span>Please connect your wallet to continue</span>
            <button 
              className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white rounded-lg" 
              onClick={() => openAppKit()}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      )}
      
      {/* Contract Loading Status */}
      {!hasPositionManager && (
        <div className="w-full mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 text-gray-300">
          <h3 className="text-lg font-semibold mb-2 text-white">Contract Status</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li className={hasPositionManager ? 'text-green-400' : 'text-yellow-400'}>
              Position Manager: {hasPositionManager ? 'Loaded ✓' : 'Not loaded! Please enter a valid address.'}
            </li>
          </ul>
          <p className="mt-3 text-sm text-gray-400">
            You need to configure the Position Manager address to use all features.
          </p>
        </div>
      )}
    </div>
  );
}

// Add a detailed verification function to check the calldata structure
function verifyMulticallCalldata(calldata: string) {
  console.log("\n===== VERIFYING MULTICALL CALLDATA =====");
  
  // Check the function selector
  const selector = calldata.substring(0, 10);
  const expectedSelector = "0xac9650d8"; // multicall selector
  console.log(`Function selector: ${selector} ${selector === expectedSelector ? "✅" : "❌"}`);
  
  // The format should be:
  // - Function selector (4 bytes): 0xac9650d8
  // - Offset to data array (32 bytes)
  // - Array length (32 bytes)
  // - Then each element:
  //   - Offset to element (32 bytes)
  //   - Element length (32 bytes)
  //   - Element data (variable bytes)
  
  // Check the array offset
  const arrayOffset = parseInt(calldata.substring(10, 74), 16);
  console.log(`Array offset: ${arrayOffset} (${arrayOffset === 32 ? "✅" : "❌"})`);
  
  // Check array length (number of function calls)
  const arrayLengthHex = calldata.substring(74, 138);
  const arrayLength = parseInt(arrayLengthHex, 16);
  console.log(`Array length: ${arrayLength} calls ${arrayLength > 0 ? "✅" : "❌"}`);
  
  // Check if we have at least the two expected function calls
  if (arrayLength >= 2) {
    console.log("Found at least two function calls ✅");
    
    // First function offset
    const firstFunctionOffsetHex = calldata.substring(138, 202);
    const firstFunctionOffset = parseInt(firstFunctionOffsetHex, 16);
    console.log(`First function offset: ${firstFunctionOffset}`);
    
    // First function selector (should be initializePool)
    const firstFunctionPosition = 138 + firstFunctionOffset * 2;
    if (firstFunctionPosition + 8 <= calldata.length) {
      const firstFunctionSelector = calldata.substring(firstFunctionPosition, firstFunctionPosition + 8);
      const expectedInitializeSelector = "f7020405"; // initializePool selector without 0x
      console.log(`First function selector: 0x${firstFunctionSelector} ${firstFunctionSelector === expectedInitializeSelector ? "✅ (initializePool)" : "❌"}`);
    } else {
      console.log("First function data out of bounds ❌");
    }
    
    // Second function offset
    if (202 < calldata.length) {
      const secondFunctionOffsetHex = calldata.substring(202, 266);
      const secondFunctionOffset = parseInt(secondFunctionOffsetHex, 16);
      console.log(`Second function offset: ${secondFunctionOffset}`);
      
      // Second function selector (should be modifyLiquidities)
      const secondFunctionPosition = 138 + secondFunctionOffset * 2;
      if (secondFunctionPosition + 8 <= calldata.length) {
        const secondFunctionSelector = calldata.substring(secondFunctionPosition, secondFunctionPosition + 8);
        const expectedModifySelector = "dd46508f"; // modifyLiquidities selector without 0x
        console.log(`Second function selector: 0x${secondFunctionSelector} ${secondFunctionSelector === expectedModifySelector ? "✅ (modifyLiquidities)" : "❌"}`);
      } else {
        console.log("Second function data out of bounds ❌");
      }
    } else {
      console.log("Second function offset out of bounds ❌");
    }
  } else {
    console.log("Not enough function calls found ❌");
  }
  
  console.log("===== CALLDATA VERIFICATION COMPLETE =====\n");
}

// After the V4PositionPlanner class, add this validation function

/**
 * Validates the parameters for the modifyLiquidities call to ensure they are correctly formatted
 * @param actions The encoded actions bytes
 * @param params The parameters array
 * @returns true if valid, throws an error if invalid
 */
function validateModifyLiquiditiesParams(actions: string, params: any[]): boolean {
  // Ensure actions is a hex string
  if (!actions.startsWith('0x')) {
    throw new Error('Actions must be a hex string starting with 0x');
  }
  
  // Count the number of actions (each action is 1 byte)
  const actionCount = (actions.length - 2) / 2;
  
  // Check that params length matches action count
  if (params.length !== actionCount) {
    throw new Error(`Parameter count (${params.length}) doesn't match action count (${actionCount})`);
  }
  
  // Check for common encoding issues in each parameter
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    if (!param || !(typeof param === 'string' && param.startsWith('0x'))) {
      throw new Error(`Parameter ${i} is not properly encoded as a hex string`);
    }
    
    // Sanity check parameter length (should be at least 66 chars for most params)
    if (param.length < 10) {
      console.warn(`Warning: Parameter ${i} is very short (${param.length} chars), this might indicate an encoding issue`);
    }
  }
  
  return true;
}

// Add this function after the V4PositionPlanner class

/**
 * Validates the calldata for the multicall function to ensure it's correctly formatted
 * @param calldata The calldata to validate
 * @returns true if the calldata is valid, false otherwise
 */
function validateMulticallCalldata(calldata: string): boolean {
  // Basic validations
  if (!calldata) {
    console.error("Calldata is empty or undefined");
    return false;
  }
  
  if (!calldata.startsWith("0xac9650d8")) {
    console.error("Calldata does not start with the multicall selector 0xac9650d8");
    return false;
  }
  
  try {
    // Create an interface for the multicall function
    const multicallInterface = new ethers.Interface([
      "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)"
    ]);
    
    // Try to decode the function data
    const decodedData = multicallInterface.decodeFunctionData("multicall", calldata);
    
    // Verify the decoded array exists and has contents
    const callArray = decodedData[0];
    if (!callArray || !Array.isArray(callArray) || callArray.length === 0) {
      console.error("Decoded calldata does not contain a valid array");
      return false;
    }
    
    console.log(`Validated multicall calldata with ${callArray.length} function calls`);
    
    // Check for required function calls
    let hasInitializePool = false;
    let hasModifyLiquidities = false;
    
    for (const call of callArray) {
      // Make sure each call is a valid hex string
      if (typeof call !== "string" || !call.startsWith("0x")) {
        console.error("Invalid call in array:", call);
        return false;
      }
      
      if (call.startsWith("0xf7020405")) { // initializePool selector
        hasInitializePool = true;
      } else if (call.startsWith("0xdd46508f")) { // modifyLiquidities selector
        hasModifyLiquidities = true;
      }
    }
    
    console.log(`Calldata contains: InitializePool=${hasInitializePool}, ModifyLiquidities=${hasModifyLiquidities}`);
    
    // Validation successful
    return true;
  } catch (error) {
    console.error("Failed to decode multicall calldata:", error);
    return false;
  }
}

// Now update the handleAddLiquidity function to use this validation