#!/usr/bin/env ts-node

import { executeBatchWithFoundry, extractRawTransactionData } from '../utils/foundry';
import { BatchOperation } from '../types/batch';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Default Anvil account private key
const TEST_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Default Anvil account

/**
 * This test script validates the Foundry EIP-7702 implementation by:
 * 1. Creating a test batch of transactions
 * 2. Extracting transaction data for preview
 * 3. Executing the batch with Foundry
 * 
 * To run this test:
 * 1. Make sure Anvil is running with Prague hardfork: `anvil --hardfork prague`
 * 2. Run the test script: `yarn ts-node scripts/test-foundry.ts`
 */
async function main() {
  console.log('Testing Foundry EIP-7702 implementation...');
  
  try {
    // Create a test batch of operations with proper typing
    const testOperations: BatchOperation[] = [
      {
        type: 'transfer',
        interfaceType: 'erc20',
        to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Another Anvil test account
        data: '0x', // Simple ETH transfer doesn't need data
        value: '0.01',
        description: 'Test ETH Transfer'
      },
      {
        type: 'call',
        interfaceType: 'readwrite',
        to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        data: '0x', // No data for this test
        value: '0',
        description: 'Test Empty Call'
      }
    ];
    
    console.log('Created test batch operations:');
    console.log(testOperations);
    
    // Extract transaction data for preview
    const { rawTransactions, totalGasEstimate, totalValue } = extractRawTransactionData(testOperations);
    
    console.log('\nTransaction preview:');
    console.log('Raw Transactions:', rawTransactions);
    console.log('Total Gas Estimate:', totalGasEstimate);
    console.log('Total Value:', totalValue);
    
    // Execute the batch with Foundry
    console.log('\nExecuting batch with Foundry...');
    
    const result = await executeBatchWithFoundry(testOperations, {
      privateKey: TEST_PRIVATE_KEY,
      showTransactionData: true,
      onStatusUpdate: (message) => console.log(`Status: ${message}`)
    });
    
    if (result.success) {
      console.log('\nBatch execution completed successfully!');
      console.log('Output:');
      console.log(result.output);
    } else {
      console.error('\nBatch execution failed!');
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 