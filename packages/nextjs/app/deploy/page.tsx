"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  createWalletClient, 
  http, 
  parseEther, 
  encodeFunctionData, 
  Hex, 
  createPublicClient, 
  Abi,
  custom as customTransport,
  encodeAbiParameters,
  parseAbiParameters,
  fallback,
  Account
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isAddress } from 'viem';
import * as viemChains from 'viem/chains';
import { Chain } from 'viem/chains';
import Select, { SingleValue } from 'react-select';
import { notification } from "@/utils/scaffold-eth/notification";
import { useTargetNetwork } from "@/hooks/scaffold-eth/useTargetNetwork";
import { ArrowPathIcon, CodeBracketIcon, DocumentCheckIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { 
  useAppKit, 
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect
} from '@reown/appkit/react';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

type ChainName = keyof typeof viemChains;

interface ChainOption {
  value: ChainName;
  label: string;
}

interface CompilerSettings {
  version: string;
  evmVersion: string;
  optimizer: {
    enabled: boolean;
    runs: number;
  };
}

// Sourcify API endpoint
const SOURCIFY_API = "https://sourcify.dev/server";

// Update the type for wallet provider
interface WalletProvider {
  request: (args: {
    method: string;
    params: any[];
  }) => Promise<any>;
  // Add other potential properties as needed
}

// Initialize AppKit outside of the component
if (typeof window !== 'undefined') {
  try {
    // Try to initialize if not already done
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';
    const metadata = {
      name: 'PureContracts',
      description: 'Secure and transparent smart contract interactions',
      url: window.location.origin,
      icons: ['https://purecontracts.com/logo.png'], 
    };
    
    // Create ethers adapter
    const ethersAdapter = new EthersAdapter();
    
    // Define supported networks
    const networks = [mainnet, arbitrum, sepolia] as [AppKitNetwork, ...AppKitNetwork[]];
    
    // Initialize only if needed
    if (!(window as any).__APPKIT_INITIALIZED__) {
      console.log('Initializing AppKit explicitly on deploy page...');
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
          '--w3m-accent': '#3b82f6', // Blue color to match your UI
        },
      });
      (window as any).__APPKIT_INITIALIZED__ = true;
      console.log('AppKit initialized successfully');
    }
  } catch (error) {
    console.error('AppKit initialization failed:', error);
  }
}

// Helper function to handle common wallet/chain errors
const handleDeploymentError = (error: any): { message: string, details: string } => {
  // Default error information
  let message = "Contract deployment failed";
  let details = "";
  
  console.log("Analyzing error:", error);
  
  // Check if it's a viem TransactionExecutionError
  if (error?.name === 'TransactionExecutionError') {
    message = "Transaction execution error";
    
    // Extract error details from the cause if available
    if (error.cause) {
      // Check for specific error types in the cause
      if (error.cause.code === -32000) {
        details = "Insufficient funds for gas * price + value";
      } else if (error.cause.code === -32603) {
        details = "Internal JSON-RPC error";
      } else if (error.cause.code === 4001) {
        message = "Transaction rejected";
        details = "You declined the transaction in your wallet";
      } else if (error.cause.message) {
        details = error.cause.message;
      }
    } else if (error.details) {
      details = error.details;
    } else if (error.message) {
      // Try to extract more specific information from the error message
      if (error.message.includes("insufficient funds")) {
        details = "Your wallet doesn't have enough funds to pay for gas";
      } else if (error.message.includes("gas required exceeds")) {
        details = "Gas limit is too low for this contract deployment";
      } else if (error.message.includes("rejected") || error.message.includes("denied") || error.message.includes("cancelled")) {
        message = "Transaction rejected";
        details = "The transaction was rejected by your wallet";
      } else {
        details = error.message;
      }
    }
  } 
  // Handle RPC connection issues
  else if (error?.name === 'RpcError' || (error?.message && error.message.includes("RPC"))) {
    message = "RPC connection error";
    
    if (error.details) {
      details = error.details;
    } else if (error.message) {
      if (error.message.includes("timeout")) {
        details = "The RPC endpoint timed out. Network may be congested.";
      } else if (error.message.includes("rate limit")) {
        details = "The RPC endpoint rate limited your request. Try again later.";
      } else {
        details = error.message;
      }
    }
  }
  // Generic error handling for other types
  else if (error instanceof Error) {
    message = error.name || "Error";
    details = error.message;
  } 
  // Last resort for unknown error types
  else if (typeof error === 'object' && error !== null) {
    try {
      message = "Unknown error";
      details = JSON.stringify(error);
    } catch (e) {
      details = "Could not stringify error object";
    }
  }
  
  return { message, details };
};

// Utility function to try an alternative deployment method
const tryAlternativeDeployment = async (
  address: `0x${string}`,
  bytecode: `0x${string}`,
  selectedChain: Chain,
  gasLimit: bigint,
  value?: bigint,
  nonce?: number,
  walletProvider?: WalletProvider
): Promise<`0x${string}`> => {
  console.log("Attempting alternative deployment method...");
  
  // Enhanced RPC setup for different networks
  let rpcUrl = '';
  
  // For Sepolia, use Alchemy URL only since public RPCs are unreliable
  if (selectedChain.id.toString() === '11155111') {
    rpcUrl = process.env.ALCHEMY_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/mnvC3BfLvzJlyk82vCLgBCD1gVCg_XX9';
    console.log("Using Alchemy RPC for Sepolia deployment");
  } else {
    // For other networks, use the chain's default RPC
    rpcUrl = selectedChain.rpcUrls.default.http[0];
    console.log(`Using default RPC for ${selectedChain.name} deployment`);
  }
  
  try {
    // Simplified approach: Use only the wallet provider for transaction
    if (walletProvider) {
      console.log("Using wallet provider for deployment (simplified approach)");
      
      // Create a wallet client with the wallet provider
      const walletClient = createWalletClient({
        account: address,
        chain: selectedChain,
        transport: customTransport(walletProvider)
      });
      
      // Send transaction directly using sendTransaction (contract creation)
      const txHash = await walletClient.sendTransaction({
        account: address,
        to: undefined, // Contract creation
        data: bytecode,
        value,
        gas: gasLimit,
        nonce,
        chain: selectedChain, // Explicitly specify chain to avoid chain mismatch
      });
      
      console.log("Alternative deployment successful with hash:", txHash);
      return txHash;
    } else {
      // Fallback to HTTP transport if wallet provider is not available
      console.log("Wallet provider not available, using HTTP transport as fallback");
      
      // Create HTTP transport with increased timeout
      const transport = http(rpcUrl, {
        timeout: 60000, // 60 second timeout
        fetchOptions: {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'viem/PureContracts'
          },
        },
      });
      
      // Create wallet client with private key account if available, otherwise use the address
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
      const account = privateKey ? privateKeyToAccount(privateKey) : address;
      
      const walletClient = createWalletClient({
        account,
        chain: selectedChain,
        transport
      });
      
      // Send transaction directly using sendTransaction (contract creation)
      const txHash = await walletClient.sendTransaction({
        account,
        to: undefined, // Contract creation
        data: bytecode,
        value,
        gas: gasLimit,
        nonce,
        chain: selectedChain, // Explicitly specify chain to avoid chain mismatch
      });
      
      console.log("Alternative deployment successful with hash:", txHash);
      return txHash;
    }
  } catch (error) {
    console.error("Alternative deployment failed:", error);
    
    // Provide detailed error information
    const { message, details } = handleDeploymentError(error);
    throw new Error(`${message}: ${details}`);
  }
};

// Add a troubleshooting component to display deployment tips
const DeploymentTroubleshooting: React.FC<{ 
  error: string | null;
  bytecodeLength: number;
  network: string;
}> = ({ error, bytecodeLength, network }) => {
  // No error, no tips needed
  if (!error) return null;
  
  let tips: string[] = [
    "Ensure you have enough ETH in your wallet to cover gas fees",
    "Try increasing the gas limit if deployment is failing"
  ];
  
  // Add specific tips based on the error message
  if (error.toLowerCase().includes("insufficient funds")) {
    tips = [
      "You need more ETH in your wallet to cover gas costs",
      `For ${network}, you can get test ETH from a faucet`,
      "The contract might be too large and expensive to deploy"
    ];
  } else if (error.toLowerCase().includes("gas") && error.toLowerCase().includes("limit")) {
    tips = [
      "Increase the gas limit in the form above",
      "Try 4000000 or higher for complex contracts",
      "The contract might be too large to deploy on this network"
    ];
  } else if (error.toLowerCase().includes("nonce")) {
    tips = [
      "Your wallet has pending transactions that need to be confirmed first",
      "Check your wallet for any pending transactions",
      "Try again after pending transactions are confirmed"
    ];
  } else if (error.toLowerCase().includes("rpc") || error.toLowerCase().includes("network")) {
    tips = [
      "The network is experiencing connectivity issues",
      "Try again in a few minutes",
      "Consider switching to a different RPC endpoint or network"
    ];
  } else if (bytecodeLength > 35000) {
    // Add tip for very large contracts
    tips.push("Your contract bytecode is very large. Some networks have size limits.");
  }
  
  // Add network-specific tips
  if (network.toLowerCase().includes("sepolia")) {
    tips.push("Sepolia is a testnet. Get test ETH from the Sepolia faucet.");
  } else if (network.toLowerCase().includes("mainnet")) {
    tips.push("Deploying to mainnet requires real ETH and costs actual money.");
  }
  
  return (
    <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
      <h3 className="text-yellow-400 font-semibold mb-2">Troubleshooting Tips</h3>
      <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
        {tips.map((tip, i) => (
          <li key={i}>{tip}</li>
        ))}
      </ul>
    </div>
  );
};

// Export the main component directly
export default function DeployPage() {
  const { targetNetwork } = useTargetNetwork();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [bytecode, setBytecode] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [constructorArgs, setConstructorArgs] = useState<{[key: string]: string}>({});
  const [abi, setAbi] = useState<any[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [deploymentTx, setDeploymentTx] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [isBytecodeTooLong, setIsBytecodeTooLong] = useState(false);
  const [isBytecodeValid, setIsBytecodeValid] = useState(true);
  const [valueToSend, setValueToSend] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<ChainOption>({ 
    value: 'mainnet' as ChainName, 
    label: 'mainnet' 
  });
  const [gasLimit, setGasLimit] = useState('');
  const [gasPriority, setGasPriority] = useState('');
  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>({
    version: '0.8.20',
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 200
    }
  });
  const [contractName, setContractName] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'success' | 'failed'>('none');
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // AppKit hooks
  const { open: openAppKit } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155") as { walletProvider: WalletProvider | null };
  const { disconnect } = useDisconnect();
  
  // Add state to track transaction status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  // Add state to track provider connection details
  const [walletProviderState, setWalletProviderState] = useState<{
    isAvailable: boolean;
    hasRequest: boolean;
    lastCheckTime: string;
  }>({
    isAvailable: false,
    hasRequest: false,
    lastCheckTime: ''
  });

  // Update the useEffect hook to check wallet provider status
  useEffect(() => {
    // Check and log wallet provider state
    const checkWalletProvider = () => {
      const providerState = {
        isAvailable: !!walletProvider,
        hasRequest: !!(walletProvider && walletProvider.request),
        lastCheckTime: new Date().toISOString()
      };
      
      setWalletProviderState(providerState);
      
      console.log("Wallet provider state:", providerState);
    };
    
    // Check immediately and every 5 seconds
    checkWalletProvider();
    const interval = setInterval(checkWalletProvider, 5000);
    
    return () => clearInterval(interval);
  }, [walletProvider]);

  // Update the useEffect hook to handle auto-deployment after connection
  useEffect(() => {
    // Add a small delay to ensure AppKit is fully initialized
    const timer = setTimeout(() => {
      // Check if AppKit was properly initialized
      if (!isConnected && !address && walletProvider === null) {
        console.log('AppKit may not be fully initialized, re-initializing...');
        try {
          // Reinitialize with the same parameters as above
          const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';
          const ethersAdapter = new EthersAdapter();
          const networks = [mainnet, arbitrum, sepolia] as [AppKitNetwork, ...AppKitNetwork[]];
          
          createAppKit({
            adapters: [ethersAdapter],
            networks,
            metadata: {
              name: 'PureContracts',
              description: 'Secure and transparent smart contract interactions',
              url: window.location.origin,
              icons: ['https://purecontracts.com/logo.png'], 
            },
            projectId,
            themeMode: 'dark',
            features: {
              analytics: true,
            },
            themeVariables: {
              '--w3m-accent': '#3b82f6',
            },
          });
          
          // Try to open the modal after a slight delay
          setTimeout(() => {
            console.log('Attempting to open AppKit after re-initialization');
            openAppKit();
          }, 200);
        } catch (error) {
          console.error('Failed to re-initialize AppKit:', error);
        }
      } else {
        console.log("AppKit connection state:", {
          isConnected,
          address,
          targetNetworkId: targetNetwork.id,
          selectedNetworkId: (viemChains as any)[selectedNetwork.value]?.id,
          hasWalletProvider: !!walletProvider
        });
        
        if (address) {
          setUserAddress(address);
          
          // If there's a pending deployment and we just got connected, proceed with deployment
          if (window.sessionStorage.getItem('pendingDeployment') === 'true' && bytecode) {
            console.log("Detected pending deployment after connection, proceeding with deployment");
            
            // Get the target chain ID from session storage
            const targetChainId = window.sessionStorage.getItem('pendingDeploymentChainId');
            
            // Clear the pending deployment flags
            window.sessionStorage.removeItem('pendingDeployment');
            window.sessionStorage.removeItem('pendingDeploymentChainId');
            
            // Check if wallet is on the correct chain first
            if (walletProvider && walletProvider.request) {
              (async () => {
                try {
                  // Get current chain ID
                  const chainIdHex = await walletProvider.request({ method: 'eth_chainId', params: [] });
                  const currentChainId = parseInt(chainIdHex, 16);
                  
                  console.log(`Current chain ID: ${currentChainId}, Expected chain ID: ${targetChainId}`);
                  
                  // If chains don't match, try to switch chain first
                  if (targetChainId && currentChainId !== parseInt(targetChainId)) {
                    console.log(`Chain mismatch detected. Attempting to switch to chain ID ${targetChainId}...`);
                    notification.info(`Switching your wallet to the correct network (Chain ID: ${targetChainId})`);
                    
                    try {
                      // Try to switch chains automatically
                      await walletProvider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${parseInt(targetChainId).toString(16)}` }],
                      });
                      
                      // Small delay to ensure wallet has updated
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      // Now proceed with deployment
                      setTimeout(() => {
                        executeDeployment();
                      }, 500);
                    } catch (switchError) {
                      console.error("Failed to switch networks:", switchError);
                      notification.error("Could not switch networks. Please switch manually and try again.");
                    }
                  } else {
                    // If already on correct chain, proceed with deployment
                    setTimeout(() => {
                      executeDeployment();
                    }, 500); // Small delay to ensure wallet is fully connected
                  }
                } catch (chainError) {
                  console.error("Error checking chain:", chainError);
                  // Proceed anyway as a fallback
                  setTimeout(() => {
                    executeDeployment();
                  }, 500);
                }
              })();
            } else {
              // Fallback if wallet provider not available
              setTimeout(() => {
                executeDeployment();
              }, 500);
            }
          }
        }
      }
    }, 1000); // Longer delay for initial check
    
    return () => clearTimeout(timer);
  }, [isConnected, address, targetNetwork.id, selectedNetwork, walletProvider, openAppKit, bytecode]);

  // Add a log function to track deployment progress
  const addDeploymentLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDeploymentLogs(prevLogs => [...prevLogs, logMessage]);
  }, []);

  // Define a function to execute deployment once connected
  const executeDeployment = async () => {
    if (!bytecode || !isBytecodeValid || !isConnected || !address || !walletProvider) {
      console.error("Cannot execute deployment - missing required inputs");
      return;
    }
    
    // Reset logs
    setDeploymentLogs([]);
    addDeploymentLog("Starting deployment process...");
    setIsDeploying(true);
    
    try {
      const trimmedBytecode = bytecode.trim();
      const deploymentBytecode = trimmedBytecode.startsWith('0x') ? trimmedBytecode : `0x${trimmedBytecode}`;
      
      addDeploymentLog(`Bytecode prepared (${deploymentBytecode.length} characters)`);
      
      // Validate bytecode format
      if (!/^0x[0-9a-fA-F]+$/.test(deploymentBytecode)) {
        console.error("Invalid bytecode format - not a valid hex string");
        throw new Error("Invalid bytecode format. Contract bytecode must be a valid hexadecimal string.");
      }
      
      // Check for odd length (which would indicate a half-byte at the end)
      if ((deploymentBytecode.length - 2) % 2 !== 0) {
        console.error("Invalid bytecode length - must have an even number of characters");
        throw new Error("Invalid bytecode length. Contract bytecode must have an even number of hex characters.");
      }
      
      // Get the selected chain
      const selectedChain = (viemChains as any)[selectedNetwork.value];
      addDeploymentLog(`Selected network: ${selectedNetwork.value} (ID: ${selectedChain?.id})`);
      
      // Add warning for large bytecode
      if (deploymentBytecode.length / 2 > 24000) {
        notification.info("Large bytecode detected. Deployment may fail due to size constraints.");
      }

      // Check if we have a network mismatch
      if (targetNetwork.id !== selectedChain.id) {
        notification.info(`Note: Your selected network (${selectedNetwork.value}) doesn't match your scaffold-eth target network (${targetNetwork.name}). This is fine, but be aware of the difference.`);
      }

      // Set gas parameters
      let gasLimitValue = gasLimit ? BigInt(parseInt(gasLimit)) : BigInt(3000000);
      const gasPriorityValue = gasPriority ? parseFloat(gasPriority) : undefined;
      
      // Prepare transaction
      interface TransactionData {
        from: string;
        data: string;
        chainId: string;
        gas: string;
        value?: string;
      }

      const txData: TransactionData = {
        from: address,
        data: deploymentBytecode,
        chainId: `0x${selectedChain.id.toString(16)}`,
        gas: `0x${gasLimitValue.toString(16)}`,
      };
      
      // Add value if needed
      if (valueToSend && parseFloat(valueToSend) > 0) {
        txData.value = `0x${(BigInt(parseFloat(valueToSend) * 1e18)).toString(16)}`;
      }
      
      // Log detailed transaction data for debugging
      console.log("Prepared transaction data:", {
        from: txData.from,
        dataLength: txData.data.length,
        chainId: txData.chainId,
        gas: txData.gas,
        value: txData.value,
        firstBytesOfData: txData.data.substring(0, 50) + '...',
        lastBytesOfData: '...' + txData.data.substring(txData.data.length - 50)
      });
      
      notification.info("Please confirm the transaction in your wallet");
      
      try {
        // Check wallet provider one more time before sending
        if (!walletProvider || !walletProvider.request) {
          console.error("Wallet provider not available at transaction time");
          throw new Error("Wallet provider disconnected. Please reconnect and try again.");
        }
        
        // First ensure we're on the right chain
        try {
          console.log("Calling wallet_switchEthereumChain to ensure correct network");
          await walletProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${selectedChain.id.toString(16)}` }]
          });
          console.log(`Successfully switched to chain ID: ${selectedChain.id}`);
        } catch (switchError) {
          console.log("Error switching chain, may already be on correct chain:", switchError);
          if ((switchError as any)?.code !== 4902) {
            // Try to add the network
            try {
              await walletProvider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${selectedChain.id.toString(16)}`,
                  chainName: selectedNetwork.label,
                  rpcUrls: [selectedChain.rpcUrls.default.http[0]],
                  blockExplorerUrls: [selectedChain.blockExplorers?.default?.url],
                  nativeCurrency: selectedChain.nativeCurrency
                }]
              });
              console.log(`Added network ${selectedNetwork.label} to wallet`);
            } catch (addError) {
              console.error("Error adding network:", addError);
              throw new Error(`Could not add network. Please add ${selectedNetwork.label} manually.`);
            }
          }
        }
        
        // Try to estimate gas before sending
        try {
          console.log("Attempting to estimate gas for deployment...");
          
          // Create a public client to use for gas estimation and transaction watching
          addDeploymentLog("Creating public client for gas estimation");
          
          // Use Alchemy RPC for Sepolia to avoid timeouts
          let rpcUrl = selectedChain.rpcUrls.default.http[0];
          if (selectedChain.id.toString() === '11155111') {
            rpcUrl = process.env.ALCHEMY_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/mnvC3BfLvzJlyk82vCLgBCD1gVCg_XX9';
            addDeploymentLog(`Using Alchemy RPC for Sepolia: ${rpcUrl}`);
          }
          
          const publicClient = createPublicClient({
            chain: selectedChain,
            transport: http(rpcUrl, {
              timeout: 30000, // 30 second timeout
              fetchOptions: {
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'viem/PureContracts'
                },
              },
            })
          });
          
          const gasEstimate = await publicClient.estimateGas({
            account: address as `0x${string}`,
            data: deploymentBytecode as `0x${string}`,
            value: valueToSend && parseFloat(valueToSend) > 0 
              ? BigInt(parseFloat(valueToSend) * 1e18) 
              : undefined
          }).catch(e => {
            console.error("Gas estimation failed:", e);
            return null; // Continue even if estimation fails
          });
          
          if (gasEstimate) {
            console.log(`Gas estimation successful: ${gasEstimate.toString()} units`);
            // Add 30% buffer for Sepolia to avoid out-of-gas errors
            if (selectedChain.id.toString() === '11155111') {
              const bufferedGas = gasEstimate * BigInt(130) / BigInt(100);
              addDeploymentLog(`Adding 30% buffer to gas estimate for Sepolia: ${bufferedGas.toString()} units`);
              txData.gas = `0x${bufferedGas.toString(16)}`;
              gasLimitValue = bufferedGas;
            } else {
              // For other chains, add 10% buffer
              const bufferedGas = gasEstimate * BigInt(110) / BigInt(100);
              addDeploymentLog(`Adding 10% buffer to gas estimate: ${bufferedGas.toString()} units`);
              txData.gas = `0x${bufferedGas.toString(16)}`;
              gasLimitValue = bufferedGas;
            }
          } else {
            console.warn("Could not estimate gas, using default limit");
          }
        } catch (estimateError) {
          console.error("Error estimating gas:", estimateError);
          // Continue with original gas limit
        }
        
        // Validate transaction params format
        const validationIssues = [];
        if (!txData.from || !isAddress(txData.from)) validationIssues.push("Invalid from address");
        if (!txData.data || !/^0x[0-9a-fA-F]+$/.test(txData.data)) validationIssues.push("Invalid data");
        if (!txData.chainId || !/^0x[0-9a-fA-F]+$/.test(txData.chainId)) validationIssues.push("Invalid chainId");
        if (!txData.gas || !/^0x[0-9a-fA-F]+$/.test(txData.gas)) validationIssues.push("Invalid gas");
        if (txData.value && !/^0x[0-9a-fA-F]+$/.test(txData.value)) validationIssues.push("Invalid value");
        
        if (validationIssues.length > 0) {
          console.error("Transaction validation issues:", validationIssues);
          notification.info("Transaction has formatting issues, but will attempt to send anyway");
        }
        
        // Create a proper contract deployment using Viem instead of sendTransaction
        console.log("Creating wallet client and deploying contract directly");
        try {
          // Additional validation for the bytecode
          if (!deploymentBytecode || deploymentBytecode === '0x') {
            throw new Error("Bytecode is empty. Cannot deploy an empty contract.");
          }
          
          // Check if bytecode looks like a valid contract (very basic check)
          if (!deploymentBytecode.startsWith('0x608060') && !deploymentBytecode.startsWith('0x60806040')) {
            console.warn("Bytecode doesn't start with common EVM contract patterns. This might not be a valid contract.");
            notification.info("Warning: Bytecode may not be a valid contract. Deployment may fail.");
          }
          
          // Warn if bytecode is too short
          if (deploymentBytecode.length < 100) {
            console.warn("Bytecode appears to be very short. This may not be a complete contract.");
            notification.info("Warning: Bytecode is very short. This may not be a complete contract.");
          }
          
          // Handle constructor arguments if provided
          let finalBytecode = deploymentBytecode;
          
          // Check if we have constructor arguments and ABI
          if (abi.length > 0 && abi[0].inputs && abi[0].inputs.length > 0 && Object.keys(constructorArgs).length > 0) {
            try {
              // Log that we're attempting to add constructor arguments
              console.log("Attempting to add constructor arguments to bytecode");
              
              // Get constructor inputs from ABI
              const constructorInputs = abi[0].inputs;
              
              // Prepare constructor args based on the ABI
              const args = constructorInputs.map((input: any, index: number) => {
                const paramName = input.name || `param${index + 1}`;
                const paramValue = constructorArgs[paramName] || '';
                
                // Simple validation based on type
                if (input.type.includes('int') && !/^\d+$/.test(paramValue)) {
                  throw new Error(`Constructor argument '${paramName}' should be a number for type ${input.type}`);
                }
                if (input.type === 'address' && !isAddress(paramValue)) {
                  throw new Error(`Constructor argument '${paramName}' should be a valid address`);
                }
                
                // Convert the value based on type
                if (input.type.includes('int')) {
                  return BigInt(paramValue);
                } else if (input.type === 'address') {
                  return paramValue as `0x${string}`;
                } else if (input.type === 'bool') {
                  return paramValue.toLowerCase() === 'true';
                } else {
                  return paramValue;
                }
              });
              
              // Log the constructor arguments for debugging
              console.log("Constructor arguments:", args);
              
              // Proper ABI encoding for constructor arguments
              try {
                // Convert ABI inputs to parameter types for encoding
                const abiParams = constructorInputs.map((input: any) => ({
                  name: input.name || '',
                  type: input.type
                }));
                
                // Encode the constructor arguments
                const encodedArgs = encodeAbiParameters(
                  abiParams,
                  args
                );
                
                console.log("Encoded constructor arguments:", encodedArgs);
                
                // Append encoded args to bytecode (removing the 0x from encoded args)
                finalBytecode = `${deploymentBytecode}${encodedArgs.slice(2)}`;
                
                console.log("Final bytecode with constructor args:", {
                  length: finalBytecode.length,
                  start: finalBytecode.substring(0, 50),
                  end: finalBytecode.substring(finalBytecode.length - 50)
                });
              } catch (encodeError) {
                console.error("Error encoding constructor arguments:", encodeError);
                notification.error("Failed to encode constructor arguments. Using bytecode without arguments.");
                // Fall back to using original bytecode
                finalBytecode = deploymentBytecode;
              }
            } catch (argError) {
              console.error("Error processing constructor arguments:", argError);
              notification.error(`Error with constructor arguments: ${argError instanceof Error ? argError.message : String(argError)}`);
              // Don't throw, just use the original bytecode
              finalBytecode = deploymentBytecode;
            }
          }
          
          // Create a wallet client using the wallet provider
          addDeploymentLog("Creating wallet client for deployment");
          const walletClient = createWalletClient({
            account: address as `0x${string}`,
            chain: selectedChain,
            transport: customTransport(walletProvider)
          });
          
          addDeploymentLog("Wallet client created, initiating contract deployment");
          
          // Deploy the contract directly using sendTransaction (proper method for deployment)
          try {
            // Create a public client to use for gas estimation and transaction watching
            addDeploymentLog("Creating public client for gas estimation");
            
            // Use Alchemy RPC for Sepolia to avoid timeouts
            let rpcUrl = selectedChain.rpcUrls.default.http[0];
            if (selectedChain.id.toString() === '11155111') {
              rpcUrl = process.env.ALCHEMY_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/mnvC3BfLvzJlyk82vCLgBCD1gVCg_XX9';
              addDeploymentLog(`Using Alchemy RPC for Sepolia: ${rpcUrl}`);
            }
            
            const publicClient = createPublicClient({
              chain: selectedChain,
              transport: http(rpcUrl, {
                timeout: 30000, // 30 second timeout
                fetchOptions: {
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'viem/PureContracts'
                  },
                },
              })
            });
            
            // Get nonce for the transaction
            const nonce = await publicClient.getTransactionCount({
              address: address as `0x${string}`,
            }).catch(e => {
              console.error("Error getting nonce:", e);
              return undefined;
            });
            
            addDeploymentLog(`Using account: ${address} on chain: ${selectedChain.name} (${selectedChain.id})`);
            addDeploymentLog(`Nonce: ${nonce !== undefined ? nonce : 'undefined (using wallet default)'}`);
            
            // Add better error handling around the actual transaction
            try {
              // Deploy the contract
              addDeploymentLog("Sending transaction to wallet for signing...");
              let txHash;
              try {
                txHash = await walletClient.sendTransaction({
                  account: address as `0x${string}`,
                  to: undefined, // contract creation
                  data: finalBytecode as `0x${string}`,
                  value: valueToSend && parseFloat(valueToSend) > 0 
                    ? BigInt(parseFloat(valueToSend) * 1e18)
                    : undefined,
                  gas: gasLimitValue,
                  nonce,
                  chain: selectedChain, // Explicitly include chain to prevent chain mismatch
                  maxFeePerGas: undefined, // Let wallet determine automatically
                  maxPriorityFeePerGas: undefined, // Let wallet determine automatically
                });
              } catch (primaryDeployError) {
                console.error("Primary deployment method failed:", primaryDeployError);
                
                // Process the error to extract useful information
                const { message, details } = handleDeploymentError(primaryDeployError);
                addDeploymentLog(`Error: ${message} - ${details}`);
                
                // If the primary method fails with RPC errors, try the alternative method
                if (
                  primaryDeployError instanceof Error && 
                  (primaryDeployError.message.includes("RPC error") || 
                   primaryDeployError.message.includes("unknown error") ||
                   primaryDeployError.message.includes("timeout") ||
                   primaryDeployError.message.includes("network"))
                ) {
                  notification.info(`Primary deployment method failed: ${message}. Trying alternative approach...`);
                  addDeploymentLog("Switching to alternative deployment method");
                  
                  // Try alternative deployment method
                  txHash = await tryAlternativeDeployment(
                    address as `0x${string}`,
                    finalBytecode as `0x${string}`, 
                    selectedChain,
                    gasLimitValue,
                    valueToSend && parseFloat(valueToSend) > 0 
                      ? BigInt(parseFloat(valueToSend) * 1e18) 
                      : undefined,
                    nonce,
                    walletProvider
                  );
                } else {
                  // If it's not an RPC error, rethrow
                  throw primaryDeployError;
                }
              }
              
              addDeploymentLog(`Transaction sent successfully with hash: ${txHash}`);
              console.log("Transaction sent successfully:", txHash);
              setDeploymentTx(txHash);
              notification.success("Contract deployment transaction sent!");
              
              // Monitor for receipt
              addDeploymentLog("Monitoring transaction for confirmation...");
              console.log(`Waiting for transaction receipt for ${txHash}...`);
              const receiptPromise = publicClient.waitForTransactionReceipt({
                hash: txHash
              });
              
              // Set a timeout to handle long-running transactions
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error("Transaction confirmation timed out after 5 minutes"));
                }, 5 * 60 * 1000); // 5 minutes timeout
              });
              
              // Race between receipt and timeout
              Promise.race([receiptPromise, timeoutPromise])
                .then((receipt) => {
                  console.log("Transaction receipt received:", receipt);
                  
                  if (receipt.status === 'success') {
                    const contractAddress = receipt.contractAddress;
                    if (contractAddress) {
                      setDeployedAddress(contractAddress);
                      notification.success(`Contract deployed at ${contractAddress}`);
                      
                      // Try to verify the contract if source code is provided
                      if (sourceCode && contractName) {
                        verifySourcify(contractAddress, selectedChain.id);
                      }
                    }
                  } else {
                    notification.error("Deployment failed. Check the transaction on the explorer.");
                  }
                  
                  // Disconnect wallet after transaction complete
                  setTimeout(() => {
                    disconnectWallet();
                  }, 2000);
                })
                .catch((error) => {
                  console.error("Error monitoring transaction:", error);
                  notification.info("Stopped monitoring transaction. Check the explorer for status.");
                  // Disconnect after timeout or error
                  disconnectWallet();
                })
                .finally(() => {
                  setIsDeploying(false);
                });
            } catch (sendError: any) {
              // Handle specific error types
              console.error("Error in contract deployment:", sendError);
              
              // Create a more detailed error message
              let errorMessage = "Contract deployment failed";
              let errorDetails = "";
              
              if (sendError?.code === -32603) {
                errorMessage = "Internal JSON-RPC error";
                errorDetails = "This may be due to insufficient funds for gas or a network issue.";
              } else if (sendError?.code === 4001) {
                errorMessage = "Transaction rejected by user";
                errorDetails = "You declined the transaction in your wallet.";
              } else if (typeof sendError === 'object' && sendError !== null) {
                // Try to extract meaningful information from the error
                errorMessage = sendError.message || "Unknown error";
                if (sendError.details) {
                  errorDetails = sendError.details;
                } else if (sendError.data) {
                  errorDetails = typeof sendError.data === 'string' ? sendError.data : JSON.stringify(sendError.data);
                }
              }
              
              // Check for "insufficient funds" in the error message
              if (errorMessage.toLowerCase().includes("insufficient funds") || 
                  (errorDetails && errorDetails.toLowerCase().includes("insufficient funds"))) {
                notification.error("Insufficient funds for gas. Please add ETH to your wallet.");
              } else if (errorMessage.toLowerCase().includes("reject") || 
                         errorMessage.toLowerCase().includes("denied") || 
                         errorMessage.toLowerCase().includes("cancel")) {
                notification.info("Transaction rejected by user");
              } else {
                notification.error(`${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`);
              }
              
              throw sendError; // Propagate to outer catch
            }
          } catch (error) {
            console.error("Error in contract deployment:", error);
            addDeploymentLog(`Deployment error: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
          }
        } catch (error) {
          console.error("Error in contract deployment:", error);
          addDeploymentLog(`Deployment error: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
      } catch (error) {
        console.error("Error sending deployment transaction:", error);
        
        // Extract meaningful error information with more detail
        let errorMessage = "Unknown error";
        let errorDetails = {};
        
        if (error instanceof Error) {
          errorMessage = error.message || "Unknown error";
          errorDetails = {
            name: error.name,
            message: error.message,
            stack: error.stack
          };
          console.error("Error details:", errorDetails);
        } else if (typeof error === 'object' && error !== null) {
          try {
            errorMessage = JSON.stringify(error);
            errorDetails = error;
            console.error("Error object:", error);
          } catch (e) {
            console.error("Error stringifying error:", e);
          }
        }
        
        if (errorMessage === '{}' || errorMessage === '') {
          console.error("Empty error received. Wallet may have silently rejected the transaction");
          errorMessage = "The wallet rejected the transaction. This could be due to wallet configuration, network issues, insufficient funds, or contract bytecode issues.";
        }
        
        // Handle user rejection separately
        if (error instanceof Error && 
            (error.message.includes('rejected') || 
             error.message.includes('denied') || 
             error.message.includes('cancelled'))) {
          notification.info("Transaction rejected by user");
        } else {
          notification.error(`Failed to send transaction: ${errorMessage}`);
        }
        
        setIsDeploying(false);
        // Always disconnect after error
        disconnectWallet();
      }
    } catch (error) {
      console.error("Error preparing contract deployment:", error);
      addDeploymentLog(`Error preparing deployment: ${error instanceof Error ? error.message : String(error)}`);
      notification.error("Failed to deploy contract: " + (error instanceof Error ? error.message : String(error)));
      setIsDeploying(false);
      // Always disconnect after error
      disconnectWallet();
    }
  };

  // Modify deployContract to handle connection flow first
  const deployContract = async () => {
    console.log("Starting contract deployment process...");
    
    if (!bytecode || !isBytecodeValid) {
      notification.error("Invalid bytecode format");
      return;
    }
    
    // Get the selected chain ID first
    const selectedChain = (viemChains as any)[selectedNetwork.value];
    if (!selectedChain) {
      notification.error("Invalid network selected");
      return;
    }
    
    // Check if wallet is connected, if not prompt to connect
    if (!isConnected || !address) {
      notification.info("Please connect your wallet first");
      try {
        // Store flag and chain ID to continue deployment after connection
        window.sessionStorage.setItem('pendingDeployment', 'true');
        window.sessionStorage.setItem('pendingDeploymentChainId', selectedChain.id.toString());
        console.log(`Stored pending deployment with chain ID: ${selectedChain.id}`);
        openAppKit();
        return;
      } catch (error) {
        console.error("Error opening wallet:", error);
        notification.error("Could not open wallet connection");
        return;
      }
    }
    
    // Check if wallet is on the correct chain
    try {
      if (walletProvider && walletProvider.request) {
        // Get current chain ID
        const chainIdHex = await walletProvider.request({ method: 'eth_chainId', params: [] });
        const currentChainId = parseInt(chainIdHex, 16);
        
        console.log(`Current chain ID: ${currentChainId}, Target chain ID: ${selectedChain.id}`);
        
        // If chains don't match, ask user to switch networks
        if (currentChainId !== selectedChain.id) {
          notification.info(`Please switch your wallet to ${selectedChain.name} (Chain ID: ${selectedChain.id})`);
          
          try {
            // Try to switch chains automatically
            await walletProvider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${selectedChain.id.toString(16)}` }],
            });
            
            notification.success(`Switched to ${selectedChain.name}`);
            
            // Small delay to ensure wallet has updated
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to the wallet
            if (switchError.code === 4902 || switchError.message?.includes('wallet_addEthereumChain')) {
              try {
                await walletProvider.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: `0x${selectedChain.id.toString(16)}`,
                      chainName: selectedChain.name,
                      nativeCurrency: {
                        name: selectedChain.nativeCurrency.name,
                        symbol: selectedChain.nativeCurrency.symbol,
                        decimals: selectedChain.nativeCurrency.decimals
                      },
                      rpcUrls: selectedChain.rpcUrls.default.http,
                      blockExplorerUrls: selectedChain.blockExplorers ? 
                        [selectedChain.blockExplorers.default.url] : undefined
                    },
                  ],
                });
                
                notification.success(`Added and switched to ${selectedChain.name}`);
                
                // Small delay to ensure wallet has updated
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (addError) {
                console.error("Error adding chain:", addError);
                notification.error(`Could not add ${selectedChain.name} to your wallet. Please switch manually.`);
                return;
              }
            } else {
              console.error("Error switching chains:", switchError);
              notification.error("Could not switch networks. Please switch manually in your wallet.");
              return;
            }
          }
        }
      }
    } catch (chainError) {
      console.error("Error checking chain:", chainError);
      notification.info("Could not verify current network. Attempting deployment anyway.");
    }
    
    // Proceed with deployment
    await executeDeployment();
  };

  // Ensure Sourcify verification function is properly defined
  const verifySourcify = async (address: string, chainId: number) => {
    try {
      setIsVerifying(true);
      setVerificationStatus('pending');

      // Create metadata
      const metadata = {
        language: 'Solidity',
        sources: {
          [`${contractName}.sol`]: {
            content: sourceCode
          }
        },
        settings: {
          optimizer: compilerSettings.optimizer,
          evmVersion: compilerSettings.evmVersion,
          compilationTarget: {
            [`${contractName}.sol`]: contractName
          }
        }
      };

      // Create form data
      const formData = new FormData();
      formData.append('address', address);
      formData.append('chain', chainId.toString());
      formData.append('files', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
      formData.append('chosenContract', '0'); // First contract in the file

      // Submit to Sourcify
      const response = await fetch(`${SOURCIFY_API}/verify`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        notification.success('Contract verified successfully on Sourcify!');
        setVerificationStatus('success');
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      notification.error('Contract verification failed');
      setVerificationStatus('failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Function to check transaction receipt
  const checkTransactionReceipt = async (txHash: string, chainId: number) => {
    try {
      // Create a provider for the selected network
      const provider = createPublicClient({
        chain: (viemChains as any)[selectedNetwork.value],
        transport: http()
      });

      // Try to get the receipt
      const receipt = await provider.waitForTransactionReceipt({
        hash: txHash as `0x${string}`
      });

      console.log("Transaction receipt:", receipt);

      if (receipt.status === 'success') {
        // Get the contract address from the receipt
        const contractAddress = receipt.contractAddress;
        if (contractAddress) {
          setDeployedAddress(contractAddress);
          notification.success(`Contract deployed at ${contractAddress}`);
          
          // Try to verify the contract if source code is provided
          if (sourceCode && contractName) {
            verifySourcify(contractAddress, chainId);
          }
          
          // Disconnect wallet after successful deployment
          setTimeout(() => {
            disconnectWallet();
          }, 2000); // Give a moment for the UI to update
        }
      } else {
        notification.error("Transaction failed");
      }
    } catch (error) {
      console.error("Error checking receipt:", error);
      notification.error("Failed to get transaction receipt");
    } finally {
      setIsDeploying(false);
    }
  };

  // Add a function to handle wallet disconnection
  const disconnectWallet = () => {
    console.log("Disconnecting wallet");
    try {
      disconnect();
      setUserAddress(null);
      notification.info("Wallet disconnected after successful deployment");
      
      // Reset deployment state
      setDeploymentTx(null);
      setIsDeploying(false);
      setIsExecuting(false);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      notification.error("Failed to disconnect wallet: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Add a manual reinitialization function
  const reinitializeAppKit = () => {
    console.log("Manually reinitializing AppKit...");
    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';
      const ethersAdapter = new EthersAdapter();
      const networks = [mainnet, arbitrum, sepolia] as [AppKitNetwork, ...AppKitNetwork[]];
      
      createAppKit({
        adapters: [ethersAdapter],
        networks,
        metadata: {
          name: 'PureContracts',
          description: 'Secure and transparent smart contract interactions',
          url: window.location.origin,
          icons: ['https://purecontracts.com/logo.png'], 
        },
        projectId,
        themeMode: 'dark',
        features: {
          analytics: true,
        },
        themeVariables: {
          '--w3m-accent': '#3b82f6',
        },
      });
      
      // Force refresh the flag
      (window as any).__APPKIT_INITIALIZED__ = true;
      
      notification.info("AppKit reinitialized. Try connecting again.");
      
      // Try opening after a short delay
      setTimeout(() => {
        openAppKit();
      }, 200);
    } catch (error) {
      console.error("Failed to reinitialize AppKit:", error);
      notification.error("Failed to reinitialize AppKit. Please refresh the page.");
    }
  };

  // Update the test connection function
  const testWalletConnection = () => {
    console.log("Testing wallet connection");
    
    if (!isConnected) {
      try {
        // Try opening AppKit first
        openAppKit();
        notification.info("Please connect your wallet");
      } catch (error) {
        console.error("Error opening AppKit:", error);
        // If opening fails, try reinitializing
        reinitializeAppKit();
      }
    } else {
      notification.success("Already connected as: " + address);
      // Add option to disconnect - fix linter error by using a different API
      notification.info("Click disconnect to test disconnection");
      // Manually add a disconnect button instead of using actions in notification
      setTimeout(() => {
        const disconnectButton = document.createElement('button');
        disconnectButton.innerText = 'Disconnect';
        disconnectButton.onclick = disconnectWallet;
        disconnectButton.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium mt-2 ml-2';
        document.querySelector('.scaffold-eth-notification')?.appendChild(disconnectButton);
      }, 100);
    }
  };

  // Get all available chains for the select dropdown
  const options: ChainOption[] = Object.keys(viemChains)
    .filter(key => {
      const chain = (viemChains as any)[key];
      return typeof chain === 'object' && 'id' in chain;
    })
    .map(chain => ({ 
      value: chain as ChainName, 
      label: chain 
    }));

  const handleNetworkChange = (selected: SingleValue<ChainOption>) => {
    if (selected) {
      setSelectedNetwork(selected);
    }
  };

  // Check if bytecode is valid
  const validateBytecode = (code: string) => {
    // Bytecode should be a hex string starting with 0x
    const isValidHex = /^0x[0-9a-fA-F]+$/.test(code);
    setIsBytecodeValid(isValidHex || code === '');
    setIsBytecodeTooLong(code.length > 100000);
    return isValidHex;
  };

  const handleBytecodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newBytecode = e.target.value;
    setBytecode(newBytecode);
    validateBytecode(newBytecode);
  };

  // Parse ABI from bytecode if possible
  const parseABI = (code: string) => {
    // In a real application, you might use tools like etherscan API to get ABI
    // For simplicity, let's allow the user to manually input constructor args
    try {
      // Look for metadata in the bytecode (simplified approach)
      const metadataPos = code.lastIndexOf('a264697066735822');
      if (metadataPos !== -1) {
        notification.info("Detected contract metadata in bytecode");
      }
      
      // For now, we'll just assume a simple constructor with uint256 and address parameters
      const dummyConstructor = {
        type: 'constructor',
        inputs: [
          { name: 'param1', type: 'uint256' },
          { name: 'param2', type: 'address' },
        ],
        stateMutability: 'nonpayable'
      };
      
      setAbi([dummyConstructor]);
      setConstructorArgs({ param1: '', param2: '' });
    } catch (error) {
      console.error("Error parsing ABI:", error);
    }
  };

  // Parse ABI from JSON input
  const handleAbiInput = (abiString: string) => {
    try {
      const parsedAbi = JSON.parse(abiString);
      
      // Find the constructor in the ABI
      const constructor = parsedAbi.find((item: any) => item.type === 'constructor');
      
      if (constructor) {
        setAbi([constructor]);
        
        // Initialize constructor arguments
        const args: {[key: string]: string} = {};
        constructor.inputs.forEach((input: any, index: number) => {
          args[input.name || `param${index + 1}`] = '';
        });
        
        setConstructorArgs(args);
        notification.success("Constructor ABI loaded successfully!");
      } else {
        notification.info("No constructor found in ABI");
      }
    } catch (error) {
      notification.error("Invalid ABI format");
    }
  };

  // Handle constructor argument change
  const handleArgChange = (name: string, value: string) => {
    setConstructorArgs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper function for explorer URLs
  const getExplorerUrl = (chainId: number, hash: string): string | undefined => {
    // Define explorer base URLs for common networks
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      5: 'https://goerli.etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      137: 'https://polygonscan.com',
      80001: 'https://mumbai.polygonscan.com',
      42161: 'https://arbiscan.io',
      421613: 'https://goerli.arbiscan.io',
      10: 'https://optimistic.etherscan.io',
      420: 'https://goerli-optimism.etherscan.io',
      56: 'https://bscscan.com',
      97: 'https://testnet.bscscan.com',
      43114: 'https://snowtrace.io',
      43113: 'https://testnet.snowtrace.io',
    };
    
    const baseUrl = explorers[chainId];
    if (!baseUrl) return undefined;
    
    return `${baseUrl}/tx/${hash}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center py-10">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Deploy your</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
            Smart Contract
          </span>
        </h1>
        <p className="text-lg text-gray-300">
          Input your{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            contract bytecode
          </code>{" "}
          and deploy directly to the blockchain
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-grow px-4 pb-10 gap-6">
        {/* Left Column - Deployment Form */}
        <div className="md:w-1/2">
          <div className="w-full mb-4">
            <label htmlFor="networkSelector" className="block text-sm font-medium text-gray-300 mb-2">
              Target Network:
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

          <div className="mb-4">
            <label htmlFor="bytecodeInput" className="block text-sm font-medium text-gray-300 mb-2">
              Contract Bytecode:
            </label>
            <textarea
              id="bytecodeInput"
              className={`w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border ${
                isBytecodeValid ? 'border-gray-700' : 'border-red-500'
              } text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              rows={6}
              placeholder="Enter contract bytecode (0x...)"
              value={bytecode}
              onChange={handleBytecodeChange}
            />
            {!isBytecodeValid && (
              <p className="mt-1 text-sm text-red-500">
                Invalid bytecode format. Should be a hex string starting with 0x.
              </p>
            )}
            {isBytecodeTooLong && (
              <p className="mt-1 text-sm text-yellow-500">
                Warning: Bytecode is very long, which may result in high gas fees or failed deployment due to gas limits.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="valueInput" className="block text-sm font-medium text-gray-300 mb-2">
                Value to Send (wei):
              </label>
              <input
                id="valueInput"
                type="text"
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                value={valueToSend}
                onChange={(e) => setValueToSend(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="gasLimitInput" className="block text-sm font-medium text-gray-300 mb-2">
                Gas Limit (optional):
              </label>
              <input
                id="gasLimitInput"
                type="text"
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6000000"
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="priorityFeeInput" className="block text-sm font-medium text-gray-300 mb-2">
              Max Priority Fee (Gwei):
            </label>
            <input
              id="priorityFeeInput"
              type="text"
              className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.5"
              value={gasPriority}
              onChange={(e) => setGasPriority(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contract Name:
            </label>
            <input
              type="text"
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
              placeholder="MyContract"
              className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Code:
            </label>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyContract {
    // Your contract code here
}"
              className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 font-mono"
              rows={10}
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Compiler Version:
              </label>
              <select
                value={compilerSettings.version}
                onChange={(e) => setCompilerSettings({
                  ...compilerSettings,
                  version: e.target.value
                })}
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              >
                <option value="0.8.20">0.8.20</option>
                <option value="0.8.19">0.8.19</option>
                <option value="0.8.18">0.8.18</option>
                <option value="0.8.17">0.8.17</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                EVM Version:
              </label>
              <select
                value={compilerSettings.evmVersion}
                onChange={(e) => setCompilerSettings({
                  ...compilerSettings,
                  evmVersion: e.target.value
                })}
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100"
              >
                <option value="paris">Paris</option>
                <option value="london">London</option>
                <option value="berlin">Berlin</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Optimizer Settings:
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={compilerSettings.optimizer.enabled}
                  onChange={(e) => setCompilerSettings({
                    ...compilerSettings,
                    optimizer: {
                      ...compilerSettings.optimizer,
                      enabled: e.target.checked
                    }
                  })}
                  className="mr-2"
                />
                Enable Optimizer
              </label>
              <input
                type="number"
                value={compilerSettings.optimizer.runs}
                onChange={(e) => setCompilerSettings({
                  ...compilerSettings,
                  optimizer: {
                    ...compilerSettings.optimizer,
                    runs: parseInt(e.target.value) || 200
                  }
                })}
                placeholder="Optimizer runs"
                className="w-24 p-2 rounded bg-gray-800/50 border border-gray-700 text-gray-100"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Constructor Arguments (ABI):
            </label>
            <div className="flex items-center mb-2">
              <input
                type="file"
                id="abiUpload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      if (e.target?.result) {
                        handleAbiInput(e.target.result as string);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
              <label
                htmlFor="abiUpload"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white cursor-pointer flex items-center transition-colors"
              >
                <CodeBracketIcon className="h-4 w-4 mr-2" />
                Upload ABI
              </label>
              <span className="ml-2 text-xs text-gray-400">(Optional: Upload ABI to parse constructor arguments)</span>
            </div>
          </div>

          {/* Constructor Arguments */}
          {abi.length > 0 && abi[0].inputs && abi[0].inputs.length > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-gray-800/70 backdrop-blur-sm border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Constructor Arguments:</h3>
              <div className="space-y-3">
                {abi[0].inputs.map((input: any, index: number) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-400 mb-1">
                      {input.name || `Parameter ${index + 1}`} ({input.type})
                    </label>
                    <input
                      type="text"
                      className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder={`Enter ${input.type} value`}
                      value={constructorArgs[input.name || `param${index + 1}`] || ''}
                      onChange={(e) => handleArgChange(input.name || `param${index + 1}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={deployContract}
            disabled={!bytecode || !isBytecodeValid || isDeploying}
            className={`w-full px-6 py-3 rounded-lg shadow-lg transition-colors ${
              !bytecode || !isBytecodeValid || isDeploying
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
            } font-medium flex justify-center items-center`}
          >
            {isDeploying ? (
              <>
                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                Deploying...
              </>
            ) : (
              <>
                <CodeBracketIcon className="mr-2 h-5 w-5" />
                Deploy Contract
              </>
            )}
          </button>
          
          {/* Update the test button to add reinitialize option */}
          <div className="mt-4 space-y-2">
            
            {/* Display QR modal state for debugging */}
            <div className="mt-3 p-3 rounded-lg bg-gray-800 text-gray-300 text-xs">
            </div>
          </div>

          {(isDeploying || isExecuting) && (
            <div className="mt-3 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
              <p className="text-center mb-2">
                Deployment in progress. Please check your wallet for confirmation requests.
              </p>
              <button
                onClick={() => {
                  console.log("Cancelling transaction");
                  setIsDeploying(false);
                }}
                className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Deployment Results/Info */}
        <div className="md:w-1/2">
          <div className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 h-full">
            {deployedAddress ? (
              <div className="space-y-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
                  Deployment Successful!
                </h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Contract Address:</h3>
                  <div className="p-3 bg-gray-900 rounded-lg break-all">
                    <code className="text-green-400">{deployedAddress}</code>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Verification Status:</h3>
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      {verificationStatus === 'pending' && (
                        <>
                          <ArrowPathIcon className="animate-spin h-5 w-5 text-yellow-400" />
                          <span className="text-yellow-400">Verifying...</span>
                        </>
                      )}
                      {verificationStatus === 'success' && (
                        <>
                          <DocumentCheckIcon className="h-5 w-5 text-green-400" />
                          <span className="text-green-400">Verified on Sourcify</span>
                        </>
                      )}
                      {verificationStatus === 'failed' && (
                        <>
                          <span className="text-red-400">Verification Failed</span>
                          <button
                            onClick={() => verifySourcify(deployedAddress, (viemChains as any)[selectedNetwork.value].id)}
                            className="ml-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                          >
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Transaction Hash:</h3>
                  <div className="p-3 bg-gray-900 rounded-lg break-all">
                    <code className="text-purple-400">{deploymentTx}</code>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Next Steps:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-300">
                    <li>Verify your contract on the block explorer</li>
                    <li>Interact with your contract using the Contract Reader</li>
                    <li>Share your contract address with others</li>
                  </ul>
                </div>
              </div>
            ) : deploymentTx ? (
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-xl font-bold text-gray-100 mb-2">Transaction Sent</h2>
                <p className="text-gray-400 mb-4">
                  Your contract deployment transaction has been submitted to the network.
                  <br />
                  You can view the status on the block explorer.
                </p>
                <div className="w-full p-3 bg-gray-900 rounded-lg break-all">
                  <span className="text-xs text-gray-500">Transaction Hash:</span>
                  <div className="flex items-center mt-1">
                    <code className="text-sm text-purple-400">{deploymentTx}</code>
                    {getExplorerUrl((viemChains as any)[selectedNetwork.value]?.id, deploymentTx) && (
                      <a 
                        href={getExplorerUrl((viemChains as any)[selectedNetwork.value]?.id, deploymentTx)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 px-2 py-1 text-xs bg-blue-800 hover:bg-blue-700 rounded text-white"
                      >
                        View on Explorer
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Add deployment logs */}
                <div className="w-full mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-blue-400">Deployment Logs</h3>
                    <button
                      onClick={() => setShowDebugInfo(!showDebugInfo)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                    >
                      {showDebugInfo ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                  
                  {showDebugInfo && (
                    <div className="h-48 overflow-y-auto p-2 bg-gray-900 font-mono text-xs rounded border border-gray-700">
                      {deploymentLogs.length > 0 ? (
                        deploymentLogs.map((log, index) => (
                          <div key={index} className="text-gray-300 mb-1">
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 italic">No logs recorded</div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Add troubleshooting tips */}
                <DeploymentTroubleshooting 
                  error={deploymentLogs.find(log => log.includes("Error")) || null} 
                  bytecodeLength={bytecode.length}
                  network={selectedNetwork.label}
                />
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
                  Deploy a Smart Contract
                </h2>
                
                <div className="space-y-5 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">What you'll need:</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Contract bytecode (compiled Solidity contract)</li>
                      <li>Constructor arguments (if applicable)</li>
                      <li>Connected wallet with funds for gas fees</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">Steps to deploy:</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Select the target network for deployment</li>
                      <li>Connect your wallet to the selected network</li>
                      <li>Paste your contract bytecode</li>
                      <li>Set optional parameters (value to send, gas limit)</li>
                      <li>Upload ABI and provide constructor arguments (if needed)</li>
                      <li>Click "Deploy Contract" and confirm in your wallet</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">Where to get bytecode?</h3>
                    <p className="mb-2">
                      You can obtain contract bytecode by:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Compiling Solidity code using Remix or Hardhat</li>
                      <li>Using the "evm.deployedBytecode" output from a compiler</li>
                      <li>Extracting from a verified contract on a block explorer</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-700/50 mt-6">
                    <h3 className="font-semibold text-yellow-400 mb-2">Important Notes:</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300">
                      <li>Contract deployment consumes gas. Make sure your wallet has enough funds</li>
                      <li>Large contracts may require higher gas limits</li>
                      <li>Double-check your constructor arguments before deploying</li>
                      <li>Contracts cannot be undone once deployed</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Connection info at the bottom */}
      <div className="fixed bottom-4 right-4 p-3 bg-gray-800 rounded-lg text-xs text-gray-300 z-10">
        <h3>Debug Information</h3>
        <div>
          <p>Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
          {address && <p>Address: {address.slice(0, 8)}...{address.slice(-6)}</p>}
          <p>Chain: {(viemChains as any)[selectedNetwork.value]?.id || 'None'}</p>
          <p>Provider: {walletProviderState.isAvailable ? '✅' : '❌'} {walletProviderState.hasRequest ? '✅ Can Request' : '❌ No Request'}</p>
          <p>Checked: {walletProviderState.lastCheckTime ? new Date(walletProviderState.lastCheckTime).toLocaleTimeString() : 'Never'}</p>
          <p>Target ID: {targetNetwork.id} | Selected ID: {(viemChains as any)[selectedNetwork.value]?.id}</p>
          {isDeploying && <p className="text-yellow-400">⏳ Deploying...</p>}
          {transactionHash && <p className="text-green-400">TX: {transactionHash.slice(0, 8)}...</p>}
          <button 
            onClick={testWalletConnection}
            className="btn btn-sm btn-primary"
          >
            Test Wallet Connection
          </button>
        </div>
      </div>
    </div>
  );
} 