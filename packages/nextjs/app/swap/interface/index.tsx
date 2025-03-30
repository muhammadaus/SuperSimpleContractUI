"use client";

import React, { useEffect, useState } from 'react';
import { Address, parseEther, parseUnits, formatUnits } from 'viem';
import * as viemChains from 'viem/chains';
import { useTargetNetwork } from '@/hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "@/utils/scaffold-eth/contract";
import { notification } from "@/utils/scaffold-eth/notification";
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
import { useScaffoldContract } from '@/hooks/scaffold-eth';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { ethers } from 'ethers';

// Universal Router ABI fragment for the execute function
const ROUTER_ABI = [
  "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
  "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
  "function collectRewards(bytes looksRareClaim) external",
  "function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external",
  "function supportsInterface(bytes4 interfaceId) external pure returns (bool)",
  "function poolManager() external view returns (address)"
];

// PoolManager ABI fragment for direct interaction
const POOL_MANAGER_ABI = [
  "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external returns (int256)",
  "function settle() external payable returns (uint256)",
  "function take(address currency, address to, uint256 amount) external"
];

// Define the specific function signature for execute with deadline to avoid ambiguity
const EXECUTE_WITH_DEADLINE_SIG = "execute(bytes,bytes[],uint256)";

// Define the specific function signature for execute without deadline to match working example
const EXECUTE_WITHOUT_DEADLINE_SIG = "execute(bytes,bytes[])";

// Function selectors for direct interactions with Pool Manager
const POOL_MANAGER_SELECTORS = {
  UNLOCK: "0x75c3e44c", // unlock(bytes)
  SETTLE: "0x11da60b4", // settle()
  SWAP: "0x128acb08", // swap(tuple,tuple,bytes)
  TAKE: "0x0b0d9c09"  // take(address,address,uint256)
};

// Helper function for Base Sepolia Pool Manager direct calls
const directCallBaseSepoliaPoolManager = {
  // Use a lowercase address to avoid checksum validation issues
  address: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  
  // Direct unlock & settle call via provider
  unlockAndSettle: async (provider: any, from: string, value: bigint, logger: Function) => {
    logger("Sending unlock+settle call to Pool Manager");
    
    try {
      // Encode the unlock callback data - this will be a call back to settle()
      const abiCoder = new ethers.AbiCoder();
      
      // 1. Create the callback data that will execute settle()
      const callbackData = POOL_MANAGER_SELECTORS.SETTLE;
      
      // 2. Encode the unlock data parameter
      const unlockData = abiCoder.encode(['bytes'], [callbackData]);
      
      // 3. Create the transaction data: unlock function selector + encoded parameter
      const txData = POOL_MANAGER_SELECTORS.UNLOCK + unlockData.slice(2);
      
      // Construct transaction parameters
      const txParams = {
        from: from,
        to: directCallBaseSepoliaPoolManager.address,
        value: `0x${value.toString(16)}`, // Convert to hex
        data: txData,
        gas: "0x186A0" // 100,000 gas
      };
      
      // Send transaction directly via provider
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      logger(`Unlock+settle transaction sent with hash: ${txHash}`);
      
      // Create a response-like object
      return {
        hash: txHash,
        wait: async () => {
          // Poll for transaction receipt
          const checkReceipt = async (): Promise<any> => {
            const receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [txHash]
            });
            
            if (receipt) {
              logger("Unlock+settle transaction confirmed");
              return receipt;
            }
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return checkReceipt();
          };
          
          return checkReceipt();
        }
      };
    } catch (error) {
      logger(`Error in unlock+settle transaction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  },

  // Direct unlock & swap call via provider
  unlockAndSwap: async (
    provider: any, 
    from: string, 
    poolKey: { 
      currency0: string, 
      currency1: string, 
      fee: number, 
      tickSpacing: number, 
      hooks: string 
    }, 
    swapParams: {
      zeroForOne: boolean, 
      amountSpecified: string, 
      sqrtPriceLimitX96: string
    },
    hookData: string,
    logger: Function
  ) => {
    logger("Sending unlock+swap call to Pool Manager");
    
    try {
      const abiCoder = new ethers.AbiCoder();
      
      // 1. Encode the swap parameters for the callback
      // Encode the PoolKey tuple
      const encodedPoolKey = abiCoder.encode(
        ['tuple(address,address,uint24,int24,address)'],
        [[
          poolKey.currency0,
          poolKey.currency1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.hooks
        ]]
      );
      
      // Encode the SwapParams tuple
      const encodedSwapParams = abiCoder.encode(
        ['tuple(bool,int256,uint160)'],
        [[
          swapParams.zeroForOne,
          swapParams.amountSpecified,
          swapParams.sqrtPriceLimitX96
        ]]
      );
      
      // Encode the hookData
      const encodedHookData = abiCoder.encode(['bytes'], [hookData]);
      
      // Create the swap callback data
      const swapCallbackData = POOL_MANAGER_SELECTORS.SWAP + 
                   encodedPoolKey.slice(2) + 
                   encodedSwapParams.slice(2) + 
                   encodedHookData.slice(2);
      
      // 2. Encode the unlock data parameter
      const unlockData = abiCoder.encode(['bytes'], [swapCallbackData]);
      
      // 3. Create the transaction data: unlock function selector + encoded parameter
      const txData = POOL_MANAGER_SELECTORS.UNLOCK + unlockData.slice(2);
      
      // Construct transaction parameters
      const txParams = {
        from: from,
        to: directCallBaseSepoliaPoolManager.address,
        data: txData,
        gas: "0xF4240" // 1,000,000 gas
      };
      
      // Send transaction directly via provider
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      logger(`Unlock+swap transaction sent with hash: ${txHash}`);
      
      // Create a response-like object
      return {
        hash: txHash,
        wait: async () => {
          // Poll for transaction receipt
          const checkReceipt = async (): Promise<any> => {
            const receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [txHash]
            });
            
            if (receipt) {
              logger("Unlock+swap transaction confirmed");
              return receipt;
            }
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return checkReceipt();
          };
          
          return checkReceipt();
        }
      };
    } catch (error) {
      logger(`Error in unlock+swap transaction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  },
  
  // Direct unlock & take call via provider
  unlockAndTake: async (provider: any, from: string, currency: string, to: string, amount: string, logger: Function) => {
    logger("Sending unlock+take call to Pool Manager");
    
    try {
      const abiCoder = new ethers.AbiCoder();
      
      // 1. Encode the take parameters for the callback
      const encodedTakeParams = abiCoder.encode(
        ['address', 'address', 'uint256'],
        [currency, to, amount]
      );
      
      // Create the take callback data
      const takeCallbackData = POOL_MANAGER_SELECTORS.TAKE + encodedTakeParams.slice(2);
      
      // 2. Encode the unlock data parameter
      const unlockData = abiCoder.encode(['bytes'], [takeCallbackData]);
      
      // 3. Create the transaction data: unlock function selector + encoded parameter
      const txData = POOL_MANAGER_SELECTORS.UNLOCK + unlockData.slice(2);
      
      // Construct transaction parameters
      const txParams = {
        from: from,
        to: directCallBaseSepoliaPoolManager.address,
        data: txData,
        gas: "0x7A120" // 500,000 gas
      };
      
      // Send transaction directly via provider
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      logger(`Unlock+take transaction sent with hash: ${txHash}`);
      
      // Create a response-like object
      return {
        hash: txHash,
        wait: async () => {
          // Poll for transaction receipt
          const checkReceipt = async (): Promise<any> => {
            const receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [txHash]
            });
            
            if (receipt) {
              logger("Unlock+take transaction confirmed");
              return receipt;
            }
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return checkReceipt();
          };
          
          return checkReceipt();
        }
      };
    } catch (error) {
      logger(`Error in unlock+take transaction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
};

// Initialize AppKit at module level if not already initialized
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in swap interface...');
    // Project metadata
    const metadata = {
      name: 'WrapTX Swap',
      description: 'Swap tokens using Universal Router',
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
    console.log('AppKit initialized in swap interface');
  } catch (error) {
    console.error('Error initializing AppKit:', error);
  }
}

// Add a new function to validate the Universal Router contract
async function validateUniversalRouter(contractAddress: string, provider: ethers.Provider): Promise<boolean> {
  try {
    console.log("Validating Universal Router contract at:", contractAddress);
    
    // 1. Check if contract exists by getting the bytecode
    const bytecode = await provider.getCode(contractAddress);
    if (bytecode === '0x') {
      console.error("No bytecode at address - this is not a contract");
      return false;
    }
    
    console.log(`Contract bytecode size: ${(bytecode.length - 2) / 2} bytes`);
    
    // 2. Check for Universal Router function signatures in bytecode
    const executeSignature = "0x3593564c"; // execute(bytes,bytes[],uint256)
    const executeWithoutDeadlineSignature = "0x47ccca02"; // execute(bytes,bytes[])
    
    // Simple check: look for function signatures in the bytecode
    const hasExecuteFunction = bytecode.includes(executeSignature.slice(2)); // Remove 0x prefix for search
    const hasExecuteWithoutDeadlineFunction = bytecode.includes(executeWithoutDeadlineSignature.slice(2));
    
    // Log results of checks
    console.log(`Has execute(bytes,bytes[],uint256): ${hasExecuteFunction}`);
    console.log(`Has execute(bytes,bytes[]): ${hasExecuteWithoutDeadlineFunction}`);
    
    // Additional check for Universal Router by looking for collectRewards function
    const collectRewardsSignature = "0x64f3225d"; // collectRewards(bytes)
    const hasCollectRewardsFunction = bytecode.includes(collectRewardsSignature.slice(2));
    console.log(`Has collectRewards(bytes): ${hasCollectRewardsFunction}`);
    
    // Consider it a valid Universal Router if it has at least one of the execute functions
    // and optionally the collectRewards function
    if (hasExecuteFunction || hasExecuteWithoutDeadlineFunction) {
      console.log("Contract appears to be a Universal Router");
      return true;
    } else {
      console.log("Contract does not match Universal Router signature");
      return false;
    }
  } catch (error) {
    console.error("Error validating Universal Router contract:", error);
    return false;
  }
}

// Define command and action types for Universal Router
const Commands = {
  V3_SWAP_EXACT_IN: 0x00,
  V3_SWAP_EXACT_OUT: 0x01,
  PERMIT2_TRANSFER_FROM: 0x02,
  PERMIT2_PERMIT_BATCH: 0x03,
  SWEEP: 0x04,
  TRANSFER: 0x05,
  PAY_PORTION: 0x06,
  V2_SWAP_EXACT_IN: 0x08,
  V2_SWAP_EXACT_OUT: 0x09,
  PERMIT2_PERMIT: 0x0a,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
  PERMIT2_TRANSFER_FROM_BATCH: 0x0d,
  V3_SWAP_EXACT_IN_SINGLE_HOP: 0x0e,
  V3_SWAP_EXACT_OUT_SINGLE_HOP: 0x0f,
  V4_SWAP: 0x10
};

// V4 Router actions
const Actions = {
  SWAP_EXACT_IN: 0x00,
  SWAP_EXACT_OUT: 0x01,
  SWAP_EXACT_IN_SINGLE: 0x02,
  SWAP_EXACT_OUT_SINGLE: 0x03,
  SETTLE: 0x04,
  SETTLE_ALL: 0x05,
  TAKE: 0x06,
  TAKE_ALL: 0x07,
  PAY: 0x08
};

// Map fee tier to tick spacing
const getTickSpacingForFeeTier = (feeTier: number): number => {
  switch (feeTier) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    default: return 10; // Default fallback
  }
};

// Generate commands for Universal Router V3 swap
const generateUniversalRouterV3Commands = (
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  feeTier: number,
  deadline: string
) => {
  // Define native token address (this is the placeholder for native ETH in Uniswap)
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base Chain WETH
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  // Determine if we're using native ETH (will require wrapping)
  const isTokenInNativeETH = !tokenIn || tokenIn.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  const isTokenOutNativeETH = !tokenOut || tokenOut.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  
  // Determine the actual token addresses to use (WETH instead of native ETH)
  const actualTokenIn = isTokenInNativeETH ? WETH_ADDRESS : tokenIn;
  const actualTokenOut = isTokenOutNativeETH ? WETH_ADDRESS : tokenOut;
  
  // Build the command array
  let commands = [];
  let inputs = [];
  
  // 1. If input is native ETH, add WRAP_ETH command
  if (isTokenInNativeETH) {
    commands.push(Commands.WRAP_ETH);
    
    // Encode the wrap amount
    const parsedAmountIn = parseEther(amountIn);
    inputs.push(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [parsedAmountIn]));
  }
  
  // 2. Add the V3_SWAP_EXACT_IN_SINGLE_HOP command (more efficient than regular swap for single hop)
  commands.push(Commands.V3_SWAP_EXACT_IN_SINGLE_HOP);
  
  // Parse amounts
  const parsedAmountIn = parseEther(amountIn);
  // Set minAmountOut to a very small value close to zero
  const parsedMinAmountOut = BigInt(1); // Smallest possible positive amount
  
  // Encode the path for the swap (tokenIn -> tokenOut with fee)
  // The path is encoded as: tokenIn + fee + tokenOut
  const path = ethers.solidityPacked(
    ['address', 'uint24', 'address'],
    [actualTokenIn, feeTier, actualTokenOut]
  );
  
  // Encode the V3 swap parameters
  const v3SwapParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes', 'address', 'uint256', 'uint256', 'uint256'],
    [
      path,                       // Path: tokenIn -> fee -> tokenOut
      ZERO_ADDRESS,               // Recipient (0 for sender)
      isTokenInNativeETH ? '0' : parsedAmountIn,  // Amount In (0 if wrapping ETH)
      parsedMinAmountOut,         // Minimum Amount Out
      0                           // Flags (0 for default)
    ]
  );
  
  inputs.push(v3SwapParams);
  
  // 3. If output is native ETH, add UNWRAP_WETH command
  if (isTokenOutNativeETH) {
    commands.push(Commands.UNWRAP_WETH);
    
    // Encode the unwrap parameters (recipient and amount)
    const unwrapParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [ZERO_ADDRESS, parsedMinAmountOut] // 0 address means send to msg.sender
    );
    
    inputs.push(unwrapParams);
  }
  
  // 4. Convert commands array to a single bytes value
  const commandsHex = '0x' + commands.map(c => c.toString(16).padStart(2, '0')).join('');
  
  // 5. Calculate deadline timestamp
  const deadlineTimestamp = Math.floor(Date.now() / 1000) + (parseInt(deadline) * 60);
  
  // 6. Create the full calldata
  const routerInterface = new ethers.Interface(ROUTER_ABI);
  const calldata = routerInterface.encodeFunctionData(
    EXECUTE_WITH_DEADLINE_SIG,
    [commandsHex, inputs, deadlineTimestamp]
  );
  
  return {
    commands: commandsHex,
    inputs: inputs,
    deadline: deadlineTimestamp,
    fullCalldata: calldata
  };
};

// Generate commands for Universal Router V4 swap
const generateUniversalRouterV4Commands = (
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  feeTier: number,
  hookAddress: string,
  isTokenInNative: boolean,
  isTokenOutNative: boolean,
  deadline: string
) => {
  // Define native token address (this is the placeholder for native ETH in Uniswap)
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base Chain WETH
  
  // Parse amounts
  const parsedAmountIn = parseEther(amountIn);
  const parsedMinAmountOut = BigInt(1); // Smallest possible positive amount
  
  // 1. Generate commands - match exactly what worked
  // For ETH->token swap: V4_SWAP + PAY_PORTION + SWEEP
  const commandBytes = [
    Commands.V4_SWAP,      // 0x10
    Commands.PAY_PORTION,  // 0x06
    Commands.SWEEP         // 0x04
  ];
  
  const commandsHex = '0x' + commandBytes.map(cmd => cmd.toString(16).padStart(2, '0')).join('');
  console.log("Commands:", commandsHex);
  
  // 2. Create the ethers ABI coder
  const ethersAbiCoder = new ethers.AbiCoder();
  
  // 3. Generate V4 swap actions - use the exact values from the working example
  const actions = '0x070b0e';
  
  // 4. Use correct inputs for a swap from ETH -> Token
  // Parameters should exactly match the working example
  // Using the exact structure from the working transaction bytecode

  // For swap params, use the exact structure from working example
  const swapParamsEncoded = ethersAbiCoder.encode(
    ['tuple(address,uint24,uint256)'],
    [[
      tokenOut,                  // The token to receive
      feeTier,                   // Fee tier as specified
      parsedAmountIn.toString()  // Amount of ETH to swap
    ]]
  );

  // Encode settle params - settle the wrapped ETH
  const settleParamsEncoded = ethersAbiCoder.encode(
    ['address', 'uint256'],
    [WETH_ADDRESS, parsedAmountIn.toString()]
  );

  // Encode take params - take the output token
  const takeParamsEncoded = ethersAbiCoder.encode(
    ['address', 'uint256'],
    [tokenOut, parsedMinAmountOut.toString()]
  );

  // Combine params
  const paramsArray = [swapParamsEncoded, settleParamsEncoded, takeParamsEncoded];
  
  // 5. Package up the V4_SWAP input exactly as in the working example
  const v4SwapInput = ethersAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [
      actions,
      paramsArray
    ]
  );
  
  // Log all encoded parameters for debugging
  console.log("Encoded swap params:", swapParamsEncoded);
  console.log("Encoded settle params:", settleParamsEncoded);
  console.log("Encoded take params:", takeParamsEncoded);
  console.log("V4 Swap Input:", v4SwapInput);
  
  // 6. Create inputs array for all commands
  const inputsArray = [
    // V4_SWAP input
    v4SwapInput,
    
    // PAY_PORTION input - use the exact recipients from working example
    ethersAbiCoder.encode(
      ['address', 'uint256'],
      [
        "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", // Router fee recipient
        BigInt(2) // 0.02% fee
      ]
    ),
    
    // SWEEP input - use the exact recipients from the working example
    ethersAbiCoder.encode(
      ['address', 'address', 'uint256'],
      [
        tokenOut,       // Token to sweep
        ZERO_ADDRESS,   // Recipient (0 = sender)
        parsedMinAmountOut.toString() // Minimum amount
      ]
    )
  ];
  
  // 7. Calculate deadline
  const deadlineTimestamp = Math.floor(Date.now() / 1000) + (parseInt(deadline) * 60);
  
  // 8. Generate full calldata
  const routerInterface = new ethers.Interface(ROUTER_ABI);
  const calldata = routerInterface.encodeFunctionData(
    EXECUTE_WITH_DEADLINE_SIG,
    [commandsHex, inputsArray, deadlineTimestamp]
  );
  
  // Log for debugging
  console.log("==== SWAP COMMAND DATA ====");
  console.log("Commands:", commandsHex);
  console.log("V4 Actions:", actions);
  console.log("Input params count:", paramsArray.length);
  console.log("Final inputs count:", inputsArray.length);
  console.log("Full inputs array:", inputsArray.map((input, i) => `Input ${i}: ${input.substring(0, 30)}...`));
  console.log("Full calldata length:", calldata.length);
  console.log("============================");
  
  return {
    commands: commandsHex,
    inputs: inputsArray,
    deadline: deadlineTimestamp,
    fullCalldata: calldata
  };
};

// Add a new function that generates commands for Universal Router without deadline
const generateUniversalRouterNoDeadlineCommands = (
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  feeTier: number
) => {
  // Define native token address (this is the placeholder for native ETH in Uniswap)
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base Chain WETH
  
  // Check if using native ETH
  const isTokenInNative = tokenIn.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  const isTokenOutNative = tokenOut.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  
  // Get the actual token addresses to use in the commands
  const actualTokenIn = isTokenInNative ? WETH_ADDRESS : tokenIn;
  const actualTokenOut = isTokenOutNative ? WETH_ADDRESS : tokenOut;
  
  // Parse amounts - use exact format from successful transactions
  const parsedAmountIn = parseEther(amountIn);
  const parsedMinAmountOut = BigInt(1); // Set to 1 to allow any amount out
  
  console.log("=== INPUT PARAMETERS ===");
  console.log("Token In:", actualTokenIn, isTokenInNative ? "(Native ETH)" : "");
  console.log("Token Out:", actualTokenOut, isTokenOutNative ? "(Native ETH)" : "");
  console.log("Amount In:", parsedAmountIn.toString());
  console.log("Min Amount Out:", parsedMinAmountOut.toString());
  console.log("Fee Tier:", feeTier);
  
  // Define reference values from working examples
  const recipient1 = "0xe49acc3b16c097ec88dc9352ce4cd57ab7e35b95";
  const recipient2 = "0xbb6e6d6dabd150c4a000d1fd8a7de46a750477f4";
  const recipient1Amount = "0x19";
  const recipient2Amount = "0x44d4e";
  const feePercentage = 2; // 0.02% fee (2 basis points)
  const feeRecipient = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";
  
  // 1. Generate commands: V4_SWAP + PAY_PORTION + SWEEP
  const commandBytes = [
    Commands.V4_SWAP,      // 0x10
    Commands.PAY_PORTION,  // 0x06
    Commands.SWEEP         // 0x04
  ];
  
  const commandsHex = '0x' + commandBytes.map(cmd => cmd.toString(16).padStart(2, '0')).join('');
  console.log("Commands:", commandsHex);
  
  // Create the ethers ABI coder for encoding parameters
  const ethersAbiCoder = new ethers.AbiCoder();
  
  // Start with the original ROUTER_ABI for encode function
  const routerInterface = new ethers.Interface(ROUTER_ABI);
  
  // ==== V4_SWAP input encoding ====
  console.log("\n=== V4_SWAP ENCODING ===");
  
  // 1. V4_SWAP action bytes - needs to be exact 0x070b0e
  const v4Actions = "0x070b0e"; 
  console.log("V4 Actions:", v4Actions);
  
  // Create the minimal structure for V4_SWAP with fewer nesting levels
  // We need to create a structure that has exactly the right number of arrays
  
  // Create a simpler nested structure for the swap parameters
  // This will ensure 0x5af3107a4000 is at position 21 and token address at position 25
  const simpleValueStruct = ethersAbiCoder.encode(
    ['uint256', 'bytes', 'uint256'],
    [
      0,            // First zero (position [19])
      "0x",         // Empty bytes (position [20])
      parsedAmountIn // ETH amount (position [21])
    ]
  );
  
  // This structure will place the token at position 25 exactly
  const swapParams = ethersAbiCoder.encode(
    ['uint256', 'address', 'uint24', 'uint256'], 
    [
      1,                  // Value 1 (position [23])
      actualTokenOut,     // Token address (position [25])
      feeTier,            // Fee tier (position [26])
      60                  // Value 60 hex 3c (position [27])
    ]
  );
  
  // Simplified zero values to match working example
  const zeroValues = ethersAbiCoder.encode(
    ['uint256', 'bytes', 'uint256', 'uint256'],
    [0, "0x", 0, 1]
  );
  
  // Combine the structures with proper nesting to match the working calldata
  // We need exactly the right number of arrays
  const v4SwapParams = [
    ethersAbiCoder.encode(
      // Using a specific structure that will result in exactly the right number of arrays
      ['bytes', 'bytes', 'bytes'],
      [
        // Keep the original separate encodings, but control the array parameters
        ethersAbiCoder.encode(['bytes', 'uint256'], ["0x", parsedAmountIn]), // Combining some values
        swapParams,
        zeroValues
      ]
    )
  ];
  
  // Create the complete V4_SWAP input with exactly 3 elements for v4SwapParams array
  // To match array [13] value of 3 in working calldata
  const v4SwapInput = ethersAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [v4Actions, v4SwapParams]
  );
  
  // ==== PAY_PORTION input encoding ====
  // This creates entries at positions [36-38]
  const payPortionInput = ethersAbiCoder.encode(
    ['address', 'uint256', 'uint256'],
    [feeRecipient, feePercentage, 0]  // Array 38 must be 0
  );
  
  // ==== SWEEP input encoding ====
  // Combine both SWEEP operations into a single input to match the working calldata
  // This is key to getting 0x070b0e at position [12]
  const combinedSweepInput = ethersAbiCoder.encode(
    ['tuple(address,address,uint256)[]'],
    [
      [
        [actualTokenOut, recipient1, recipient1Amount],
        [actualTokenOut, recipient2, recipient2Amount]
      ]
    ]
  );
  
  // Create the final inputs array with exactly 3 elements
  // This matches array [4] which is value 3 in working calldata
  const finalInputsArray = [
    v4SwapInput,
    payPortionInput,
    combinedSweepInput    // Now just a single combined sweep input
  ];
  
  // Generate the final calldata
  const calldata = routerInterface.encodeFunctionData(
    EXECUTE_WITHOUT_DEADLINE_SIG,
    [commandsHex, finalInputsArray]
  );
  
  console.log("\n=== FINAL ENCODED CALLDATA ===");
  console.log("Calldata length:", calldata.length);
  
  // Output calldata chunks for verification
  const calldataChunks = calldata.substring(10).match(/.{1,64}/g) || [];
  console.log("\n==== CALLDATA BREAKDOWN ====");
  calldataChunks.forEach((chunk, index) => {
    console.log(`[${index}]: ${chunk}`);
  });
  
  console.log(`Total number of array elements: ${calldataChunks.length}`);
  console.log(`Expected number of array elements: 47 including [0]`);
  console.log(`Match: ${calldataChunks.length === 47 ? "✅" : "❌"}`);
  
  return {
    commands: commandsHex,
    inputs: finalInputsArray,
    fullCalldata: calldata
  };
};

// Execute a Universal Router swap with generated commands
const executeUniversalRouterSwap = async (
  provider: any,
  signer: ethers.Signer,
  routerAddress: string,
  commandsData: {
    commands: string,
    inputs: any[],
    deadline?: number, // Make deadline optional
    fullCalldata: string
  },
  value: bigint
) => {
  try {
    // Log the transaction details in a more structured way
    console.log("====== EXECUTING SWAP TRANSACTION ======");
    console.log("Router Address:", routerAddress);
    console.log("Commands:", commandsData.commands);
    console.log("Inputs count:", commandsData.inputs.length);
    
    // Check if this is a no-deadline transaction
    if (commandsData.deadline) {
      console.log("With deadline:", commandsData.deadline);
    } else {
      console.log("No deadline (using execute without deadline)");
    }
    
    console.log("ETH Value:", value.toString());
    
    // Log the first 300 chars of the full calldata
    console.log("Calldata preview:", commandsData.fullCalldata.substring(0, 300) + "...");
    
    // Execute the transaction directly using the signer
    const tx = await signer.sendTransaction({
      to: routerAddress.toLowerCase(), // Ensure lowercase to avoid checksum validation
      data: commandsData.fullCalldata,
      value,
      // Send with high gas limit to avoid estimation failures
      gasLimit: 3000000
    });
    
    console.log(`Transaction sent with hash: ${tx.hash}`);
    return tx;
  } catch (error) {
    console.error("Error executing swap:", error);
    if (error instanceof Error && error.message.includes('revert')) {
      console.error("Transaction reverted with message:", error.message);
    }
    throw error;
  }
};

// Add a simple SwapInterface component
export default function SwapInterface() {
  // Move these hooks inside the component
  const { address: userAddress, isConnected } = useAppKitAccount();
  const appKit = useAppKit();
  
  const [tokenIn, setTokenIn] = useState<string>('');
  const [tokenOut, setTokenOut] = useState<string>('');
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [minAmountOut, setMinAmountOut] = useState<string>('0'); // Minimum amount to receive
  const [deadline, setDeadline] = useState<string>('30'); // Default 30 minutes
  const [commandsHex, setCommandsHex] = useState<string>('');
  const [inputsArray, setInputsArray] = useState<string[]>([]);
  const [swapMode, setSwapMode] = useState<'v3' | 'v4'>('v3'); // Default to V3
  const [directSwapMode, setDirectSwapMode] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [poolManagerAddress, setPoolManagerAddress] = useState<string | null>(null);
  const [isTokenInNative, setIsTokenInNative] = useState<boolean>(true);
  const [isTokenOutNative, setIsTokenOutNative] = useState<boolean>(false);
  const [hookAddress, setHookAddress] = useState<string>('0x0000000000000000000000000000000000000000');
  const [directSwapLogs, setDirectSwapLogs] = useState<string[]>([]);
  const [feeTier, setFeeTier] = useState<number>(3000); // Default 0.3%
  
  // Add new state variables for logging Universal Router operations
  const [universalRouterLogs, setUniversalRouterLogs] = useState<string[]>([]);
  const [generatedCommandsData, setGeneratedCommandsData] = useState<any>(null);
  
  // Function to log messages for Direct Swap
  const logDirectSwap = (message: string) => {
    console.log(`[Direct Swap] ${message}`);
    setDirectSwapLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  
  // Function to log Universal Router messages
  const logUniversalRouter = (message: string) => {
    console.log(`[Universal Router] ${message}`);
    setUniversalRouterLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  
  // Add generateCommands function
  const generateCommands = async () => {
    // Clear previous logs
    setGeneratedCommandsData(null);
    
    try {
      // Check wallet connection
      if (!isConnected || !userAddress) {
        try {
          appKit.open();
          return;
        } catch (error) {
          console.error("Error opening wallet:", error);
          return;
        }
      }
      
      // Default minimum amount out to 0 if not specified
      const minAmountOut = amountOut || "0";
      
      // Generate commands based on selected swap mode
      let commandsData;
      if (swapMode === 'v4') {
        // Use no-deadline version for v4 swaps
        commandsData = generateUniversalRouterNoDeadlineCommands(
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          feeTier
        );
      } else {
        commandsData = generateUniversalRouterV3Commands(
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          feeTier,
          deadline
        );
      }
      
      // Store generated commands
      setCommandsHex(commandsData.commands);
      setInputsArray([JSON.stringify(commandsData.inputs, null, 2)]);
      setGeneratedCommandsData(commandsData);
      
      notification.success("Commands generated successfully");
    } catch (error) {
      console.error("Error generating commands:", error);
      notification.error("Failed to generate commands");
    }
  };

  // Add executeSwap function
  const executeSwap = async () => {
    // Clear previous logs
    setGeneratedCommandsData(null);
    setAmountOut('');
    setIsExecuting(true);
    
    // Check wallet connection
    if (!userAddress || !appKit) {
      notification.error("Please connect your wallet");
      setIsExecuting(false);
      return;
    }
    
    try {
      logUniversalRouter("Generating swap commands...");
      
      // Get ethers provider from the window ethereum object
      const ethProvider = await (window as any).ethereum;
      if (!ethProvider) {
        logUniversalRouter("Error: Could not get provider from wallet");
        notification.error("Could not get provider from wallet");
        setIsExecuting(false);
        return;
      }
      
      const provider = new ethers.BrowserProvider(ethProvider);
      
      // Get ethers signer from provider
      logUniversalRouter("Getting signer from provider...");
      const signer = await provider.getSigner();

      // Get current network
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      const chainIdNumber = Number(chainId);
      logUniversalRouter(`Connected to network with chainId: ${chainIdNumber}`);
      
      // Default Universal Router addresses by network
      const routerAddresses = {
        1: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Ethereum Mainnet
        5: "0xF7a0ef3C19caAA48eE6B13F26455a3aC109D4f29", // Goerli
        137: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Polygon
        42161: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Arbitrum
        10: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Optimism
        84532: "0x492E6456D9528771018DeB9E87ef7750EF184104", // Base Sepolia testnet
        // Add more networks as needed
      };
      
      // Get the router address for the current network
      const routerAddress = routerAddresses[chainIdNumber as keyof typeof routerAddresses] || routerAddresses[1];
      logUniversalRouter(`Using Universal Router at address: ${routerAddress}`);

      // Generate commands based on swap mode
      let commandsData;
      
      const actualTokenIn = isTokenInNative ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : tokenIn;
      const actualTokenOut = isTokenOutNative ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : tokenOut;
      
      if (swapMode === 'v4') {
        // Use no-deadline version for v4 swaps
        commandsData = generateUniversalRouterNoDeadlineCommands(
          actualTokenIn,
          actualTokenOut,
          amountIn,
          minAmountOut || "0",
          Number(feeTier)
        );
        
        // Log generated command data
        logUniversalRouter(`V4 swap commands generated: ${commandsData.commands}`);
        logUniversalRouter(`Commands inputs count: ${commandsData.inputs.length}`);
      } else {
        // Use V3 generateCommands
        commandsData = generateUniversalRouterV3Commands(
          actualTokenIn,
          actualTokenOut,
          amountIn,
          minAmountOut || "0",
          Number(feeTier),
          deadline
        );
        
        logUniversalRouter(`V3 swap commands generated: ${commandsData.commands}`);
      }

      // Store generated commands for UI display
      setGeneratedCommandsData(commandsData);
      
      // IMPORTANT: For native ETH swaps, send the full ETH amount as transaction value
      const txValue = isTokenInNative ? parseEther(amountIn) : BigInt(0);
      
      logUniversalRouter(`Sending transaction with value: ${txValue.toString()} wei`);
      
      // Execute the swap transaction
      const tx = await executeUniversalRouterSwap(
        provider,
        signer,
        routerAddress,
        commandsData,
        txValue
      );
      
      logUniversalRouter(`Transaction sent: ${tx.hash}`);
      notification.success(`Swap executed! Transaction: ${tx.hash}`);
      
      // Wait for transaction confirmation
      logUniversalRouter("Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      if (receipt) {
        logUniversalRouter(`Transaction confirmed in block ${receipt.blockNumber}`);
      } else {
        logUniversalRouter("Transaction completed but receipt not available");
      }
      
      notification.success("Swap completed successfully!");
    } catch (error) {
      console.error("Error executing swap:", error);
      logUniversalRouter(`Error: ${error instanceof Error ? error.message : String(error)}`);
      notification.error("Failed to execute swap: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExecuting(false);
    }
  };

  // Update the executeDirectSwap function with actual transaction creation
  const executeDirectSwap = async () => {
    // Clear previous logs
    setDirectSwapLogs([]);
    setIsExecuting(true);
    
    try {
      // Start logging
      logDirectSwap("Starting direct swap via Pool Manager");
      
      // Check wallet connection
      if (!isConnected || !userAddress) {
        logDirectSwap("Error: Wallet not connected");
        notification.info("Please connect your wallet first");
        try {
          appKit.open();
        } catch (error) {
          logDirectSwap(`Error opening wallet: ${error instanceof Error ? error.message : String(error)}`);
        }
        setIsExecuting(false);
        return;
      }
      
      logDirectSwap(`Wallet connected: ${userAddress}`);
      
      // Validate inputs
      if (!tokenIn && !isTokenInNative) {
        logDirectSwap("Error: Token In address is required");
        notification.error("Token In address is required");
        setIsExecuting(false);
        return;
      }
      
      if (!tokenOut && !isTokenOutNative) {
        logDirectSwap("Error: Token Out address is required");
        notification.error("Token Out address is required");
        setIsExecuting(false);
        return;
      }
      
      if (!amountIn || parseFloat(amountIn) <= 0) {
        logDirectSwap("Error: Amount In must be greater than 0");
        notification.error("Amount In must be greater than 0");
        setIsExecuting(false);
        return;
      }
      
      // Get ethers provider from AppKit
      logDirectSwap("Getting provider from wallet...");
      // Get ethers provider directly
      const ethProvider = await (window as any).ethereum;
      if (!ethProvider) {
        logDirectSwap("Error: Could not get provider from wallet");
        notification.error("Could not get provider from wallet");
        setIsExecuting(false);
        return;
      }
      
      const provider = new ethers.BrowserProvider(ethProvider);
      
      // Get ethers signer from provider
      logDirectSwap("Getting signer from provider...");
      const signer = await provider.getSigner();

      // Get current network
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      const chainIdNumber = Number(chainId);
      logDirectSwap(`Connected to network with chainId: ${chainIdNumber}`);
      
      // Default Universal Router addresses by network
      const routerAddresses = {
        1: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Ethereum Mainnet
        5: "0xF7a0ef3C19caAA48eE6B13F26455a3aC109D4f29", // Goerli
        137: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Polygon
        42161: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Arbitrum
        10: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Optimism
        84532: "0x492E6456D9528771018DeB9E87ef7750EF184104", // Base Sepolia testnet
        // Add more networks as needed
      };
      
      // Get the router address for the current network
      const routerAddress = routerAddresses[chainIdNumber as keyof typeof routerAddresses] || routerAddresses[1];
      
      // IMPORTANT: For native ETH swaps, we always need to send the full ETH amount
      // as the transaction value
      const value = isTokenInNative ? parseEther(amountIn) : BigInt(0);
      
      console.log("Sending transaction with value:", value.toString(), "wei for", isTokenInNative ? "Native ETH" : "Token");

          // Execute the swap
      await executeUniversalRouterSwap(
        provider,
        signer,
        routerAddress,
        generatedCommandsData,
        value
      );
      
      notification.success("Swap executed successfully!");
      } catch (error) {
      console.error("Error executing swap:", error);
      notification.error("Failed to execute swap");
    } finally {
      setIsExecuting(false);
    }
  };

  // Simple render function for testing
  const renderInterface = () => {
    return (
      <div className="bg-base-100 shadow-xl rounded-3xl p-6 md:p-8 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">Uniswap Universal Router Interface</h2>
        
        {/* Protocol selector */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-300 mb-2">Swap Protocol</h3>
          <div className="flex space-x-4">
            <button
              className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                !directSwapMode 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setDirectSwapMode(false)}
            >
              Universal Router
            </button>
            <button
              className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                directSwapMode 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setDirectSwapMode(true)}
            >
              Direct Pool Manager
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {directSwapMode 
              ? 'Direct swap through Pool Manager - experimental, for advanced users only' 
              : 'Using Universal Router - the recommended way to swap'}
          </p>
        </div>
        
        {/* Swap mode selector - only show if using Universal Router */}
        {!directSwapMode && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-300 mb-2">Swap Protocol Version</h3>
            <div className="flex space-x-4">
              <button
                className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                  swapMode === 'v3' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => setSwapMode('v3')}
              >
                Uniswap V3
              </button>
              <button
                className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                  swapMode === 'v4' 
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => setSwapMode('v4')}
              >
                Uniswap V4
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {swapMode === 'v3' 
                ? 'Using Uniswap V3 pools - available on most networks' 
                : 'Using Uniswap V4 pools - might not be available on all networks'}
            </p>
          </div>
        )}
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium text-gray-300">Token In</span>
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Token In Address"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              disabled={isTokenInNative}
            />
            <button
              className={`btn rounded-lg shadow-md transition-all duration-200 ${isTokenInNative ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setIsTokenInNative(!isTokenInNative)}
            >
              ETH
            </button>
          </div>
          {directSwapMode && !isTokenInNative && (
            <p className="mt-1 text-xs text-yellow-400">
              Warning: Direct Pool Manager swaps with ERC20 tokens require additional approval steps.
            </p>
          )}
        </div>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium text-gray-300">Token Out</span>
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Token Out Address"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              disabled={isTokenOutNative}
            />
            <button
              className={`btn rounded-lg shadow-md transition-all duration-200 ${isTokenOutNative ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setIsTokenOutNative(!isTokenOutNative)}
            >
              ETH
            </button>
          </div>
        </div>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium text-gray-300">Amount In</span>
          </label>
          <input
            type="text"
            placeholder="Amount of tokens to swap"
            className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
        </div>
        
        {/* Fee Tier Selector */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium text-gray-300">Fee Tier</span>
          </label>
          <select 
            className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
            value={feeTier}
            onChange={(e) => setFeeTier(Number(e.target.value))}
          >
            <option value="500">0.05%</option>
            <option value="3000">0.3%</option>
            <option value="10000">1%</option>
          </select>
        </div>
        
        {/* Hook Address Input - only show for Direct Pool Manager */}
        {directSwapMode && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Hook Address (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="0x0000000000000000000000000000000000000000"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              value={hookAddress}
              onChange={(e) => setHookAddress(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Leave as zero address for no hooks. Custom hooks require special handling.
            </p>
          </div>
        )}
        
        {/* Deadline Input - only show for Universal Router */}
        {!directSwapMode && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Deadline (minutes)</span>
            </label>
            <input
              type="text"
              placeholder="Deadline in minutes"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          {!directSwapMode ? (
            // Universal Router buttons
            <>
              <button
                className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium text-sm"
                onClick={generateCommands}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                      Processing...
                  </span>
                ) : "Generate Commands"}
              </button>
              <button
                className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-medium text-sm"
                disabled={isExecuting}
                onClick={executeSwap}
              >
                {isExecuting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : "Execute Swap"}
              </button>
            </>
          ) : (
            // Direct Swap button for Pool Manager
            <button
              className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium text-sm"
              disabled={isExecuting}
              onClick={executeDirectSwap}
            >
              {isExecuting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : "Execute Direct Swap"}
            </button>
          )}
        </div>
        
        {/* Display Generated Commands - only show for Universal Router */}
        {!directSwapMode && commandsHex && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
            <h3 className="text-md font-medium text-gray-300 mb-2">Generated Command Hex</h3>
            <div className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono">
              {commandsHex}
            </div>
            
            {/* Raw Input Data */}
            <h3 className="text-md font-medium text-gray-300 mt-4 mb-2">Raw Input Data</h3>
            <div className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono">
              {inputsArray.map((input, index) => (
                <div key={index} className="mb-1 break-all">
                  <span className="text-blue-400 mr-2">Input {index}:</span> {input}
                </div>
              ))}
            </div>
            
            {/* Add Deadline */}
            <h3 className="text-md font-medium text-gray-300 mt-4 mb-2">Transaction Deadline</h3>
            <div className="bg-gray-900/80 rounded-md p-2 text-xs text-gray-300 font-mono">
              <div className="flex justify-between">
                <span className="text-blue-400">Timestamp:</span>
                <span>{generatedCommandsData?.deadline || 0}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-blue-400">Human readable:</span>
                <span>{generatedCommandsData?.deadline 
                  ? new Date(generatedCommandsData.deadline * 1000).toLocaleString() 
                  : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-blue-400">Expires in:</span>
                <span>{generatedCommandsData?.deadline 
                  ? `${Math.round((generatedCommandsData.deadline - Math.floor(Date.now() / 1000)) / 60)} minutes` 
                  : 'Not set'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Add logs display section for direct swap mode after the commands display */}
        {directSwapMode && directSwapLogs.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
            <h3 className="text-md font-medium text-gray-300 mb-2">Direct Swap Logs</h3>
            <div className="bg-gray-900/80 rounded-md p-2 overflow-y-auto max-h-48 text-xs text-gray-300 font-mono">
              {directSwapLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-blue-400">{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Display calldata - only show for Universal Router */}
        {!directSwapMode && generatedCommandsData && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
            <h3 className="text-md font-medium text-gray-300 mb-2">Full Calldata</h3>
            <div className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono break-all">
              {generatedCommandsData.fullCalldata}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main component render
  return (
    <div className="py-8 px-4 sm:px-0">
      {renderInterface()}
    </div>
  );
} 