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

// Add a simple SwapInterface component
export default function SwapInterface() {
  const [tokenIn, setTokenIn] = useState<string>('');
  const [tokenOut, setTokenOut] = useState<string>('');
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('30'); // Default 30 minutes
  
  // Simple render function for testing
  const renderInterface = () => {
    return (
      <div className="bg-base-100 shadow-xl rounded-3xl p-6 md:p-8 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">Uniswap Universal Router Interface</h2>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium">Token In</span>
          </label>
          <input
            type="text"
            placeholder="Token In Address"
            className="w-full p-2 rounded-lg bg-gray-100"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
          />
        </div>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium">Token Out</span>
          </label>
          <input
            type="text"
            placeholder="Token Out Address"
            className="w-full p-2 rounded-lg bg-gray-100"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
          />
        </div>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium">Amount In</span>
          </label>
          <input
            type="text"
            placeholder="Amount of tokens to swap"
            className="w-full p-2 rounded-lg bg-gray-100"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
        </div>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text text-sm font-medium">Deadline (minutes)</span>
          </label>
          <input
            type="text"
            placeholder="Deadline in minutes"
            className="w-full p-2 rounded-lg bg-gray-100"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        
        <button className="btn btn-primary w-full">Generate Commands</button>
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