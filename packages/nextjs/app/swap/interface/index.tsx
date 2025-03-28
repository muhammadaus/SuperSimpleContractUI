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
  "function supportsInterface(bytes4 interfaceId) external pure returns (bool)"
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
    const supportsInterfaceSignature = "0x01ffc9a7"; // supportsInterface(bytes4)
    const uniswapV3CallbackSignature = "0xfa461e33"; // uniswapV3SwapCallback(int256,int256,bytes)
    
    let isUniversalRouter = false;
    
    // Check for execute function signature with deadline
    if (bytecode.indexOf(executeSignature.slice(2)) > 0) {
      console.log("✓ Contract contains Universal Router execute(bytes,bytes[],uint256) function");
      isUniversalRouter = true;
    }
    
    // Check for execute function signature without deadline
    if (bytecode.indexOf(executeWithoutDeadlineSignature.slice(2)) > 0) {
      console.log("✓ Contract contains Universal Router execute(bytes,bytes[]) function");
      isUniversalRouter = true;
    }
    
    // Check for other Universal Router functions
    if (bytecode.indexOf(supportsInterfaceSignature.slice(2)) > 0) {
      console.log("✓ Contract contains supportsInterface function");
    }
    
    if (bytecode.indexOf(uniswapV3CallbackSignature.slice(2)) > 0) {
      console.log("✓ Contract contains uniswapV3SwapCallback function");
    }
    
    if (!isUniversalRouter) {
      console.error("❌ Contract does not appear to be a Universal Router - required functions not found");
      return false;
    }
    
    // 3. Create contract instance and make a read call to verify interface 
    const routerContract = new ethers.Contract(contractAddress, ROUTER_ABI, provider);
    
    try {
      // Try calling supportsInterface with ERC-165 interface ID
      const supportsERC165 = await routerContract.supportsInterface("0x01ffc9a7");
      console.log("supportsInterface check result:", supportsERC165);
      
      // Try calling supportsInterface with ERC-721 receiver interface ID
      const supportsERC721Receiver = await routerContract.supportsInterface("0x150b7a02");
      console.log("Supports ERC721 receiver:", supportsERC721Receiver);
      
      console.log("✅ Successfully read from Universal Router contract");
      return true;
    } catch (readError) {
      console.warn("Warning: Could not read from contract:", readError);
      // Still return true if we've verified the bytecode, even if read calls fail
      return isUniversalRouter;
    }
  } catch (error) {
    console.error("Error validating Universal Router:", error);
    return false;
  }
}

export default function SwapInterface() {
  const [tokenIn, setTokenIn] = useState<string>('');
  const [tokenOut, setTokenOut] = useState<string>('');
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('30'); // Default 30 minutes
  const [commandsHex, setCommandsHex] = useState<string>('');
  const [inputsArray, setInputsArray] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [contractName, setContractName] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isTokenInNative, setIsTokenInNative] = useState<boolean>(false);
  const [isTokenOutNative, setIsTokenOutNative] = useState<boolean>(false);
  const [isLoadingContract, setIsLoadingContract] = useState(true);
  const [feeTier, setFeeTier] = useState<number>(3000); // Default to 0.3%
  const [isTestingPairs, setIsTestingPairs] = useState(false);
  const [isTestingContract, setIsTestingContract] = useState(false);
  const [contractTestResults, setContractTestResults] = useState<string>("");
  
  // Constants
  const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH
  
  // Get user address from AppKit
  const { targetNetwork } = useTargetNetwork();
  const { isConnected, address: userAddress } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  const { walletProvider } = useAppKitProvider<any>('eip155');
  const { chainId: currentChainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  
  // Get contract for interaction
  const { data: contract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: contractName || 'YourContract',
  });
  
  // Helper function to properly format addresses with 0x prefix
  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.startsWith('0x')) {
      return address; // Address already has 0x prefix
    }
    return `0x${address}`; // Add prefix if missing
  };

  // Check for Router or PoolManager or YourContract
  const contracts = useContractStore.getState().contracts;
  
  useEffect(() => {
    const currentNetwork = targetNetwork.id;
    const networkContracts = contracts[currentNetwork];
    
    // Debug logging
    console.log("Current network ID:", currentNetwork);
    console.log("Available contracts for network:", networkContracts);
    
    if (networkContracts) {
      // First check for UniversalRouter
      if (networkContracts.UniversalRouter) {
        console.log("UniversalRouter found:", networkContracts.UniversalRouter.address);
        setContractName('UniversalRouter');
        setContractAddress(networkContracts.UniversalRouter.address);
        setDebugInfo(JSON.stringify({ 
          contractType: 'UniversalRouter', 
          address: networkContracts.UniversalRouter.address,
          network: targetNetwork.name,
          networkId: currentNetwork
        }, null, 2));
      }
      // Then check if PoolManager exists
      else if (networkContracts.PoolManager) {
        console.log("PoolManager found:", networkContracts.PoolManager.address);
        setContractName('PoolManager');
        setContractAddress(networkContracts.PoolManager.address);
        setDebugInfo(JSON.stringify({ 
          contractType: 'PoolManager', 
          address: networkContracts.PoolManager.address,
          network: targetNetwork.name,
          networkId: currentNetwork
        }, null, 2));
      } 
      // Otherwise fallback to YourContract
      else if (networkContracts.YourContract) {
        console.log("YourContract found:", networkContracts.YourContract.address);
        setContractName('YourContract');
        setContractAddress(networkContracts.YourContract.address);
        setDebugInfo(JSON.stringify({ 
          contractType: 'YourContract', 
          address: networkContracts.YourContract.address,
          network: targetNetwork.name,
          networkId: currentNetwork
        }, null, 2));
      } else {
        console.log("No known contracts found for network", currentNetwork);
        setDebugInfo(JSON.stringify({ 
          error: 'No contracts found',
          network: targetNetwork.name,
          networkId: currentNetwork,
          availableContracts: Object.keys(networkContracts)
        }, null, 2));
      }
    } else {
      console.log("No contracts available for network", currentNetwork);
      setDebugInfo(JSON.stringify({ 
        error: 'No network contracts',
        network: targetNetwork.name,
        networkId: currentNetwork,
        availableNetworks: Object.keys(contracts)
      }, null, 2));
    }
    
    setIsLoadingContract(false);
  }, [contracts, targetNetwork]);

  // Check if there's a pending transaction after wallet connection
  useEffect(() => {
    if (isConnected && userAddress && typeof window !== 'undefined') {
      const pendingSwapStr = window.sessionStorage.getItem('pendingSwap');
      const connectionInProgress = window.sessionStorage.getItem('walletConnectionInProgress');
      
      if (pendingSwapStr && connectionInProgress) {
        try {
          const pendingSwap = JSON.parse(pendingSwapStr);
          // Restore the swap state
          if (pendingSwap.tokenIn) setTokenIn(pendingSwap.tokenIn);
          if (pendingSwap.tokenOut) setTokenOut(pendingSwap.tokenOut);
          if (pendingSwap.amountIn) setAmountIn(pendingSwap.amountIn);
          if (pendingSwap.isTokenInNative !== undefined) setIsTokenInNative(pendingSwap.isTokenInNative);
          if (pendingSwap.isTokenOutNative !== undefined) setIsTokenOutNative(pendingSwap.isTokenOutNative);
          
          // Clear pending transaction
          window.sessionStorage.removeItem('pendingSwap');
          window.sessionStorage.removeItem('walletConnectionInProgress');
          
          // Generate the commands
          generateRouterCommands();
          
          // Show notification
          notification.info("Wallet connected! You can now execute your swap.");
        } catch (error) {
          console.error("Error parsing pending swap:", error);
          window.sessionStorage.removeItem('pendingSwap');
          window.sessionStorage.removeItem('walletConnectionInProgress');
        }
      }
    }
  }, [isConnected, userAddress]);
  
  // Clear any stale connection flags on component mount and when connection status changes
  useEffect(() => {
    // Check for stale connection flags
    if (typeof window !== 'undefined') {
      const connectionInProgress = window.sessionStorage.getItem('walletConnectionInProgress');
      const connectionTimestamp = window.sessionStorage.getItem('walletConnectionTimestamp');
      
      // If connection was initiated more than 2 minutes ago or user is now connected, clear the flag
      if (connectionInProgress) {
        const now = Date.now();
        const timestamp = connectionTimestamp ? parseInt(connectionTimestamp, 10) : 0;
        
        if (isConnected || now - timestamp > 120000 || !connectionTimestamp) {
          window.sessionStorage.removeItem('walletConnectionInProgress');
          window.sessionStorage.removeItem('walletConnectionTimestamp');
        }
      }
    }
    
    // If user is connected, ensure connection flags are cleared
    if (isConnected && typeof window !== 'undefined') {
      window.sessionStorage.removeItem('walletConnectionInProgress');
      window.sessionStorage.removeItem('walletConnectionTimestamp');
    }
  }, [isConnected]);

  // Define fee tier options
  const feeTierOptions = [
    { value: 100, label: "0.01%" },
    { value: 500, label: "0.05%" },
    { value: 3000, label: "0.3%" },
    { value: 10000, label: "1%" }
  ];
  
  // Standard tick spacings that match the fee tiers
  const getTickSpacing = (fee: number): number => {
    switch (fee) {
      case 100: return 1;
      case 500: return 10;
      case 3000: return 60;
      case 10000: return 200;
      default: return 60; // Default to 0.3% tier's tick spacing
    }
  };

  // Helper to generate command bytes
  const generateRouterCommands = () => {
    try {
      // Create deadline timestamp (current time + deadline minutes)
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(deadline) * 60;
      
      // Format the input and output token addresses, using the native address where appropriate
      const formattedTokenIn = isTokenInNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenIn);
      const formattedTokenOut = isTokenOutNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenOut);
      
      console.log("Formatted addresses:", {
        tokenIn: formattedTokenIn,
        tokenOut: formattedTokenOut
      });
      
      // Parse and format amount in
      const parsedAmountIn = parseUnits(amountIn, 18);
      
      // The command for V4_SWAP is 0x0f
      const v4CommandByte = ethers.hexlify(new Uint8Array([0x0f])); // V4_SWAP command
      setCommandsHex(v4CommandByte);
      
      // For V4 Router, we need to encode the actions and parameters
      // Actions.SWAP_EXACT_IN_SINGLE = 0x06, Actions.SETTLE_ALL = 0x0c, Actions.TAKE_ALL = 0x0f
      const actionBytes = new Uint8Array([0x06, 0x0c, 0x0f]);
      const encodedActions = ethers.hexlify(actionBytes);
      
      // Sort token addresses (lower address is currency0) for V4 PoolKey
      // Must use toLowerCase() for proper string comparison
      const [token0, token1] = [formattedTokenIn, formattedTokenOut].sort((a, b) => 
        a.toLowerCase() < b.toLowerCase() ? -1 : 1
      );
      
      // We need to determine if we're swapping from token0 to token1 or vice versa
      const zeroForOne = formattedTokenIn.toLowerCase() === token0.toLowerCase();
      
      // Log for debugging swap direction
      console.log("Swap direction:", {
        formattedTokenIn,
        formattedTokenOut,
        token0,
        token1,
        zeroForOne,
        feeTier
      });
      
      // Get tick spacing based on selected fee tier
      const tickSpacing = getTickSpacing(feeTier);
      
      // Create the V4 poolKey structure
      const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: feeTier, // Use selected fee tier
        tickSpacing: tickSpacing, // Use matching tick spacing
        hooks: "0x0000000000000000000000000000000000000000" // No hooks
      };
      
      // Initialize ABI coder for encoding parameters
      const abiCoder = new ethers.AbiCoder();
      
      // Prepare parameters for each V4 action
      const v4Params = new Array(3);
      
      // First parameter: ExactInputSingleParams struct
      // Important: use uint128 for amountIn and amountOutMinimum, not uint256!
      v4Params[0] = abiCoder.encode(
        ['tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData)'],
        [{
          poolKey,
          zeroForOne: zeroForOne,
          amountIn: BigInt(parsedAmountIn),
          amountOutMinimum: BigInt(0), // No minimum for demo
          sqrtPriceLimitX96: BigInt(0), // No price limit
          hookData: "0x" // Empty hook data
        }]
      );
      
      // Second parameter: specify input tokens for the swap (SETTLE_ALL)
      // For SETTLE_ALL, we need to encode the input currency and amount
      // Important: use uint128 for amount, not uint256!
      v4Params[1] = abiCoder.encode(['address', 'uint128'], [formattedTokenIn, BigInt(parsedAmountIn)]);
      
      // Third parameter: specify output tokens from the swap (TAKE_ALL)
      // For TAKE_ALL, we need to encode the output currency and minimum amount
      // Important: use uint128 for amount, not uint256!
      v4Params[2] = abiCoder.encode(['address', 'uint128'], [formattedTokenOut, BigInt(0)]);
      
      // Encode the V4 router input - this is what goes into the inputs array
      const v4Input = abiCoder.encode(['bytes', 'bytes[]'], [encodedActions, v4Params]);
      
      // This is the final inputs array for the Universal Router execute function
      const inputsArray = [v4Input];
      setInputsArray(inputsArray);
      
      notification.success("Commands generated successfully");
      console.log("Generated router commands:", {
        command: v4CommandByte,
        actions: encodedActions,
        poolKey,
        zeroForOne,
        inputsArray,
        deadline: deadlineTimestamp
      });
    } catch (error) {
      console.error("Error generating commands:", error);
      notification.error("Failed to generate commands");
    }
  };

  // Function to test ETH/USDC swap with V4
  const testV4Swap = () => {
    setIsTestingPairs(true);
    try {
      // Prefill the form with known tokens
      setTokenIn('');
      setTokenOut(USDC_ADDRESS);
      setIsTokenInNative(true);
      setIsTokenOutNative(false);
      setAmountIn('0.0001'); // Small amount for testing
      setFeeTier(3000); // Use 0.3% fee tier
      
      // Reset states
      setCommandsHex('');
      setInputsArray([]);
      
      notification.info("Test values set for ETH → USDC using V4 swap");
      
      // Generate commands
      setTimeout(() => {
        console.log("==== TESTING V4 SWAP WITH ETH/USDC ====");
        generateRouterCommands();
        
        // Execute the swap after a short delay to let the commands generate
        setTimeout(() => {
          console.log("Automatically executing V4 test swap...");
          handleExecuteSwap().catch(error => {
            console.error("Error in auto-execute V4 swap:", error);
          });
        }, 1000);
      }, 500);
    } catch (error) {
      console.error("Error setting up test swap:", error);
      notification.error("Failed to set up test swap");
    } finally {
      setTimeout(() => {
        setIsTestingPairs(false);
      }, 2000);
    }
  };
  
  // Function to test ETH/USDC swap with V3
  const testV3Swap = () => {
    setIsTestingPairs(true);
    try {
      // Prefill the form with known tokens
      setTokenIn('');
      setTokenOut(USDC_ADDRESS);
      setIsTokenInNative(true);
      setIsTokenOutNative(false);
      setAmountIn('0.0001'); // Small amount for testing
      setFeeTier(3000); // Use 0.3% fee tier
      
      // Reset states
      setCommandsHex('');
      setInputsArray([]);
      
      notification.info("Test values set for ETH → USDC using V3 swap");
      
      // Generate V3 router commands (different from V4)
      setTimeout(() => {
        console.log("==== TESTING V3 SWAP WITH ETH/USDC ====");
        generateV3RouterCommands();
        
        // Execute the swap after a short delay to let the commands generate
        setTimeout(() => {
          console.log("Automatically executing V3 test swap...");
          handleExecuteSwap().catch(error => {
            console.error("Error in auto-execute V3 swap:", error);
          });
        }, 1000);
      }, 500);
    } catch (error) {
      console.error("Error setting up test swap:", error);
      notification.error("Failed to set up test swap");
    } finally {
      setTimeout(() => {
        setIsTestingPairs(false);
      }, 2000);
    }
  };
  
  // Generate V3 router commands
  const generateV3RouterCommands = () => {
    try {
      console.log("==== GENERATING V3 ROUTER COMMANDS ====");
      // Create deadline timestamp
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(deadline) * 60;
      
      // Format addresses
      const formattedTokenIn = isTokenInNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenIn);
      const formattedTokenOut = isTokenOutNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenOut);
      
      console.log("Formatted addresses:", {
        tokenIn: formattedTokenIn,
        tokenOut: formattedTokenOut
      });
      
      // Parse amount
      const parsedAmountIn = parseUnits(amountIn, 18);
      
      // The command for V3_SWAP_EXACT_IN is 0x08
      const v3CommandByte = ethers.hexlify(new Uint8Array([0x08])); // V3_SWAP_EXACT_IN command
      setCommandsHex(v3CommandByte);
      
      // For V3, we encode the path differently
      // Create fee bytes for 0.3% fee (3000)
      const feeHex = feeTier.toString(16).padStart(6, '0');
      console.log("Fee hex:", feeHex);
      
      // Create path - For V3, we concatenate addresses with fee
      let path;
      let pathDescription;
      
      if (isTokenInNative) {
        // For ETH -> Token, we use WETH in the path
        path = ethers.concat([
          ethers.getBytes(WETH_ADDRESS),
          ethers.getBytes(`0x${feeHex.padStart(6, '0')}`),
          ethers.getBytes(formattedTokenOut)
        ]);
        pathDescription = `WETH -> ${feeTier/10000}% fee -> ${formattedTokenOut}`;
      } else if (isTokenOutNative) {
        // For Token -> ETH, we use WETH in the path
        path = ethers.concat([
          ethers.getBytes(formattedTokenIn),
          ethers.getBytes(`0x${feeHex.padStart(6, '0')}`),
          ethers.getBytes(WETH_ADDRESS)
        ]);
        pathDescription = `${formattedTokenIn} -> ${feeTier/10000}% fee -> WETH`;
      } else {
        // Token -> Token
        path = ethers.concat([
          ethers.getBytes(formattedTokenIn),
          ethers.getBytes(`0x${feeHex.padStart(6, '0')}`),
          ethers.getBytes(formattedTokenOut)
        ]);
        pathDescription = `${formattedTokenIn} -> ${feeTier/10000}% fee -> ${formattedTokenOut}`;
      }
      
      console.log("V3 Path description:", pathDescription);
      console.log("V3 Path bytes:", ethers.hexlify(path));
      
      // Initialize ABI coder
      const abiCoder = new ethers.AbiCoder();
      
      // Create V3 input parameter
      const recipient = userAddress || '0x0000000000000000000000000000000000000001'; // Use placeholder if not connected
      console.log("Recipient for V3 swap:", recipient);
      
      // V3_SWAP_EXACT_IN on Universal Router has these parameters:
      // bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint256 deadline
      const v3Params = abiCoder.encode(
        ['bytes', 'address', 'uint256', 'uint256', 'uint256'],
        [
          path,
          recipient,
          BigInt(parsedAmountIn),
          BigInt(0), // amountOutMinimum - no minimum for demo
          BigInt(deadlineTimestamp) // v3 includes deadline in the params
        ]
      );
      
      // Log the encoded parameters for debugging
      console.log("V3 params encoded:", {
        path: ethers.hexlify(path),
        recipient,
        amountIn: BigInt(parsedAmountIn).toString(),
        amountOutMinimum: "0",
        deadline: BigInt(deadlineTimestamp).toString()
      });
      
      // This is the final inputs array for the Universal Router execute function
      const inputsArray = [v3Params];
      setInputsArray(inputsArray);
      
      notification.success("V3 commands generated successfully");
      console.log("Generated V3 router commands:", {
        command: v3CommandByte,
        path: ethers.hexlify(path),
        inputsArray,
        deadline: deadlineTimestamp
      });
    } catch (error) {
      console.error("Error generating V3 commands:", error);
      notification.error("Failed to generate V3 commands");
    }
  };

  // Modify the handleExecuteSwap to better handle test executions
  const handleExecuteSwap = async () => {
    try {
      console.log("🔄 Executing swap...");
      console.log("Contract address:", contractAddress);
      console.log("Command Hex:", commandsHex);
      console.log("Input parameters:", inputsArray);
      
      // Extra debug for test runs
      const isV4Swap = commandsHex === ethers.hexlify(new Uint8Array([0x0f]));
      const isV3Swap = commandsHex === ethers.hexlify(new Uint8Array([0x08])) || 
                        commandsHex === ethers.hexlify(new Uint8Array([0x09]));
      
      console.log(`Executing ${isV4Swap ? 'V4 Swap' : isV3Swap ? 'V3 Swap' : 'Unknown'} command...`);
      
      if (!contractAddress) {
        console.error("❌ Error: Contract address not available");
        notification.error("Contract address not available");
        return;
      }
      
      if ((!tokenIn && !isTokenInNative) || (!tokenOut && !isTokenOutNative) || !amountIn) {
        console.error("❌ Error: Missing required fields", { 
          tokenIn: isTokenInNative ? "ETH (native)" : tokenIn, 
          tokenOut: isTokenOutNative ? "ETH (native)" : tokenOut, 
          amountIn 
        });
        notification.error("Please fill in all required fields");
        return;
      }
      
      // Generate commands if not already set
      if (!commandsHex || inputsArray.length === 0) {
        console.log("⚙️ No commands present, generating first...");
        // Determine if this is a V3 or V4 swap and call the appropriate generator
        if (isV3Swap) {
          console.log("Generating V3 router commands...");
          generateV3RouterCommands();
        } else {
          console.log("Generating V4 router commands...");
        generateRouterCommands();
        }
        return; // Wait for commands to be generated first
      }
      
      // Check if wallet is connected, if not prompt to connect
      if (!isConnected || !userAddress) {
        notification.info("Please connect your wallet first");
        try {
          // Store pending transaction parameters
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('pendingSwap', JSON.stringify({
              tokenIn,
              tokenOut,
              amountIn,
              isTokenInNative,
              isTokenOutNative
            }));
            console.log("Stored pending swap transaction");
          }
          
          // Set a flag to indicate connection is in progress
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('walletConnectionInProgress', 'true');
            window.sessionStorage.setItem('walletConnectionTimestamp', Date.now().toString());
          }
          
          // Open AppKit to connect wallet
          openAppKit();
          
          // Clear connection flag after a timeout to prevent blocking future connection attempts
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('walletConnectionInProgress');
              window.sessionStorage.removeItem('walletConnectionTimestamp');
            }
          }, 30000); // 30 seconds timeout for connection attempt
          
          return;
        } catch (error) {
          console.error("Error opening wallet:", error);
          notification.error("Could not open wallet connection");
          // Clear connection flag on error
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('walletConnectionInProgress');
            window.sessionStorage.removeItem('walletConnectionTimestamp');
          }
          return;
        }
      }
      
      // Check if a transaction is already in progress
      if (isExecuting) {
        notification.info("Please wait for the current operation to complete");
        return;
      }
      
      setIsExecuting(true);
      
      // Create deadline timestamp (current time + deadline minutes)
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(deadline) * 60;
      const deadlineBigInt = BigInt(deadlineTimestamp);
      
      // Format the input and output token addresses for the log
      const formattedTokenIn = isTokenInNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenIn);
      const formattedTokenOut = isTokenOutNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenOut);
      const parsedAmountIn = parseUnits(amountIn, 18);
      
      console.log("🔹 Swap Details:", {
        tokenIn: formattedTokenIn,
        tokenOut: formattedTokenOut,
        amountIn: amountIn,
        parsedAmountIn: parsedAmountIn.toString(),
        deadline: deadline,
        deadlineTimestamp: deadlineTimestamp
      });
      
      // Check if we need to switch networks
      if (currentChainId !== targetNetwork.id) {
        notification.info(`Switching to ${targetNetwork.name} network...`);
        try {
          // Create a network object from targetNetwork
          const network: AppKitNetwork = {
            id: targetNetwork.id,
            name: targetNetwork.name,
            rpcUrls: {
              default: {
                http: [targetNetwork.rpcUrls.default.http[0]]
              }
            },
            nativeCurrency: {
              name: targetNetwork.nativeCurrency.name,
              symbol: targetNetwork.nativeCurrency.symbol,
              decimals: targetNetwork.nativeCurrency.decimals
            }
          };
          
          await switchNetwork(network);
          notification.success(`Switched to ${targetNetwork.name}!`);
        } catch (switchError) {
          console.error("Failed to switch network:", switchError);
          notification.error(`Failed to switch network: ${(switchError as Error).message}`);
          setIsExecuting(false);
          return;
        }
      }
      
      // Additional debugging
      console.log(`Swap Type: ${isV4Swap ? 'V4 Swap' : isV3Swap ? 'V3 Swap' : 'Unknown'}`);
      
      // Execute the router commands
      console.log("📣 Attempting to call contract at", contractAddress);
      
      try {
        // Create ethers provider and signer
        if (!walletProvider) {
          notification.error("Wallet provider not available");
          setIsExecuting(false);
          return;
        }
        
        const provider = new ethers.BrowserProvider(walletProvider);
        const signer = await provider.getSigner();
        
        // Validate that this is a Universal Router contract
        console.log("Validating Universal Router contract before executing swap...");
        const isValidRouter = await validateUniversalRouter(contractAddress, provider);
        if (!isValidRouter) {
          console.error("❌ Contract does not appear to be a valid Universal Router");
          notification.error("Contract validation failed - this might not be a Universal Router");
          setIsExecuting(false);
          return;
        }
        console.log("✅ Contract validated as Universal Router - proceeding with swap");
        
        // Basic contract validation
        try {
          const bytecode = await provider.getCode(contractAddress);
          if (bytecode === '0x') {
            console.log("Warning: No bytecode at address - this might not be a contract");
            notification.error("No contract found at address");
            throw new Error("No contract at address");
          } else {
            console.log(`Contract bytecode size: ${(bytecode.length - 2) / 2} bytes`);
          }
          
          // Check if the contract has the expected function signature for execute
          const executeSignature = "0x3593564c";
          if (bytecode.indexOf(executeSignature.slice(2)) > 0) {
            console.log("✓ Contract contains Universal Router execute function signature");
            notification.success("Contract interface looks valid");
          } else {
            console.log("✗ Contract may not be a Universal Router - execute signature not found");
            notification.info("Contract doesn't appear to be a Universal Router");
          }
        } catch (interfaceTestError) {
          console.error("Error testing contract interface:", interfaceTestError);
        }
        
        // Different logic paths for V3 and V4 swaps
        if (isV4Swap) {
          // For V4 swaps only, check if pool exists
          console.log("V4 Swap Configuration:", {
            commandByte: commandsHex,
            inputsArray: inputsArray,
            formattedTokenIn,
            formattedTokenOut,
            parsedAmountIn: parsedAmountIn.toString(),
            networkId: targetNetwork.id
          });
          
          try {
            // Check for V4 pool existence if it's a V4 swap
            console.log("Checking if V4 pool exists for these tokens...");
            
            // Get the PoolManager contract - you should have this defined in your contracts
            const contractStore = useContractStore.getState().contracts;
            const poolManagerAddress = contractStore[targetNetwork.id]?.PoolManager?.address;
            
            if (poolManagerAddress) {
              const poolManagerABI = [
                "function getPool(address token0, address token1, uint24 fee, int24 tickSpacing) view returns (bytes32, uint160, int24, uint128, uint256, uint8)"
              ];
              
              const poolManager = new ethers.Contract(poolManagerAddress, poolManagerABI, provider);
              
              // Sort token addresses for the pool key
              // Must use toLowerCase() for proper string comparison
        const [token0, token1] = [formattedTokenIn, formattedTokenOut].sort((a, b) => 
          a.toLowerCase() < b.toLowerCase() ? -1 : 1
        );
        
              // Log the parameters we're using to check for the pool
              console.log("Checking for V4 pool with parameters:", {
          token0,
          token1,
                fee: feeTier, // use selected fee tier
                tickSpacing: getTickSpacing(feeTier) // use matching tick spacing
              });
              
              try {
                const poolInfo = await poolManager.getPool(token0, token1, feeTier, getTickSpacing(feeTier));
                console.log("V4 pool exists:", poolInfo);
                notification.success("V4 pool exists for these tokens");
              } catch (poolError) {
                console.error("Error checking V4 pool:", poolError);
                console.log(`V4 pool likely doesn't exist for these tokens with fee tier ${feeTier/10000}%`);
                notification.info(`V4 pool doesn't exist for these tokens with ${feeTier/10000}% fee tier. Try another fee tier or using V3 swap instead.`);
                setIsExecuting(false);
                return;
              }
            } else {
              console.log("PoolManager contract not found, can't check V4 pool existence");
            }
          } catch (poolCheckError) {
            console.error("Error checking V4 pool:", poolCheckError);
          }
        } else if (isV3Swap) {
          // V3 swap path - no pool existence check required
          console.log("V3 Swap Configuration:", {
            commandByte: commandsHex,
            inputsArray: inputsArray,
            formattedTokenIn,
            formattedTokenOut,
            parsedAmountIn: parsedAmountIn.toString(),
            networkId: targetNetwork.id
          });
          
          // Skip pool check for V3 swaps
          console.log("Executing V3 swap - no pool existence check needed");
          notification.info("Using V3 swap route");
        }
        
        notification.info("Preparing swap transaction...");

        // Create an Interface instance for the router with specific function signatures
        const routerInterface = new ethers.Interface([
          "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
          "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
          "function supportsInterface(bytes4 interfaceId) external pure returns (bool)"
        ]);

        // Log router interface
        console.log("Router ABI interface constructed with specific signatures");

        // Add more detailed debug information for the transaction
        console.log("Command byte for transaction:", commandsHex);
        console.log("First input array item (truncated):", inputsArray[0]?.substring(0, 100) + "...");
        console.log("Deadline timestamp:", deadlineBigInt.toString());

        // Explicitly specify the full function signature to avoid ambiguity
        const txData = routerInterface.encodeFunctionData(
          EXECUTE_WITH_DEADLINE_SIG, 
          [
            commandsHex,      // Use the actual commandsHex generated earlier
            inputsArray,      // Use the inputsArray that was generated
            deadlineBigInt    // deadline
          ]
        );

        // Log full transaction data
        console.log("Full transaction data:", txData);
        
        // Create transaction parameters with explicit gas settings
        const txParams = {
          to: contractAddress,
          data: txData,
          value: isTokenInNative ? parsedAmountIn.toString() : '0',
          // Include explicit gas parameters to help with execution
          gasLimit: ethers.toBigInt(650000), // Higher gas limit for complex swaps
          type: 2, // EIP-1559 transaction
          maxFeePerGas: ethers.toBigInt(50000000000), // 50 gwei
          maxPriorityFeePerGas: ethers.toBigInt(2500000000) // 2.5 gwei
        };
        
        // First try to estimate gas to check if the transaction will revert
        try {
          console.log(`Estimating gas for ${isV4Swap ? 'V4' : isV3Swap ? 'V3' : 'Unknown'} swap format transaction...`);
          const gasEstimate = await provider.estimateGas(txParams);
          console.log("Gas estimate:", gasEstimate.toString());
          
          // Transaction is valid, proceed with it
          notification.info("Transaction looks valid, sending now...");
          
          // Send the transaction
          try {
            console.log("Sending swap transaction...");
            const tx = await signer.sendTransaction(txParams);
          
          console.log("Transaction sent:", tx);
          notification.success("Transaction sent! Waiting for confirmation...");
          
          // Wait for the transaction to be mined
          const receipt = await tx.wait();
          console.log("Transaction confirmed:", receipt);
          notification.success("Swap completed successfully!");
            
            // Clear swap fields on successful transaction
            setAmountIn("");
            setCommandsHex("");
            setInputsArray([]);
            setIsExecuting(false);
          
          return receipt;
          } catch (sendError) {
            console.error("Error sending transaction:", sendError);
            const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
            
            if (errorMsg.includes("user rejected")) {
              notification.info("Transaction was rejected by the user");
            } else {
              notification.error(`Failed to send transaction: ${errorMsg.substring(0, 100)}`);
            }
            
            setIsExecuting(false);
          }
        } catch (gasError) {
          console.error("Gas estimation failed:", gasError);
          
          // Show a more helpful error message
          const errorString = gasError instanceof Error ? gasError.message : String(gasError);
          
          if (errorString.includes("insufficient funds")) {
            notification.error("Insufficient funds for this transaction");
          } else if (errorString.includes("execution reverted")) {
            notification.error("Transaction would fail: " + errorString.substring(0, 100));
          } else {
            if (isV4Swap) {
              notification.error("Transaction would fail on-chain. The pool may not exist for this token pair on V4.");
              console.log("Try checking if a V4 pool exists for these tokens with the given fee tier");
              notification.info("V4 pool may not exist. The token pair might not have a V4 pool on this network.");
            } else if (isV3Swap) {
              notification.error("Transaction would fail on-chain. There may be an issue with the V3 parameters.");
              console.log("This is unexpected as ETH/USDC V3 pool should exist.");
            } else {
              notification.error("Transaction would fail on-chain for unknown reasons.");
            }
          }
          
          setIsExecuting(false);
          return;
        }
      } catch (error) {
        console.error("❌ Error executing swap:", error);
        notification.error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsExecuting(false);
      }
    } catch (error) {
      console.error("❌ Error executing swap:", error);
      notification.error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExecuting(false);
    }
  };

  // Function to test the Universal Router contract
  const testRouterContract = async () => {
    try {
      setIsTestingContract(true);
      setContractTestResults("");
      
      if (!contractAddress) {
        notification.error("No contract address available");
        setIsTestingContract(false);
        return;
      }
      
      notification.info("Testing Universal Router contract...");
      
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsTestingContract(false);
        return;
      }
      
      const provider = new ethers.BrowserProvider(walletProvider);
      
      // First validate the basic Universal Router functions
      const validationResult = await validateUniversalRouter(contractAddress, provider);
      let resultsText = `Basic Universal Router validation: ${validationResult ? "PASSED ✅" : "FAILED ❌"}\n\n`;
      
      // Get the contract ABI and create an interface for it
      const fullAbi = [
        "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
        "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
        "function collectRewards(bytes looksRareClaim) external",
        "function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external",
        "function supportsInterface(bytes4 interfaceId) external pure returns (bool)",
        "receive() external payable"
      ];
      
      // Test each function signature in the bytecode
      const bytecode = await provider.getCode(contractAddress);
      resultsText += `Contract bytecode size: ${(bytecode.length - 2) / 2} bytes\n\n`;
      
      const signatures = {
        "execute(bytes,bytes[],uint256)": "0x3593564c",
        "execute(bytes,bytes[])": "0x47ccca02",
        "supportsInterface(bytes4)": "0x01ffc9a7",
        "uniswapV3SwapCallback(int256,int256,bytes)": "0xfa461e33",
        "collectRewards(bytes)": "0xb66303f4"
      };
      
      resultsText += "Function signature tests:\n";
      for (const [name, sig] of Object.entries(signatures)) {
        const found = bytecode.indexOf(sig.slice(2)) > 0;
        resultsText += `${name}: ${found ? "FOUND ✅" : "NOT FOUND ❌"}\n`;
      }
      
      // Test errors in bytecode
      const errorSignatures = {
        "BalanceTooLow()": "0x13ead562",
        "TransactionDeadlinePassed()": "0x6e96d88a",
        "V3InvalidSwap()": "0xdba61d5a", 
        "V3TooLittleReceived()": "0x37c20415",
        "V3TooMuchRequested()": "0xd8dd5956",
        "V4TooLittleReceived()": "0x3a855c9c", // Only in V4 routers
        "V4TooMuchRequested()": "0x8e12a9a3"  // Only in V4 routers
      };
      
      resultsText += "\nError signature tests:\n";
      for (const [name, sig] of Object.entries(errorSignatures)) {
        const found = bytecode.indexOf(sig.slice(2)) > 0;
        resultsText += `${name}: ${found ? "FOUND ✅" : "NOT FOUND ❌"}\n`;
      }
      
      // Now try to actually call some read methods
      resultsText += "\nRead method tests:\n";
      
      try {
        const router = new ethers.Contract(contractAddress, fullAbi, provider);
        const supportsERC165 = await router.supportsInterface("0x01ffc9a7");
        resultsText += `supportsInterface(0x01ffc9a7): ${supportsERC165}\n`;
        
        // Try ERC721 receiver interface
        const supportsERC721 = await router.supportsInterface("0x150b7a02");
        resultsText += `supportsInterface(0x150b7a02): ${supportsERC721}\n`;
      } catch (readError) {
        resultsText += `Error calling read methods: ${readError instanceof Error ? readError.message : String(readError)}\n`;
      }
      
      // Check for supported commands
      try {
        if (validationResult) {
          resultsText += "\nTesting for supported command bytes...\n";
          resultsText += "This may take a moment, please wait...\n";
          
          const routerInterface = new ethers.Interface(fullAbi);
          const supportData = await testRouterCommands(
            routerInterface,
            contractAddress,
            provider,
            userAddress || "0x0000000000000000000000000000000000000001",
            WETH_ADDRESS,
            USDC_ADDRESS,
            BigInt(Math.floor(Date.now() / 1000) + 600)
          );
          
          resultsText += `\nRouter Type: ${supportData.routerType}\n`;
          resultsText += `Supported Commands: ${supportData.supportedCommands.join(', ')}\n`;
        }
      } catch (commandsTestError) {
        resultsText += `\nError testing commands: ${commandsTestError instanceof Error ? commandsTestError.message : String(commandsTestError)}\n`;
      }
      
      // Set the results to state to display to the user
      setContractTestResults(resultsText);
      notification.success("Contract test completed!");
    } catch (error) {
      console.error("Error testing contract:", error);
      notification.error(`Failed to test contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingContract(false);
    }
  };

  // Add a specific function to test V3 swap with a static call
  const testV3SwapWithStaticCall = async () => {
    try {
      setIsTestingPairs(true);
      notification.info("Testing V3 swap with static call...");
      
      // Prefill the form with known tokens
      setTokenIn('');
      setTokenOut(USDC_ADDRESS);
      setIsTokenInNative(true);
      setIsTokenOutNative(false);
      setAmountIn('0.0001'); // Small amount for testing
      setFeeTier(3000); // Use 0.3% fee tier
      
      // Reset states
      setCommandsHex('');
      setInputsArray([]);
      
      // Check for wallet
      if (!walletProvider) {
        notification.error("Wallet provider not available");
        setIsTestingPairs(false);
        return;
      }
      
      // Create provider and get bytecode
      const provider = new ethers.BrowserProvider(walletProvider);
      
      // First check if the contract exists by reading bytecode
      if (!contractAddress) {
        notification.error("No contract address available");
        setIsTestingPairs(false);
        return;
      }
      
      const bytecode = await provider.getCode(contractAddress);
      if (bytecode === '0x') {
        notification.error("No contract found at address");
        setIsTestingPairs(false);
        return;
      }
      
      console.log(`Contract bytecode size: ${(bytecode.length - 2) / 2} bytes`);
      
      // Generate V3 router commands
      console.log("==== TESTING V3 SWAP WITH ETH/USDC USING STATIC CALL ====");
      
      // Create deadline timestamp
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
      
      // Format addresses
      const formattedTokenIn = NATIVE_ETH_ADDRESS;
      const formattedTokenOut = USDC_ADDRESS;
      
      console.log("Test addresses:", {
        tokenIn: formattedTokenIn,
        tokenOut: formattedTokenOut
      });
      
      // Parse amount - use a small amount
      const parsedAmountIn = parseUnits('0.0001', 18);
      
      // The command for V3_SWAP_EXACT_IN is 0x08
      const v3CommandByte = ethers.hexlify(new Uint8Array([0x08]));
      
      // For V3, we encode the path differently
      // Create fee bytes for 0.3% fee (3000)
      const feeHex = '000bb8'; // 3000 in hex
      
      // Create path - For ETH -> Token, we use WETH in the path
      const path = ethers.concat([
        ethers.getBytes(WETH_ADDRESS),
        ethers.getBytes(`0x${feeHex}`),
        ethers.getBytes(formattedTokenOut)
      ]);
      
      console.log("V3 Path: WETH -> 0.3% fee -> USDC");
      console.log("V3 Path bytes:", ethers.hexlify(path));
      
      // Initialize ABI coder
      const abiCoder = new ethers.AbiCoder();
      
      // Create V3 input parameter - using a known address for testing
      const recipient = userAddress || '0x0000000000000000000000000000000000000001';
      console.log("Recipient for V3 swap test:", recipient);
      
      // V3_SWAP_EXACT_IN on Universal Router has these parameters:
      // bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint256 deadline
      const v3Params = abiCoder.encode(
        ['bytes', 'address', 'uint256', 'uint256', 'uint256'],
        [
          path,
          recipient,
          BigInt(parsedAmountIn),
          BigInt(0), // amountOutMinimum
          BigInt(deadlineTimestamp) // deadline
        ]
      );
      
      // Log params
      console.log("V3 params for static call test:", {
        pathHex: ethers.hexlify(path),
        recipient,
        amountIn: parsedAmountIn.toString(),
        amountOutMinimum: "0",
        deadline: deadlineTimestamp.toString()
      });
      
      // Create an Interface instance for the router with specific function signatures
      const routerInterface = new ethers.Interface([
        "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
        "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
        "function supportsInterface(bytes4 interfaceId) external pure returns (bool)"
      ]);
      
      // Encode the transaction data with the explicit function signature
      const txData = routerInterface.encodeFunctionData(
        EXECUTE_WITH_DEADLINE_SIG, 
        [
          v3CommandByte,
          [v3Params],
          BigInt(deadlineTimestamp)
        ]
      );
      
      console.log("Transaction data for static call:", txData);
      
      // Create transaction parameters for static call
      const txParams = {
            to: contractAddress,
            data: txData,
        value: parsedAmountIn.toString(),
      };
      
      console.log("Making static call to check if transaction would succeed...");
      
      try {
        // Try a static call to see if it would work
        const result = await provider.call(txParams);
        console.log("Static call succeeded:", result);
        notification.success("V3 swap static call succeeded!");
      } catch (staticCallError) {
        console.error("Static call failed:", staticCallError);
        
        // Print a more detailed error message
        const errorMsg = staticCallError instanceof Error ? staticCallError.message : String(staticCallError);
        console.log("Error message:", errorMsg);
        
        // Try to extract the revert reason
        if (errorMsg.includes("execution reverted: ")) {
          const revertReason = errorMsg.split("execution reverted: ")[1]?.split('"')[0];
          console.log("Revert reason:", revertReason);
          notification.error(`V3 swap would fail: ${revertReason || 'Unknown reason'}`);
        } else {
          notification.error("V3 swap static call failed");
        }
      }
      
      // Now try to estimate gas to see if it would fail
      try {
        console.log("Estimating gas for V3 swap...");
        const gasEstimate = await provider.estimateGas(txParams);
        console.log("Gas estimate for V3 swap:", gasEstimate.toString());
        notification.success("V3 swap gas estimation succeeded!");
      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        
        // Try to extract useful information from the error
        const errorMsg = gasError instanceof Error ? gasError.message : String(gasError);
        console.log("Gas error message:", errorMsg);
        
        if (errorMsg.includes("insufficient funds")) {
          notification.error("Insufficient funds for this transaction");
        } else if (errorMsg.includes("execution reverted")) {
          const revertReason = errorMsg.split("execution reverted: ")[1]?.split('"')[0];
          notification.error(`Gas estimation reverted: ${revertReason || 'Unknown reason'}`);
        } else {
          notification.error("V3 swap would fail on-chain");
        }
      }
      
      // Generate the commands for the UI
      generateV3RouterCommands();
    } catch (error) {
      console.error("Error testing V3 swap with static call:", error);
      notification.error(`Error in V3 swap test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingPairs(false);
    }
  };

  // Render Universal Router Interface
  const renderUniversalRouterInterface = () => {
    return (
      <div className="bg-base-100 shadow-xl rounded-3xl p-6 md:p-8 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">Uniswap Universal Router Interface</h2>
        
        {/* Contract Test Button */}
        <div className="mb-4">
          <button
            className="w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium text-sm"
            onClick={testRouterContract}
            disabled={isTestingContract || !contractAddress}
          >
            {isTestingContract ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testing Router Contract...
              </span>
            ) : (
              "Test Universal Router Contract"
            )}
          </button>
        </div>
        
        {/* Display Contract Test Results */}
        {contractTestResults && (
          <div className="mb-6 p-4 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
            <h3 className="text-md font-medium text-gray-300 mb-2">Contract Test Results</h3>
            <pre className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {contractTestResults}
            </pre>
          </div>
        )}
        
        {/* Test Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <button
            className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium text-sm"
            onClick={testV4Swap}
            disabled={isTestingPairs || isExecuting}
          >
            {isTestingPairs ? "Testing..." : "Test ETH/USDC V4 Swap"}
          </button>
          <button
            className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium text-sm"
            onClick={testV3Swap}
            disabled={isTestingPairs || isExecuting}
          >
            {isTestingPairs ? "Testing..." : "Test ETH/USDC V3 Swap"}
          </button>
          <button
            className="py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium text-sm"
            onClick={testV3SwapWithStaticCall}
            disabled={isTestingPairs || isExecuting}
          >
            {isTestingPairs ? "Testing..." : "Test V3 Static Call"}
          </button>
        </div>
        
        <div className="flex flex-col gap-4">
          {/* Token In Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Token In</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Token In Address"
                className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={tokenIn}
                onChange={(e) => setTokenIn(e.target.value)}
                disabled={isTokenInNative}
              />
              <button
                className={`btn rounded-lg shadow-md transition-all duration-200 ${isTokenInNative ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                onClick={(e) => {
                  e.preventDefault();
                  setIsTokenInNative(!isTokenInNative);
                }}
              >
                ETH
              </button>
            </div>
          </div>
          
          {/* Token Out Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Token Out</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Token Out Address"
                className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={tokenOut}
                onChange={(e) => setTokenOut(e.target.value)}
                disabled={isTokenOutNative}
              />
              <button
                className={`btn rounded-lg shadow-md transition-all duration-200 ${isTokenOutNative ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                onClick={(e) => {
                  e.preventDefault();
                  setIsTokenOutNative(!isTokenOutNative);
                }}
              >
                ETH
              </button>
            </div>
          </div>
          
          {/* Amount In Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Amount In</span>
            </label>
            <input
              type="text"
              placeholder="Amount of tokens to swap"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </div>
          
          {/* Fee Tier Selection */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Fee Tier</span>
            </label>
            <select 
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={feeTier}
              onChange={(e) => setFeeTier(Number(e.target.value))}
            >
              {feeTierOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Deadline Field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-300">Deadline (minutes)</span>
            </label>
            <input
              type="number"
              placeholder="Deadline in minutes"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4 mt-2">
            <button
              className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                !tokenIn && !isTokenInNative || !tokenOut && !isTokenOutNative || !amountIn
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
              } font-medium text-sm`}
              onClick={(e) => {
                e.preventDefault();
                generateRouterCommands();
              }}
              disabled={!tokenIn && !isTokenInNative || !tokenOut && !isTokenOutNative || !amountIn}
            >
              Generate Commands
            </button>
            
            <button
              className={`py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex-1 ${
                !commandsHex || isExecuting
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white'
              } font-medium text-sm`}
              onClick={(e) => {
                e.preventDefault();
                handleExecuteSwap();
              }}
              disabled={!commandsHex || isExecuting}
            >
              {isExecuting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Executing...
                </span>
              ) : (
                "Execute Swap"
              )}
            </button>
          </div>
        </div>
        
        {/* Display Generated Commands */}
        {commandsHex && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
            <h3 className="text-md font-medium text-gray-300 mb-2">Generated Command Hex</h3>
            <div className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono">
              {commandsHex}
            </div>
            
            {inputsArray.length > 0 && (
              <>
                <h3 className="text-md font-medium text-gray-300 mt-4 mb-2">Generated Inputs</h3>
                <div className="bg-gray-900/80 rounded-md p-2 overflow-x-auto text-xs text-gray-300 font-mono">
                  {inputsArray.map((input, index) => (
                    <div key={index} className="mb-1">
                      {input}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Wallet Status */}
        <div className="mt-4 text-sm text-gray-300">
          <div className="flex justify-between items-center">
            <div>Wallet: </div>
            <div>
              {isConnected ? (
                <span className="text-green-400">
                  Connected: {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
                </span>
              ) : (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    openAppKit();
                  }}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <div>Network: </div>
            <div className={currentChainId === targetNetwork.id ? "text-green-400" : "text-yellow-400"}>
              {currentChainId === targetNetwork.id ? 
                `✓ ${targetNetwork.name}` : 
                `⚠️ Wrong Network (Expected: ${targetNetwork.name})`}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render Router Fallback
  const renderRouterFallback = () => {
    return (
      <div className="bg-base-100 shadow-xl rounded-3xl p-6 md:p-8 w-full max-w-2xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text mb-4">
            Universal Router Interface
          </h2>
          
          {isLoadingContract ? (
            <div className="flex flex-col items-center justify-center p-8">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-300">Loading contracts...</p>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
              <div className="text-yellow-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-medium">Contract Not Found</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Universal Router contract was not found on the current network.
              </p>
              <div className="bg-gray-900/80 rounded-md p-4 text-left text-sm text-gray-300 font-mono overflow-x-auto">
                <div className="mb-2">Network ID: {currentChainId || "Not connected"}</div>
                <div className="mb-2">Target Network: {targetNetwork.name}</div>
                {debugInfo && (
                  <div className="mt-2 border-t border-gray-700 pt-2">
                    <div className="text-xs">Debug Info:</div>
                    <pre className="mt-1 text-xs whitespace-pre-wrap">{debugInfo}</pre>
                  </div>
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.preventDefault();
                  openAppKit();
                }}
                className="mt-4 py-2 px-4 rounded-lg shadow-md transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium text-sm"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render function
  return (
    <div className="py-8 px-4 sm:px-0">
      {contractName === 'UniversalRouter' && contractAddress ? (
        renderUniversalRouterInterface()
      ) : (
        renderRouterFallback()
      )}
    </div>
  );
}

// Tests which command bytes are supported by the router
async function testRouterCommands(
  _routerInterface: ethers.Interface, // We'll create our own interface to avoid ambiguity
  contractAddress: string,
  provider: ethers.Provider,
  recipient: string,
  tokenIn: string,
  tokenOut: string,
  deadline: bigint
) {
  console.log("Testing which command bytes are supported by the router...");
  
  // Create a new interface with explicit function signatures
  const routerInterface = new ethers.Interface([
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
    "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
    "function supportsInterface(bytes4 interfaceId) external pure returns (bool)"
  ]);
  
  // Detect and log network information
  try {
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    const networkNames: {[key: string]: string} = {
      '1': 'Ethereum Mainnet',
      '3': 'Ropsten Testnet',
      '4': 'Rinkeby Testnet',
      '5': 'Goerli Testnet',
      '42': 'Kovan Testnet',
      '56': 'Binance Smart Chain',
      '137': 'Polygon Mainnet',
      '80001': 'Polygon Mumbai',
      '10': 'Optimism',
      '42161': 'Arbitrum One',
      '421613': 'Arbitrum Goerli',
      '11155111': 'Sepolia Testnet',
      '31337': 'Hardhat/Localhost',
      '1337': 'Ganache'
    };
    const chainIdString = chainId.toString();
    const chainName = networkNames[chainIdString] || `Unknown Network (${chainIdString})`;
    
    console.log(`Current network: ${chainName} (Chain ID: ${chainIdString})`);
    console.log(`Router address: ${contractAddress}`);
  } catch (error) {
    console.error("Error detecting network:", error);
  }
  
  // Define command bytes to test
  const commandsToTest = [
    { value: 0x00, name: "V2_SWAP_EXACT_IN" },
    { value: 0x01, name: "V2_SWAP_EXACT_OUT" },
    { value: 0x08, name: "V3_SWAP_EXACT_IN" },
    { value: 0x09, name: "V3_SWAP_EXACT_OUT" },
    { value: 0x0a, name: "PERMIT2_PERMIT" },
    { value: 0x0b, name: "WRAP_ETH" },
    { value: 0x0c, name: "UNWRAP_WETH" },
    { value: 0x0d, name: "PERMIT2_TRANSFER_FROM" },
    { value: 0x0e, name: "SWEEP" },
    { value: 0x0f, name: "V4_SWAP" }
  ];
  
  const results: Record<string, { supported: boolean, error: string }> = {};
  
  // Create a minimal encoder
  const abiCoder = new ethers.AbiCoder();
  
  // For each command, try a minimal call
  for (const command of commandsToTest) {
    try {
      console.log(`Testing ${command.name} (0x${command.value.toString(16)})...`);
      
      // Create command byte
      const commandByte = ethers.hexlify(new Uint8Array([command.value]));
      
      // Create a minimal input for this command type
      let inputs: string[];
      
      if (command.value === 0x00 || command.value === 0x01) {
        // V2 swaps
        const encodedData = abiCoder.encode(
          ['address', 'uint256', 'uint256', 'address[]', 'address'],
          [
            recipient,
            BigInt(1),
            BigInt(0),
            [tokenIn, tokenOut],
            recipient
          ]
        );
        inputs = [encodedData];
      } else if (command.value === 0x08 || command.value === 0x09) {
        // V3 swaps
        const path = ethers.concat([
          ethers.getBytes(tokenIn),
          new Uint8Array([0x00, 0x0b, 0xb8]), // fee bytes (3000)
          ethers.getBytes(tokenOut)
        ]);
        
        const encodedData = abiCoder.encode(
          ['bytes', 'address', 'uint256', 'uint256', 'bool'],
          [
            path,
            recipient,
            BigInt(1),
            BigInt(0),
            true
          ]
        );
        inputs = [encodedData];
      } else if (command.value === 0x0f) {
        // V4 swap - uses the more complex structure
        const actions = ethers.hexlify(new Uint8Array([0x06, 0x0c, 0x0f])); // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
        
        // Create a minimal poolKey
        const poolKey = {
          currency0: tokenIn,
          currency1: tokenOut,
          fee: 3000, // Use 0.3% fee tier for testing
          tickSpacing: 60, // standard tick spacing for 0.3% fee
          hooks: "0x0000000000000000000000000000000000000000"
        };
        
        // First parameter: ExactInputSingleParams
        const param1 = abiCoder.encode(
          ['tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData)'],
          [{
            poolKey,
            zeroForOne: true,
            amountIn: BigInt(1),
            amountOutMinimum: BigInt(0),
            sqrtPriceLimitX96: BigInt(0),
            hookData: "0x"
          }]
        );
        
        // Second and third parameters
        const param2 = abiCoder.encode(['address', 'uint128'], [tokenIn, BigInt(1)]);
        const param3 = abiCoder.encode(['address', 'uint128'], [tokenOut, BigInt(0)]);
        
        const params = [param1, param2, param3];
        
        // Combine actions and params into inputs
        const v4Input = abiCoder.encode(['bytes', 'bytes[]'], [actions, params]);
        inputs = [v4Input];
      } else {
        // Other commands with minimal inputs
        inputs = ["0x"];
      }
      
      
      // Create transaction data with explicit function signature to avoid ambiguity
      const txData = routerInterface.encodeFunctionData(
        EXECUTE_WITH_DEADLINE_SIG, 
        [commandByte, inputs, deadline]
      );
      
      // Try a static call
      await provider.call({
        to: contractAddress,
        data: txData,
        from: recipient,
        value: "0x1"  // tiny amount of ETH
      });
      
      // If we got here, the call succeeded (very unlikely, but possible for some simpler commands)
      results[command.name] = { supported: true, error: "" };
      console.log(`✓ ${command.name} succeeded unexpectedly`);
    } catch (error) {
      // Analyze the error
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a meaningful error (has revert data) or just missing data
      if (errorMsg.includes("execution reverted:")) {
        // This is a good sign - the contract understood the command but rejected it with a reason
        results[command.name] = { supported: true, error: errorMsg };
        console.log(`✓ ${command.name} - Contract understood command but reverted with reason`);
        
        // Try to extract the reason
        const revertMatch = errorMsg.match(/execution reverted: (.*?)(?:"|$)/);
        if (revertMatch && revertMatch[1]) {
          console.log(`  Revert reason: ${revertMatch[1].trim()}`);
        }
      } else if (errorMsg.includes("missing revert data") || errorMsg.includes("function selector was not recognized")) {
        // This suggests the contract doesn't recognize the command
        results[command.name] = { supported: false, error: errorMsg };
        console.log(`✗ ${command.name} - Command not supported (missing revert data)`);
      } else {
        // Some other error
        results[command.name] = { supported: false, error: errorMsg };
        console.log(`? ${command.name} - Unknown error:`, errorMsg);
      }
    }
  }
  
  // Analyze the results to determine what kind of router it is
  const supportedCommands = Object.entries(results)
    .filter(([_, data]) => data.supported)
    .map(([name, _]) => name);
  
  console.log("Supported commands:", supportedCommands);
  
  // Make a determination about the router type
  let routerType = "Unknown";
  
  if (supportedCommands.includes("V4_SWAP")) {
    routerType = "Uniswap V4 Universal Router";
  } else if (supportedCommands.includes("V3_SWAP_EXACT_IN") || supportedCommands.includes("V3_SWAP_EXACT_OUT")) {
    routerType = "Uniswap V3 Universal Router";
  } else if (supportedCommands.includes("V2_SWAP_EXACT_IN") || supportedCommands.includes("V2_SWAP_EXACT_OUT")) {
    routerType = "Uniswap V2 Compatible Router";
  }
  
  console.log(`Router appears to be: ${routerType}`);
  notification.info(`Router identified as: ${routerType}`);
  
  return {
    routerType,
    supportedCommands
  };
} 