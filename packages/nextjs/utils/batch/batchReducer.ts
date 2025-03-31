import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BatchOperation } from '../../types/batch';
import { initializePorto } from '../porto';
import {
  createWalletClient,
  parseEther,
  encodeFunctionData,
  custom,
  Address,
} from 'viem';

// Remove the global declaration that's causing type conflicts

interface BatchState {
  operations: BatchOperation[];
  isLoading: boolean;
  showPanel: boolean;
  // Actions
  addOperation: (operation: BatchOperation) => void;
  removeOperation: (index: number) => void;
  clearOperations: () => void;
  setLoading: (isLoading: boolean) => void;
  togglePanel: (show?: boolean) => void;
}

export const useBatchStore = create<BatchState>()(
  persist(
    (set) => ({
      operations: [],
      isLoading: false,
      showPanel: false,

      addOperation: (operation) =>
        set((state) => {
          const newOperations = [...state.operations, operation];
          return { operations: newOperations, showPanel: true };
        }),

      removeOperation: (index) =>
        set((state) => {
          const newOperations = state.operations.filter((_, i) => i !== index);
          return { operations: newOperations };
        }),

      clearOperations: () => set({ operations: [] }),

      setLoading: (isLoading) => set({ isLoading }),
      
      togglePanel: (show) => 
        set((state) => ({ showPanel: show !== undefined ? show : !state.showPanel })),
    }),
    {
      name: 'batch-operations-storage',
      // Save only the operations array to storage
      partialize: (state) => ({ operations: state.operations }),
    }
  )
);

// Function to check if the browser supports EIP-7702
const supportsEIP7702 = async () => {
  if (typeof window === 'undefined' || !window.ethereum) return false;
  
  try {
    // Check if the wallet supports signAuthorization method
    const capabilities = await window.ethereum.request({ 
      method: 'wallet_getCapabilities' 
    }).catch(() => ({}));

    return !!(capabilities && capabilities.eip7702);
  } catch (error) {
    console.warn('Failed to check EIP-7702 support:', error);
    return false;
  }
};

// Traditional sequential execution of batch operations
const executeTraditionalBatch = async () => {
  const { operations, clearOperations } = useBatchStore.getState();
  
  if (operations.length === 0) {
    throw new Error("No operations in batch");
  }

  console.info(`Preparing to execute ${operations.length} operations sequentially`);

    // Check if wallet is connected
    if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error("Ethereum provider not available. Please use a Web3 browser.");
    }
    
    const ethers = await import('ethers');
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Execute each operation sequentially
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      console.info(`Processing operation ${i + 1}/${operations.length}: ${operation.description}`);

      try {
        // Prepare transaction request
        const txRequest = {
          to: operation.to,
          data: operation.data,
          value: operation.value !== '0' ? ethers.parseEther(operation.value) : BigInt(0),
        };

        // Estimate gas with a buffer to avoid "out of gas" errors
        let gasEstimate;
        try {
          gasEstimate = await provider.estimateGas({
            ...txRequest,
            from: await signer.getAddress(),
          });
          // Add 20% buffer
          gasEstimate = (gasEstimate * BigInt(120)) / BigInt(100);
        } catch (error) {
          console.error("Gas estimation failed:", error);
          
          // Check for common error causes
          if (operation.to === await signer.getAddress()) {
            throw new Error("Cannot send transaction to yourself");
          }
          
          // Attempt to extract revert reason if available
          const errorMessage = (error as Error).message;
          if (errorMessage.includes("execution reverted")) {
            throw new Error(`Transaction would fail: ${errorMessage}`);
          }
          
          // Fall back to default gas limit if estimation fails
          gasEstimate = BigInt(300000);
          console.info(`Could not estimate gas. Using default limit: ${gasEstimate.toString()}`);
        }

        // Send transaction
        const tx = await signer.sendTransaction({
          ...txRequest,
          gasLimit: gasEstimate,
        });

        console.info(`Operation ${i + 1} sent! Transaction hash: ${tx.hash}`);
        
        // Wait for confirmation
        console.info(`Waiting for confirmation of operation ${i + 1}...`);
        const receipt = await tx.wait();
        console.info(`Operation ${i + 1} confirmed in block ${receipt?.blockNumber}!`);
        
      } catch (error) {
        console.error(`Failed to execute operation ${i + 1}:`, error);
        
        // Ask user if they want to continue with remaining operations
        if (i < operations.length - 1) {
          const continueExecution = window.confirm(
            `Operation ${i + 1} failed: ${(error as Error).message}\n\nDo you want to continue with the remaining operations?`
          );
          
          if (!continueExecution) {
            console.info("Batch execution stopped by user");
            break;
          }
        } else {
          alert(`Failed to execute operation ${i + 1}: ${(error as Error).message}`);
        }
      }
    }

    console.info(`Batch execution completed`);
    // Clear the batch after successful execution
    clearOperations();
};

// Define type for ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

// EIP-7702 batch execution with a single signature
const executeEIP7702Batch = async () => {
  const { operations, clearOperations } = useBatchStore.getState();
  
  if (operations.length === 0) {
    throw new Error("No operations in batch");
  }

  console.info(`Preparing to execute ${operations.length} operations with EIP-7702`);

  // Check if wallet is connected
  if (typeof window === 'undefined') {
    throw new Error("Browser environment required");
  }

  try {
    // Check for ethereum provider with type assertion
    if (!window.ethereum) {
      throw new Error("No Ethereum provider available. Please connect a Web3 wallet.");
    }
    
    // All ethereum interactions inside try/catch
    try {
      // Get the user's account
      // @ts-ignore - We've already checked that window.ethereum exists
      const [account] = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      // Import everything we need from viem
      const { 
        createWalletClient,
        custom,
        encodeFunctionData,
        parseEther
      } = await import('viem');
      
      // Create a wallet client 
      // @ts-ignore - We've already checked that window.ethereum exists
      const walletClient = createWalletClient({
        account: account as `0x${string}`,
        transport: custom(window.ethereum)
      });
      
      // For the contractAddress, we use the user's address for self-execution
      const userAddress = account as `0x${string}`;
      
      console.info(`Setting up EIP-7702 transaction for address: ${userAddress}`);
      
      // Check if the wallet supports EIP-7702 directly via a capability check
      let supportsEIP7702Direct = false;
      try {
        // @ts-ignore - We've already checked that window.ethereum exists
        const capabilities = await window.ethereum.request({
          method: 'wallet_getCapabilities'
        }).catch(() => ({}));
        
        supportsEIP7702Direct = !!(capabilities && capabilities.eip7702);
        console.info(`Wallet ${supportsEIP7702Direct ? 'supports' : 'does not support'} EIP-7702 directly`);
      } catch (err) {
        console.warn('Failed to check EIP-7702 capability, assuming not supported directly:', err);
      }
      
      // Prepare the calls array for the batch execution
      const calls = operations.map(op => ({
        to: op.to as `0x${string}`,
        data: op.data as `0x${string}`,
        value: op.value !== '0' ? parseEther(op.value) : BigInt(0)
      }));
      
      // Calculate the total ETH value needed for the transaction
      const totalValue = calls.reduce(
        (sum, call) => sum + BigInt(call.value || 0), 
        BigInt(0)
      );
      
      // If the wallet doesn't support EIP-7702 directly, we need to use the regular transaction approach
      if (!supportsEIP7702Direct) {
        console.info('Using alternative approach for EIP-7702 execution...');
        
        // Create the execute function ABI for batch transactions
        const batchExecuteAbi = [
          {
            type: 'function',
            name: 'execute',
            inputs: [
              {
                type: 'tuple[]',
                name: 'calls',
                components: [
                  { type: 'address', name: 'to' },
                  { type: 'bytes', name: 'data' },
                  { type: 'uint256', name: 'value' }
                ]
              }
            ],
            outputs: [],
            stateMutability: 'payable'
          }
        ] as const;

        // Encode the function data for the execute method
        const data = encodeFunctionData({
          abi: batchExecuteAbi,
          functionName: 'execute',
          args: [calls]
        });
        
        // Try to use signAndSendAuthorization if available (supported by some wallets)
        try {
          console.info('Attempting to use signAndSendAuthorization...');
          
          // This is a custom call that some wallets implement for EIP-7702
          // @ts-ignore - We've already checked that window.ethereum exists
          const hash = await window.ethereum.request({
            method: 'eth_signAndSendAuthorization',
            params: [{
              contractAddress: userAddress,
              data,
              value: `0x${totalValue.toString(16)}`, // BigInt already properly converted to hex string
              gas: '0x100000', // 1M gas limit as safety
            }]
          });
          
          console.info(`Transaction sent using eth_signAndSendAuthorization! Hash: ${hash}`);
          
          // Wait for confirmation using polling
          if (window.ethereum) {  // Additional safety check
            // @ts-ignore - We've already checked that window.ethereum exists
            await waitForConfirmationWithProvider(hash, window.ethereum);
          }
          
          // Clear batch after successful transaction
          clearOperations();
          return;
        } catch (signAndSendError) {
          console.warn('eth_signAndSendAuthorization not supported or failed:', signAndSendError);
          
          // Try the standard method of signing authorization separately and then sending
          try {
            console.info('Attempting to use standard authorization approach...');
            
            // Sign the authorization (some wallets implement this directly)
            // @ts-ignore - We've already checked that window.ethereum exists
            const authorization = await window.ethereum.request({
              method: 'eth_signAuthorization',
              params: [{
                contractAddress: userAddress,
              }]
            });
            
            if (!authorization) {
              throw new Error('Failed to get authorization signature');
            }
            
            console.info('Successfully signed authorization, now sending the transaction...');
            
            // Send transaction with the authorization
            // @ts-ignore - We've already checked that window.ethereum exists
            const hash = await window.ethereum.request({
              method: 'eth_sendTransaction',
              params: [{
                to: userAddress,
                data,
                value: `0x${totalValue.toString(16)}`, // BigInt already properly converted to hex string
                gas: '0x100000', // 1M gas limit as safety
                authorizationList: [authorization]
              }]
            });
            
            console.info(`Transaction sent! Hash: ${hash}`);
            
            // Wait for confirmation using polling
            if (window.ethereum) {  // Additional safety check
              // @ts-ignore - We've already checked that window.ethereum exists
              await waitForConfirmationWithProvider(hash, window.ethereum);
            }
            
            // Clear batch after successful transaction
            clearOperations();
            return;
          } catch (error) {
            console.warn('Standard authorization approach failed:', error);
            throw new Error('Wallet does not support EIP-7702 standard authorization methods');
          }
        }
      } else {
        // If the wallet supports EIP-7702 directly, use the direct methods
        // This would execute if the wallet has reported support via capabilities
        console.info('Using direct EIP-7702 support from wallet...');
        
        // Implementation would go here if wallet explicitly supports EIP-7702
        throw new Error('Direct EIP-7702 implementation not available yet');
      }
    } catch (error) {
      console.error('EIP-7702 implementation error:', error);
      throw new Error(`EIP-7702 implementation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    console.error('EIP-7702 execution failed:', error);
    throw error; // Re-throw to be caught by the parent function
  }
};

// Check if Porto wallet is available
const isPortoAvailable = async (): Promise<boolean> => {
  return await initializePorto();
};

// Helper to import Porto
const importPorto = async () => {
  // Try to initialize Porto first
  const initialized = await initializePorto();
  if (!initialized) return null;
  
  try {
    // Now that Porto is initialized, try to get it
    if ((window as any).Porto) {
      return (window as any).Porto;
    }
    
    // Try to import dynamically
    const portoModule = await import('porto');
    return portoModule.Porto;
  } catch (error) {
    console.warn('Failed to import Porto:', error);
    return null;
  }
};

// Helper to ensure a value is safe for JSON serialization (handles BigInt)
const prepareSafeRpcValue = (value: string | bigint | number): string => {
  if (typeof value === 'bigint') {
    // Convert BigInt to hex string for RPC calls
    // Ensure it has 0x prefix for proper Ethereum hex formatting
    return value === BigInt(0) ? '0x0' : `0x${value.toString(16)}`;
  } else if (typeof value === 'number') {
    // Convert number to string
    return value.toString();
  } else if (value && value.startsWith && !value.startsWith('0x') && /^[0-9a-f]+$/i.test(value)) {
    // If it's a hex string without 0x prefix, add it
    return `0x${value}`;
  } else {
    // Return string as is or convert to string if needed
    return String(value);
  }
};

// Helper function to format value for Porto
const formatValueForPorto = (value: string): string => {
  if (value === '0') return '0x0';
  try {
    // Parse the value with parseEther and convert to hex
    const parsed = parseEther(value);
    // Use proper hex formatting with 0x prefix 
    return prepareSafeRpcValue(parsed);
  } catch (error) {
    console.warn('Error parsing value:', error);
    return '0x0';
  }
};

// Helper function to wait for transaction confirmation with any provider
const waitForConfirmationWithProvider = async (hash: string, provider: any): Promise<void> => {
  console.info('Waiting for confirmation...');
  
  // Wait for confirmation (basic polling)
  let confirmed = false;
  let attempts = 0;
  
  while (!confirmed && attempts < 30) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    try {
      const receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [hash]
      });
      
      if (receipt && receipt.blockNumber) {
        confirmed = true;
        console.info(`Transaction confirmed in block ${parseInt(receipt.blockNumber, 16)}!`);
      }
    } catch (error) {
      console.warn('Error checking transaction receipt:', error);
    }
  }
  
  if (!confirmed) {
    console.warn('Transaction may still be pending. Please check your wallet for status.');
  }
};

// Helper function to decode calldata for debugging
const decodeCallData = (callData: string) => {
  if (!callData || callData === '0x') return { functionName: 'none', params: [] };
  
  try {
    // Basic decoding of function signature (first 4 bytes/8 chars after 0x)
    const functionSignature = callData.slice(0, 10);
    
    // Common ERC20 function signatures
    const knownSignatures: Record<string, string> = {
      '0xa9059cbb': 'transfer(address,uint256)',
      '0x095ea7b3': 'approve(address,uint256)',
      '0x23b872dd': 'transferFrom(address,address,uint256)',
      '0x70a08231': 'balanceOf(address)',
      '0x18160ddd': 'totalSupply()',
      '0xdd62ed3e': 'allowance(address,address)',
      '0x40c10f19': 'mint(address,uint256)',
      '0x42966c68': 'burn(uint256)',
    };
    
    const functionName = knownSignatures[functionSignature] || 'unknown';
    return {
      functionSignature,
      functionName,
      data: callData
    };
  } catch (error) {
    console.warn('Error decoding calldata:', error);
    return { 
      functionName: 'error-decoding', 
      data: callData 
    };
  }
};

// Execute batch with Porto wallet
const executeWithPorto = async (operations: BatchOperation[]) => {
  try {
    console.info('Executing batch with Porto wallet...');
    
    // Import Porto
    const Porto = await importPorto();
    if (!Porto) {
      throw new Error('Porto wallet not available');
    }
    
    // Initialize Porto
    const porto = Porto.create();
    
    // Connect to Porto wallet
    console.info('Connecting to Porto wallet...');
    const { accounts } = await porto.provider.request({ 
      method: 'wallet_connect',
      params: [{
        capabilities: {
          atomicBatch: true // Request atomicBatch capability explicitly
        }
      }]
    });
    
    if (!accounts || accounts.length === 0 || !accounts[0]?.address) {
      throw new Error('No accounts returned from Porto wallet');
    }
    
    // Log the capabilities to help with debugging
    console.info('Porto account capabilities:', accounts[0]?.capabilities);
    
    const userAddress = accounts[0].address as `0x${string}`;
    console.info(`Connected to Porto wallet with address: ${userAddress}`);
    
    // Prepare the calls for batch execution
    const formattedCalls = operations.map(op => {
      // Decode calldata for debugging
      const decodedData = decodeCallData(op.data);
      console.info('Processing operation:', {
        to: op.to,
        functionName: decodedData.functionName,
        data: op.data,
        value: op.value
      });
      
      return {
        to: op.to,
        data: op.data,
        // Only include value if it's not zero
        ...(op.value !== '0' && { value: formatValueForPorto(op.value) })
      };
    });
    
    console.info('Prepared batch calls for Porto:', JSON.stringify(formattedCalls, null, 2));
    
    // Try to use Porto's native batch execution method if available
    try {
      // First check if the Porto wallet supports the wallet_sendCalls method directly
      console.info('Attempting to use wallet_sendCalls method...');
      
      // Get current account to use as 'from'
      const accounts = await porto.provider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available in Porto wallet');
      }
      const from = accounts[0];
      
      // Log the exact request format we're going to use
      const txParams = {
        from, // This is critical - 'from' must be at the top level, not inside calls
        calls: formattedCalls.map(call => ({
          to: call.to,
          data: call.data,
          // Only include value if it's not zero
          ...(call.value !== '0x0' && { value: call.value })
        })),
        version: '1' // Per the test file, this is required
      };
      
      console.info('Sending wallet_sendCalls with Porto format:', JSON.stringify(txParams));
      
      const txHash = await porto.provider.request({
        method: 'wallet_sendCalls',
        params: [txParams]
      });
      
      console.info(`Batch transaction sent via wallet_sendCalls! Transaction hash: ${txHash}`);
      
      // Wait for confirmation (basic polling)
      await waitForConfirmationWithProvider(txHash, porto.provider);
      
      console.info('Porto batch transaction completed!');
      return true;
      
    } catch (error) {
      console.warn('wallet_sendCalls not supported or failed:', error);
      
      // Try using sendMultipleTransactions method if available 
      try {
        console.info('Attempting to use wallet_sendMultipleTransactions method...');
        
        // Get current account
        const accounts = await porto.provider.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts available in Porto wallet');
        }
        const from = accounts[0];
        
        // Format transactions correctly with from address
        const txParams = {
          from,
          transactions: formattedCalls.map(call => ({
            to: call.to,
            data: call.data,
            // Only include value if it's not zero
            ...(call.value !== '0x0' && { value: call.value })
          })),
          version: '1'
        };
        
        console.info('Sending wallet_sendMultipleTransactions with params:', JSON.stringify(txParams));
        
        const txHash = await porto.provider.request({
          method: 'wallet_sendMultipleTransactions',
          params: [txParams]
        });
        
        console.info(`Batch transaction sent via wallet_sendMultipleTransactions! Transaction hash: ${txHash}`);
        
        // Wait for confirmation
        await waitForConfirmationWithProvider(txHash, porto.provider);
        
        console.info('Porto batch transaction completed!');
        return true;
      } catch (multiError) {
        console.warn('wallet_sendMultipleTransactions not supported or failed:', multiError);
      }
      
      // Try using EIP-7702 standard methods with Porto provider
      console.info('Attempting to use EIP-7702 standard methods with Porto...');
      
      try {
        // Create the execute function ABI for batch transactions
        const batchExecuteAbi = [
          {
            type: 'function',
            name: 'execute',
            inputs: [
              {
                type: 'tuple[]',
                name: 'calls',
                components: [
                  { type: 'address', name: 'to' },
                  { type: 'bytes', name: 'data' },
                  { type: 'uint256', name: 'value' }
                ]
              }
            ],
            outputs: [],
            stateMutability: 'payable'
          }
        ] as const;
        
        // Import viem utilities
        const { encodeFunctionData, parseEther } = await import('viem');
        
        // Format calls for the ABI
        const calls = operations.map(op => ({
          to: op.to as `0x${string}`,
          data: op.data as `0x${string}`,
          value: op.value !== '0' ? parseEther(op.value) : BigInt(0)
        }));
        
        // Encode the function data for the execute method
        const data = encodeFunctionData({
          abi: batchExecuteAbi,
          functionName: 'execute',
          args: [calls]
        });
        
        // Calculate the total ETH value needed for the transaction
        const totalValue = calls.reduce(
          (sum, call) => sum + BigInt(call.value || 0), 
          BigInt(0)
        );
        
        // Try to use signAndSendAuthorization if available
        try {
          console.info('Attempting to use eth_signAndSendAuthorization with Porto...');
          
          const txHash = await porto.provider.request({
            method: 'eth_signAndSendAuthorization',
            params: [{
              contractAddress: userAddress,
              data,
              value: `0x${totalValue.toString(16)}`, // BigInt already properly converted to hex string
              gas: '0x100000', // 1M gas limit as safety
            }]
          });
          
          console.info(`Transaction sent via eth_signAndSendAuthorization! Hash: ${txHash}`);
          
          // Wait for confirmation
          await waitForConfirmationWithProvider(txHash, porto.provider);
          
          console.info('Porto EIP-7702 batch transaction completed!');
          return true;
          
        } catch (authError) {
          console.warn('eth_signAndSendAuthorization not supported or failed:', authError);
          
          // Try standard approach (sign authorization separately)
          try {
            console.info('Attempting standard EIP-7702 approach with Porto...');
            
            // Sign authorization
            const authorization = await porto.provider.request({
              method: 'eth_signAuthorization',
              params: [{
                contractAddress: userAddress,
              }]
            });
            
            if (!authorization) {
              throw new Error('Failed to get authorization signature from Porto');
            }
            
            // Send transaction with authorization
            const txHash = await porto.provider.request({
              method: 'eth_sendTransaction',
              params: [{
                to: userAddress,
                data,
                value: `0x${totalValue.toString(16)}`, // BigInt already properly converted to hex string
                gas: '0x100000', // 1M gas limit as safety
                authorizationList: [authorization]
              }]
            });
            
            console.info(`Transaction sent with authorization! Hash: ${txHash}`);
            
            // Wait for confirmation
            await waitForConfirmationWithProvider(txHash, porto.provider);
            
            console.info('Porto EIP-7702 batch transaction completed!');
            return true;
            
          } catch (error) {
            console.warn('Standard EIP-7702 approach with Porto failed:', error);
            // Don't throw error yet, try one more fallback
          }
        }
        
        // Try sequential transactions as a last resort
        try {
          console.info('Attempting sequential transactions through Porto...');
          
          // Get current account
          const accounts = await porto.provider.request({ method: 'eth_accounts' });
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts available in Porto wallet');
          }
          const from = accounts[0];
          
          const txHashes = [];
          
          // Send each transaction individually
          for (const call of formattedCalls) {
            // Format transaction with consistent parameter structure
            const txParams = {
              from,
              to: call.to,
              data: call.data,
              // Only include value if it's not zero
              ...(call.value !== '0x0' && { value: call.value })
            };
            
            console.info('Sending individual transaction with params:', JSON.stringify(txParams));
            
            // Log the readable calldata for debugging/transparency
            console.info('Readable transaction data:', {
              from,
              to: call.to,
              data: call.data,
              value: call.value
            });
            
            const txHash = await porto.provider.request({
              method: 'eth_sendTransaction',
              params: [txParams]
            });
            
            txHashes.push(txHash);
            console.info(`Individual transaction sent! Hash: ${txHash}`);
            
            // Wait for each transaction to confirm before sending the next
            await waitForConfirmationWithProvider(txHash, porto.provider);
          }
          
          console.info('All sequential transactions completed!');
          return true;
        } catch (seqError) {
          console.warn('Sequential transactions through Porto failed:', seqError);
          throw new Error('Porto does not support batch operations or EIP-7702');
        }
      } catch (error) {
        console.warn('EIP-7702 approach with Porto failed:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to execute with Porto:', error);
    throw error;
  }
};

// Use a simplified WebAuthn approach that doesn't rely on external libraries
const executeEIP7702WithWebAuthn = async () => {
  const { operations, clearOperations } = useBatchStore.getState();
  
  if (operations.length === 0) {
    throw new Error("No operations in batch");
  }

  console.info(`Preparing to execute ${operations.length} operations with EIP-7702 WebAuthn`);

  try {
    // Check if window and ethereum are available
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Browser environment with Ethereum provider required");
    }

    // Get current account from provider
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    }) as string[];
    
    const userAddress = accounts[0];
    if (!userAddress) {
      throw new Error("No Ethereum account available");
    }

    console.info(`Using account: ${userAddress}`);

    const ethers = await import('ethers');
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Check if WebAuthn is initialized for this account
    let webAuthnInitialized = false;
    try {
      // First check if the browser supports WebAuthn
      if (typeof window.PublicKeyCredential === 'undefined' || 
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        throw new Error("This browser doesn't support WebAuthn");
      }
      
      // Then check if the wallet supports WebAuthn capabilities
      const capabilities = await window.ethereum.request({
        method: 'wallet_getCapabilities'
      }).catch(() => ({}));

      const hasWebAuthnSupport = capabilities && (
        capabilities.webauthn || 
        capabilities.eip7702 || 
        capabilities.signWithCredential
      );

      if (!hasWebAuthnSupport) {
        throw new Error("Wallet does not appear to support WebAuthn authentication");
      }
      
      // Try to get existing WebAuthn credentials
      try {
        const result = await window.ethereum.request({
          method: 'webauthn_getCredentials',
          params: [{
            // If you have chain ID available:
            // chainId: ...
          }]
        });
        
        if (result && result.address) {
          console.info(`Found existing WebAuthn credential for address: ${result.address}`);
          webAuthnInitialized = true;
        } else {
          console.info('No existing WebAuthn credentials found');
        }
      } catch (credError) {
        console.warn('Failed to get WebAuthn credentials:', credError);
        // This could mean credentials aren't initialized yet
      }
      
      // If not initialized, try to create a new credential
      if (!webAuthnInitialized) {
        console.info('Attempting to initialize WebAuthn credentials...');
        
        try {
          const result = await window.ethereum.request({
            method: 'webauthn_createCredential',
            params: [{
              // If you have chain ID available:
              // chainId: ...
              rp: {
                name: 'WebAuthn EIP-7702 Demo',
                id: window.location.hostname
              },
              user: {
                id: `user-${Date.now()}`, // Generate a simple user ID
                name: 'EIP-7702 User',
                displayName: 'WebAuthn User'
              }
            }]
          });
          
          if (result && result.address) {
            console.info(`Created new WebAuthn credential for address: ${result.address}`);
            webAuthnInitialized = true;
          } else {
            throw new Error('Failed to create WebAuthn credential');
          }
        } catch (createError) {
          console.error('Failed to create WebAuthn credential:', createError);
          throw new Error('Could not initialize WebAuthn credentials. Make sure your wallet supports WebAuthn.');
        }
      }
    } catch (error) {
      console.warn('WebAuthn capability check failed:', error);
      throw new Error('WebAuthn setup failed: ' + (error instanceof Error ? error.message : String(error)));
    }
    
    if (!webAuthnInitialized) {
      throw new Error('WebAuthn initialization required before executing batch operations');
    }

    // Prepare batch operations - IMPORTANT: Convert BigInt to string to avoid serialization issues
    const batchOperations = operations.map(op => {
      // Parse the ETH value but convert result to string immediately
      const parsedValue = op.value !== '0' ? 
        prepareSafeRpcValue(ethers.parseEther(op.value)) : // Convert BigInt to serializable format
        '0';
        
      return {
        to: op.to,
        data: op.data,
        value: parsedValue // Now a properly serializable value
      };
    });

    console.info("Prepared batch operations:", batchOperations);

    // Try to use any available WebAuthn methods
    // First try wallet_sendWithCredential if available
    try {
      console.info("Attempting to use wallet_sendWithCredential method...");
      
      // All values are now properly serializable
      const txHash = await window.ethereum.request({
        method: 'wallet_sendWithCredential',
        params: [{
          operations: batchOperations
        }]
      });
      
      console.info(`Transaction sent via wallet_sendWithCredential! Hash: ${txHash}`);
      
      // Wait for confirmation
      const receipt = await provider.waitForTransaction(txHash);
      console.info(`Transaction confirmed in block ${receipt?.blockNumber}!`);
      
      return true;
    } catch (credError) {
      console.warn("wallet_sendWithCredential not supported:", credError);
    }

    // Try webauthn_signAndExecute if available
    try {
      console.info("Attempting to use webauthn_signAndExecute method...");
      
      // Ensure operations are properly formatted for serialization
      const cleanOperations = batchOperations.map(op => ({
        to: op.to,
        data: op.data,
        value: op.value
      }));
      
      // Log the exact request we're making to help debug
      console.info("webauthn_signAndExecute request:", JSON.stringify({
        operations: cleanOperations
      }, (key, value) => {
        // Special handling during logging to show BigInts if any still exist
        return typeof value === 'bigint' ? value.toString() : value;
      }));
      
      // All values are now properly serializable
      const txHash = await window.ethereum.request({
        method: 'webauthn_signAndExecute',
        params: [{
          operations: cleanOperations
        }]
      });
      
      console.info(`Transaction sent via webauthn_signAndExecute! Hash: ${txHash}`);
      
      // Wait for confirmation
      const receipt = await provider.waitForTransaction(txHash);
      console.info(`Transaction confirmed in block ${receipt?.blockNumber}!`);
      
      return true;
    } catch (webauthnError) {
      console.warn("webauthn_signAndExecute not supported or failed:", webauthnError);
      console.info("Error details:", JSON.stringify(webauthnError, Object.getOwnPropertyNames(webauthnError)));
    }

    // If we couldn't use specific WebAuthn methods, throw an error to fall back to other approaches
    throw new Error("No WebAuthn batch execution methods available in this wallet");
  } catch (error) {
    console.error("Failed to execute batch with WebAuthn:", error);
    throw error;
  }
};

// Standalone action to execute batch operations
export const executeBatch = async () => {
  const { operations, setLoading, clearOperations } = useBatchStore.getState();
  
  if (operations.length === 0) {
    alert("No operations in batch");
    return;
  }
  
  setLoading(true);
  
  try {
    // First try WebAuthn approach - now prioritized before Porto
    console.info('Attempting to execute batch with WebAuthn EIP-7702...');
    try {
      await executeEIP7702WithWebAuthn();
      console.info('WebAuthn EIP-7702 batch execution completed successfully');
      clearOperations();
      return;
    } catch (webAuthnError: any) {
      const webAuthnErrorMessage = webAuthnError?.message || 'Unknown WebAuthn error';
      console.warn('WebAuthn EIP-7702 execution failed:', webAuthnError);
      
      // Check for user rejection or missing WebAuthn setup
      if (
        webAuthnErrorMessage.includes('user rejected') ||
        webAuthnErrorMessage.includes('aborted') ||
        webAuthnErrorMessage.includes('cancelled') ||
        webAuthnErrorMessage.includes('canceled')
      ) {
        alert('WebAuthn authentication was rejected by user');
        setLoading(false);
        return;
      }
      
      // If it's specifically about WebAuthn not being set up, provide a helpful message
      if (webAuthnErrorMessage.includes('No ExperimentDelegation contract found')) {
        console.info('Your wallet does not have WebAuthn credentials set up for EIP-7702.');
      } else {
        console.info('WebAuthn EIP-7702 not available, trying alternative methods...');
      }
    }
    
    // Next try to use Porto wallet if available
    const portoSupported = await isPortoAvailable();
    
    if (portoSupported) {
      console.info('Porto wallet detected, attempting to use it for batch execution...');
      
      try {
        const result = await executeWithPorto(operations);
        
        if (result) {
          // If Porto execution successful, we're done
          console.info('Porto batch execution successful');
          clearOperations();
          return;
        } else {
          console.info('Porto batch execution not supported for this account, trying standard EIP-7702...');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Porto batch execution failed:', error);
        
        // Check if this is a user rejection
        if (
          errorMessage.includes('rejected') || 
          errorMessage.includes('denied') || 
          errorMessage.includes('canceled') ||
          errorMessage.includes('cancelled')
        ) {
          alert('Transaction rejected by user');
          setLoading(false);
          return; // Don't proceed if user rejected
        }
        
        console.info('Trying standard EIP-7702 after Porto failure...');
      }
    } else {
      console.info('Porto wallet not detected, trying standard EIP-7702...');
    }
    
    // Next, try using standard EIP-7702 with any connected wallet
    console.info('Attempting to execute batch with standard EIP-7702...');
    
    try {
      await executeEIP7702Batch();
      console.info('EIP-7702 batch execution completed successfully');
      clearOperations();
      return;
    } catch (error: any) {
      // Check error message to provide helpful info
      const errorMessage = error?.message || 'Unknown error';
      
      // Log the specific error for debugging
      console.info(`EIP-7702 execution failed: ${errorMessage}`);
      
      // Check for user rejection first
      if (
        errorMessage.includes('user rejected') ||
        errorMessage.includes('denied') ||
        errorMessage.includes('canceled') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('rejected')
      ) {
        console.info('User rejected the transaction');
        alert('Transaction rejected by user');
        setLoading(false);
        return; // Don't proceed to sequential transactions if user rejected
      }
      
      // Determine if this is a compatibility error or implementation error
      const isCompatibilityError = 
        errorMessage.includes('not found') || 
        errorMessage.includes('not supported') ||
        errorMessage.includes('not a function') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('eip7702Actions') ||
        errorMessage.includes('Method not found');
      
      if (isCompatibilityError) {
        console.info('EIP-7702 appears to be unsupported by this wallet. This is expected since EIP-7702 is new and not widely supported yet.');
        // Display user-friendly notification about EIP-7702 compatibility
        alert('Your wallet does not support EIP-7702 batch transactions yet. Falling back to regular transactions.');
      } else {
        console.info('EIP-7702 failed for reasons other than compatibility. Check browser console for details.');
      }
      
      // Fall back to traditional sequential transactions
      console.info('Falling back to sequential transactions...');
      
      try {
        await executeTraditionalBatch();
        console.info('Sequential transactions completed');
        alert('Batch operations completed successfully using sequential transactions.');
      } catch (seqError: any) {
        console.error('Sequential transactions failed:', seqError);
        
        // Check for user rejection of sequential transactions
        const seqErrorMsg = seqError?.message || '';
        if (
          seqErrorMsg.includes('rejected') || 
          seqErrorMsg.includes('denied') || 
          seqErrorMsg.includes('canceled') ||
          seqErrorMsg.includes('cancelled') ||
          seqErrorMsg.includes('user rejected')
        ) {
          alert('Transaction rejected by user');
        } else {
          alert(`Failed to execute transactions: ${seqErrorMsg || 'Unknown error'}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to execute batch:', error);
    alert(`Failed to execute batch: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
}; 