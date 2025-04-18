// Only import Node.js modules on the server side
let execSync: any;
let writeFileSync: any;
let readFileSync: any;
let existsSync: any;
let mkdirSync: any;
let path: any;

// Only require these modules on the server side
if (typeof window === 'undefined') {
  execSync = require('child_process').execSync;
  const fs = require('fs');
  writeFileSync = fs.writeFileSync;
  readFileSync = fs.readFileSync;
  existsSync = fs.existsSync;
  mkdirSync = fs.mkdirSync;
  path = require('path');
}

import { BatchOperation } from '../../types/batch';
import { ethers } from 'ethers';

// Define the temporary directory for Foundry files
let TEMP_DIR = '';

// Make sure the temp directory exists
if (typeof window === 'undefined') {
  TEMP_DIR = path.join(process.cwd(), 'temp', 'foundry');
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// Check if Foundry is installed
export const isFoundryInstalled = (): boolean => {
  try {
    // This should be run on the server side only
    if (typeof window !== 'undefined') return false;
    
    const output = execSync('forge --version').toString();
    return output.includes('forge');
  } catch (error) {
    console.error('Foundry not found:', error);
    return false;
  }
};

// Generate a Solidity script for batch transactions using EIP-7702
const generateBatchScript = (operations: BatchOperation[], privateKey?: string): string => {
  const imports = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
  `;

  const scriptStart = `
contract BatchTxScript is Script {
    // Define a struct for our batch operations
    struct Operation {
        address to;
        uint256 value;
        bytes data;
        string description;
    }

    function setUp() public {}

    function run() public {
        // Private key setup - will use env var if available
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(privateKey);
        console.log("Sender address:", sender);
  `;

  // Generate operations array
  const operationsSetup = operations.map((op, index) => {
    return `
        // Operation ${index + 1}: ${op.description}
        Operation memory op${index} = Operation({
            to: ${op.to},
            value: ${op.value != '0' ? `${op.value} ether` : '0'},
            data: hex"${op.data.startsWith('0x') ? op.data.slice(2) : op.data}",
            description: "${op.description}"
        });`;
  }).join('\n');

  // Generate EIP-7702 implementation
  const eip7702Implementation = `
        // Create the batch of operations for EIP-7702
        Operation[] memory ops = new Operation[](${operations.length});
        ${operations.map((_, i) => `ops[${i}] = op${i};`).join('\n        ')}

        // Prague hardfork EIP-7702 implementation
        console.log("Starting EIP-7702 batch execution...");
        
        // Create an authorizations array for all operations
        bytes[] memory authorizations = new bytes[](${operations.length});

        // Sign each operation with EIP-7702
        for (uint i = 0; i < ops.length; i++) {
            // Sign the authorization for this operation
            bytes32 typedDataHash = keccak256(
                abi.encode(
                    keccak256("Authorization(address to,uint256 value,bytes data)"),
                    ops[i].to,
                    ops[i].value,
                    keccak256(ops[i].data)
                )
            );
            
            // Sign the authorization using Foundry's signDelegation
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, typedDataHash);
            authorizations[i] = abi.encodePacked(r, s, v);
            
            console.log("Signed authorization for operation:", i);
            console.log("  To:", ops[i].to);
            console.log("  Value:", ops[i].value);
            console.log("  Data length:", ops[i].data.length);
        }

        // Now execute each operation with signed authorizations
        for (uint i = 0; i < ops.length; i++) {
            console.log("Executing operation:", i);
            console.log("Description:", ops[i].description);

            // Use Foundry's attachDelegation to attach the authorization
            vm.attachDelegation(authorizations[i]);
            
            // Execute the call
            bytes memory result;
            bool success;
            (success, result) = ops[i].to.call{value: ops[i].value}(ops[i].data);
            
            require(success, string(abi.encodePacked("Operation ", vm.toString(i), " failed")));
            console.log("Operation executed successfully!");
        }

        console.log("All operations completed successfully");
    }
}`;

  return `${imports}${scriptStart}${operationsSetup}${eip7702Implementation}`;
};

// Create a Foundry configuration file
const generateFoundryConfig = (): string => {
  return `[profile.default]
src = 'src'
out = 'out'
libs = ['lib']
evm_version = 'prague'  # Required for EIP-7702
solc_version = '0.8.23'
verbosity = 3           # For more detailed output
`;
};

// Generate a Foundry batch script and execute it
export const executeBatchWithFoundry = async (
  operations: BatchOperation[],
  options: { 
    privateKey?: string,
    showTransactionData?: boolean,
    onStatusUpdate?: (message: string) => void 
  } = {}
): Promise<{ success: boolean; output: string; error?: string }> => {
  const { privateKey, onStatusUpdate } = options;
  
  try {
    // This should be executed server-side
    if (typeof window !== 'undefined') {
      throw new Error('Foundry execution must be done server-side');
    }
    
    // Check if Foundry is installed
    if (!isFoundryInstalled()) {
      throw new Error('Foundry is not installed. Please install Foundry first.');
    }
    
    // Create the script and config files
    const scriptContent = generateBatchScript(operations, privateKey);
    const configContent = generateFoundryConfig();
    
    // Write files to disk
    const scriptPath = path.join(TEMP_DIR, 'BatchTxScript.s.sol');
    const configPath = path.join(TEMP_DIR, 'foundry.toml');
    
    writeFileSync(scriptPath, scriptContent);
    writeFileSync(configPath, configContent);
    
    onStatusUpdate?.('Created Foundry script files');
    
    // Make sure the environment has the PRIVATE_KEY setup, or use the provided one
    let foundryEnv = '';
    if (privateKey && !process.env.PRIVATE_KEY) {
      foundryEnv = `PRIVATE_KEY=${privateKey} `;
    }
    
    // Execute the Foundry script
    onStatusUpdate?.('Running Foundry for EIP-7702 batch transactions...');
    
    // Add --hardfork prague flag to ensure EIP-7702 support
    const forgeCommand = `cd ${TEMP_DIR} && ${foundryEnv}forge script BatchTxScript.s.sol:BatchTxScript --verbose --broadcast --rpc-url http://localhost:8545 --hardfork prague`;
    
    // First dry-run to get transaction data for display (if requested)
    let dryRunOutput = '';
    if (options.showTransactionData) {
      onStatusUpdate?.('Performing dry run to preview transaction data...');
      try {
        dryRunOutput = execSync(`${forgeCommand} --simulate`).toString();
      } catch (err: any) {
        console.warn('Dry run simulation failed (this is sometimes expected):', err.message);
      }
    }
    
    // Execute for real
    onStatusUpdate?.('Executing batch transactions with Foundry...');
    const output = execSync(forgeCommand).toString();
    
    // Return success result
    return {
      success: true,
      output: output
    };
  } catch (error: any) {
    console.error('Foundry execution failed:', error);
    return {
      success: false,
      output: '',
      error: error.message || 'Unknown error during Foundry execution'
    };
  }
};

// Function to decode transaction data for display
export const decodeTransactionData = async (
  operation: BatchOperation
): Promise<{ functionName: string; params: Record<string, any> }> => {
  try {
    // Safe client-side implementation that doesn't use Node.js specific modules
    const to = operation.to;
    const data = operation.data;
    
    // Basic function selector extraction
    let functionName = 'Unknown Function';
    let params: Record<string, any> = {};
    
    if (data && data.length >= 10) {
      const selector = data.substring(0, 10);
      
      // Basic hardcoded selectors for common functions
      const knownSelectors: Record<string, string> = {
        '0xa9059cbb': 'transfer',
        '0x095ea7b3': 'approve',
        '0x23b872dd': 'transferFrom',
        '0x70a08231': 'balanceOf',
        '0x18160ddd': 'totalSupply',
        '0xdd62ed3e': 'allowance',
        '0x42842e0e': 'safeTransferFrom',
        '0x6352211e': 'ownerOf',
        '0x01ffc9a7': 'supportsInterface',
      };
      
      functionName = knownSelectors[selector] || `Function (${selector})`;
    }
    
    return { functionName, params };
  } catch (error) {
    console.error('Error decoding transaction data:', error);
    return { functionName: 'Error Decoding', params: {} };
  }
};

// Export a client-safe version of extractRawTransactionData for browser use
export const extractRawTransactionData = (operations: BatchOperation[]): { 
  rawTransactions: {to: string, value: string, data: string, description: string}[],
  totalGasEstimate: string,
  totalValue: string
} => {
  // Format values for better display
  const rawTransactions = operations.map(op => ({
    to: op.to,
    value: op.value !== '0' ? `${op.value} ETH` : '0',
    data: op.data,
    description: op.description
  }));
  
  // Calculate total ETH value being sent
  const totalValue = operations.reduce((sum, op) => {
    try {
      return sum + (op.value !== '0' ? parseFloat(op.value) : 0);
    } catch {
      return sum;
    }
  }, 0).toFixed(6);
  
  // Rough gas estimate (very approximate)
  const totalGasEstimate = (operations.length * 100000).toString();
  
  return {
    rawTransactions,
    totalGasEstimate,
    totalValue: totalValue + ' ETH'
  };
}; 