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
  "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
];

// Initialize AppKit at module level if not already initialized
if (typeof window !== 'undefined' && !(window as any).__APPKIT_INITIALIZED__) {
  try {
    console.log('Initializing AppKit in swap interface...');
    // Project metadata
    const metadata = {
      name: 'PureContracts Swap',
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
  
  // Constants
  const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  
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

  // Helper to generate command bytes
  const generateRouterCommands = () => {
    try {
      // Command for V4_SWAP (0x0f) from Uniswap Universal Router docs
      const v4SwapCommandByte = new Uint8Array([0x0f]); // Simple byte array with V4_SWAP command (0x0f)
      const encodedCommand = ethers.hexlify(v4SwapCommandByte);
      setCommandsHex(encodedCommand);
      
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
      
      // Format parameters for UI display (user-friendly representation)
      // These are not the actual encoded parameters, just for UI display
      const inputParams = [
        formattedTokenIn,
        formattedTokenOut,
        parsedAmountIn.toString(16),
        deadlineTimestamp.toString(16)
      ];
      
      setInputsArray(inputParams);
      
      notification.success("Commands generated successfully");
      console.log("Generated router commands:", {
        command: encodedCommand,
        params: inputParams,
        deadline: deadlineTimestamp
      });
    } catch (error) {
      console.error("Error generating commands:", error);
      notification.error("Failed to generate commands");
    }
  };

  // Handle execution of swap
  const handleExecuteSwap = async () => {
    try {
      console.log("🔄 Executing swap...");
      console.log("Contract address:", contractAddress);
      console.log("Command Hex:", commandsHex);
      console.log("Input parameters:", inputsArray);
      
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
      if (!commandsHex) {
        console.log("⚙️ No commands present, generating first...");
        generateRouterCommands();
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
      
      // Format the input and output token addresses for the log
      const formattedTokenIn = isTokenInNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenIn);
      const formattedTokenOut = isTokenOutNative ? NATIVE_ETH_ADDRESS : formatAddress(tokenOut);
      const parsedAmountIn = parseUnits(amountIn, 18);
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(deadline) * 60;
      
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
        
        notification.info("Preparing swap transaction...");
        
        // Create a deadline for the transaction (30 minutes from now)
        const deadlineBigInt = BigInt(deadlineTimestamp);
        
        // Following the exact pattern from the Uniswap documentation
        // Create an Interface instance for the router
        const routerInterface = new ethers.Interface(ROUTER_ABI);
        
        // Encode the Universal Router command - V4_SWAP is 0x0f
        const v4SwapCommandByte = new Uint8Array([0x0f]);
        const encodedCommand = ethers.hexlify(v4SwapCommandByte);
        
        console.log("V4_SWAP command:", encodedCommand);
        
        // Check which version of Universal Router we're using
        console.log("🔍 Universal Router contract at:", contractAddress);
        
        // Let's try to get supported commands from the router by calling a view function
        try {
          const routerAbi = new ethers.Interface([
            "function isValidCommandsExecutor(bytes calldata commands) view returns (bool)"
          ]);
          
          // Log attempted command check
          console.log("Checking if V4_SWAP command is supported...");
          
          // We'll try this later if we need to
        } catch (cmdCheckError) {
          console.error("Error checking command support:", cmdCheckError);
        }
        
        // Encode V4Router actions exactly as in the docs
        // These MUST match the exact constant values from the Uniswap docs
        // SWAP_EXACT_IN_SINGLE = 0x06, SETTLE_ALL = 0x0c, TAKE_ALL = 0x0f
        const actionBytes = new Uint8Array([
          0x06, // SWAP_EXACT_IN_SINGLE = 0x06
          0x0c, // SETTLE_ALL = 0x0c
          0x0f  // TAKE_ALL = 0x0f
        ]);
        const encodedActions = ethers.hexlify(actionBytes);
        
        console.log("Encoded actions:", encodedActions);
        console.log("Action constants from docs: SWAP_EXACT_IN_SINGLE=0x06, SETTLE_ALL=0x0c, TAKE_ALL=0x0f");
        
        // Get tokens in the correct order for the poolKey
        // Sort token addresses (lower address is currency0)
        const [token0, token1] = [formattedTokenIn, formattedTokenOut].sort((a, b) => 
          a.toLowerCase() < b.toLowerCase() ? -1 : 1
        );
        
        // We need to determine if we're swapping from token0 to token1 or vice versa
        const zeroForOne = formattedTokenIn.toLowerCase() === token0.toLowerCase();
        
        console.log("Token order:", {
          token0, 
          token1, 
          zeroForOne,
          tokenIn: formattedTokenIn,
          tokenOut: formattedTokenOut
        });
        
        // Create the poolKey structure exactly as required by Uniswap V4
        const poolKey = {
          currency0: token0,
          currency1: token1,
          fee: 3000, // 0.3% fee tier
          tickSpacing: 60, // Standard tick spacing for 0.3% fee
          hooks: "0x0000000000000000000000000000000000000000" // No hooks for this example
        };
        
        console.log("PoolKey for swap:", poolKey);
        
        // Prepare parameters for each action following exactly the docs example
        const abiCoder = new ethers.AbiCoder();
        const params = new Array(3);
        
        // First parameter: ExactInputSingleParams struct exactly matching the provided example
        const exactInputSingleParams = {
          poolKey: poolKey,
          zeroForOne: zeroForOne,
          amountIn: parsedAmountIn,
          amountOutMinimum: BigInt(0), // No minimum for demo  
          sqrtPriceLimitX96: BigInt(0), // No price limit
          hookData: "0x" // Empty hook data
        };
        
        console.log("ExactInputSingleParams:", {
          ...exactInputSingleParams,
          amountIn: exactInputSingleParams.amountIn.toString(),
          amountOutMinimum: exactInputSingleParams.amountOutMinimum.toString(),
          sqrtPriceLimitX96: exactInputSingleParams.sqrtPriceLimitX96.toString(),
        });
        
        // Encode with the exact type signature from your provided example
        params[0] = abiCoder.encode(
          ['tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData)'],
          [exactInputSingleParams]
        );
        
        // Second parameter: specify input tokens for the swap (SETTLE_ALL)
        params[1] = abiCoder.encode(['address', 'uint256'], [formattedTokenIn, parsedAmountIn]);
        
        // Third parameter: specify output tokens from the swap (TAKE_ALL)
        params[2] = abiCoder.encode(['address', 'uint256'], [formattedTokenOut, BigInt(0)]);
        
        console.log("Params array length:", params.length);
        console.log("First param encoding (first 100 chars):", params[0].substring(0, 100) + "...");
        console.log("Second param encoding:", params[1]);
        console.log("Third param encoding:", params[2]);
        
        // Combine actions and params into inputs array exactly as shown in docs
        const inputs = [
          abiCoder.encode(['bytes', 'bytes[]'], [encodedActions, params])
        ];
        
        console.log("Inputs array (length):", inputs.length);
        console.log("First input (first 100 chars):", inputs[0].substring(0, 100) + "...");
        
        // Encode the complete function call for V4 swap
        const txData = routerInterface.encodeFunctionData("execute", [
          encodedCommand,  // V4_SWAP command
          inputs,          // Combined actions and params
          deadlineBigInt   // deadline
        ]);
        
        console.log("Transaction data:", txData);
        
        // Create transaction parameters with explicit gas settings
        const txParams = {
          to: contractAddress,
          data: txData,
          value: isTokenInNative ? parsedAmountIn.toString() : '0',
          // Include explicit gas parameters to help with execution
          gasLimit: ethers.toBigInt(500000), // Explicit gas limit
          type: 2 // EIP-1559 transaction
        };
        
        console.log("Executing with parameters:", JSON.stringify(txParams, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value, 2));
        
        // First try to estimate gas to check if the transaction will revert
        try {
          console.log("Estimating gas before sending transaction...");
          const gasEstimate = await provider.estimateGas(txParams);
          console.log("Gas estimate:", gasEstimate.toString());
          
          // Only proceed if gas estimation succeeds
          notification.info("Transaction looks valid, sending now...");
        } catch (gasError) {
          console.error("💥 Pre-execution gas estimation failed:", gasError);
          
          // Log the data that would've been sent for debugging
          console.log("TX Verification Failed. Raw transaction data:", {
            to: contractAddress,
            data: txData,
            value: txParams.value.toString(),
            from: await signer.getAddress()
          });
          
          // Try to interpret the error
          let errorMessage = "Transaction would fail on chain";
          if (gasError instanceof Error) {
            if (gasError.message.includes("insufficient funds")) {
              errorMessage = "Insufficient funds for this transaction";
            } else if (gasError.message.includes("exceeds balance")) {
              errorMessage = "Transaction amount exceeds your balance";
            } else if (gasError.message.includes("execution reverted")) {
              errorMessage = "Transaction would revert: " + gasError.message;
            }
          }
          
          notification.error(errorMessage);
          console.log("Transaction would fail. Not sending to avoid gas fees on a failed transaction.");
          setIsExecuting(false);
          
          // Clear any connection flags
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('walletConnectionInProgress');
            window.sessionStorage.removeItem('walletConnectionTimestamp');
          }
          
          // If estimation fails, try a raw RPC call as a last resort to get more error details
          try {
            console.log("Attempting direct RPC call to get more error details...");
            
            // Use the current provider's chainId and RPC instead of hardcoded values
            const network = await provider.getNetwork();
            const providerNetwork = targetNetwork.rpcUrls.default.http[0];
            console.log(`Using network RPC from current provider: ${network.name}`);
            
            // Make an eth_call directly through the provider instead of fetch
            try {
              const callResult = await provider.call({
                from: await signer.getAddress(),
                to: contractAddress as string,
                data: txData,
                value: isTokenInNative ? parsedAmountIn.toString() : '0',
              });
              
              console.log("Direct provider call result:", callResult);
            } catch (callError) {
              // This should catch actual revert data with reason
              console.error("Provider call error:", callError);
              
              // Try to parse the error reason if available
              if (callError instanceof Error) {
                const errorString = callError.toString();
                console.log("Error reason:", errorString);
                
                if (errorString.includes("Pool does not exist")) {
                  notification.error("Swap failed: Pool does not exist for this token pair");
                } else if (errorString.includes("insufficient")) {
                  notification.error("Swap failed: Insufficient liquidity or balance");
                } else {
                  let errorDetail = "Unknown error";
                  
                  // Extract error message from error string if possible
                  const errorMatch = errorString.match(/error=([^,]*)/);
                  if (errorMatch && errorMatch[1]) {
                    errorDetail = errorMatch[1].trim();
                  }
                  
                  notification.error(`Transaction would fail: ${errorDetail}`);
                }
              }
            }
          } catch (rpcError) {
            console.error("Error making direct call through provider:", rpcError);
          }
          
          return; // Don't proceed with sending the transaction
        }
        
        // Attempt to check if the pool exists before sending transaction
        try {
          // Log pool check attempt for debugging
          console.log("Checking if pool exists for token pair...");
          
          // Construct a call to check if the pool exists (using the provider's call method)
          const poolManagerInterface = new ethers.Interface([
            "function isExistingPool(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)) view returns (bool)"
          ]);
          
          // Don't actually make the call if we're swapping with the native token as this is common
          if (!isTokenInNative && !isTokenOutNative) {
            try {
              // Find the PoolManager contract address if available
              const networkContracts = useContractStore.getState().contracts[targetNetwork.id];
              const poolManagerAddress = networkContracts?.PoolManager?.address;
              
              if (poolManagerAddress) {
                console.log("Found PoolManager at:", poolManagerAddress);
                
                // Check if pool exists
                const poolExistsResult = await provider.call({
                  to: poolManagerAddress,
                  data: poolManagerInterface.encodeFunctionData("isExistingPool", [poolKey])
                });
                
                const poolExists = poolManagerInterface.decodeFunctionResult("isExistingPool", poolExistsResult)[0];
                
                if (!poolExists) {
                  console.log("Pool does not exist for this token pair!");
                  notification.info("No pool exists for this token pair. Transaction may fail.");
                } else {
                  console.log("Pool exists for this token pair");
                }
              }
            } catch (poolCheckError) {
              console.error("Error checking pool existence:", poolCheckError);
              // Continue with transaction even if pool check fails - this is just a warning
            }
          }
        } catch (error) {
          console.error("Error in pool existence check:", error);
          // Continue with transaction even if pool check fails
        }
        
        // 6. Send the transaction
        const tx = await signer.sendTransaction(txParams);
        
        notification.success(`Transaction sent: ${tx.hash}`);
        console.log("Swap transaction:", tx.hash);
        
        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        console.log("Transaction receipt:", receipt);
        
        if (receipt && receipt.status === 1) {
          notification.success("Swap completed successfully!");
        } else {
          notification.error("Transaction failed on-chain.");
        }
        
        // Clear the form
        setAmountIn('');
        setCommandsHex('');
        setInputsArray([]);
      } catch (txError) {
        console.error("❌ Error executing swap:", txError);
        notification.error(`Failed to execute swap: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
      } finally {
        setIsExecuting(false);
        
        // Clear any connection flags
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('walletConnectionInProgress');
          window.sessionStorage.removeItem('walletConnectionTimestamp');
        }
      }
    } catch (error) {
      console.error("❌ Error executing swap:", error);
      notification.error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExecuting(false);
    }
  };

  // Render Universal Router Interface
  const renderUniversalRouterInterface = () => {
    return (
      <div className="bg-base-100 shadow-xl rounded-3xl p-6 md:p-8 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">Uniswap Universal Router Interface</h2>
        
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