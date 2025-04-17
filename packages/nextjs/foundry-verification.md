# Foundry EIP-7702 Integration Verification

This document outlines how to verify and test the Foundry integration for EIP-7702 batch transactions.

## Setup

1. Install Foundry:
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install library dependencies:
```bash
forge install foundry-rs/forge-std
```

3. Start a local Anvil node with Prague hardfork:
```bash
anvil --hardfork prague
```

## Test Contract

Create a simple test contract in `src/BatchTest.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title BatchTest
/// @notice Simple contract to test EIP-7702 batch transactions
contract BatchTest {
    event BatchOperation(address sender, uint256 amount, string message);
    
    /// @notice Emits an event with the message and amount
    /// @param message The message to emit
    function performOperation(string memory message) external payable {
        emit BatchOperation(msg.sender, msg.value, message);
    }
    
    /// @notice Returns the current block number
    /// @return The current block number
    function getBlockNumber() external view returns (uint256) {
        return block.number;
    }
    
    /// @notice Allows the contract to receive ETH
    receive() external payable {}
}
```

## Batch Script

Create a script to test EIP-7702 batch execution in `script/BatchTransactions.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BatchTest.sol";

contract BatchTransactionsScript is Script {
    function setUp() public {}

    function run() public {
        // Get private key from environment or use default
        uint256 privateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address sender = vm.addr(privateKey);
        
        console.log("Using sender address:", sender);
        
        // Deploy the test contract
        vm.startBroadcast(privateKey);
        BatchTest batchTest = new BatchTest();
        console.log("BatchTest deployed at:", address(batchTest));
        vm.stopBroadcast();
        
        // Create operations for the batch
        bytes memory data1 = abi.encodeWithSelector(
            BatchTest.performOperation.selector,
            "EIP-7702 Operation 1"
        );
        
        bytes memory data2 = abi.encodeWithSelector(
            BatchTest.performOperation.selector,
            "EIP-7702 Operation 2"
        );
        
        // Sign authorizations for EIP-7702
        bytes32 hash1 = keccak256(
            abi.encode(
                keccak256("Authorization(address to,uint256 value,bytes data)"),
                address(batchTest),
                uint256(0.1 ether),
                keccak256(data1)
            )
        );
        
        bytes32 hash2 = keccak256(
            abi.encode(
                keccak256("Authorization(address to,uint256 value,bytes data)"),
                address(batchTest),
                uint256(0),
                keccak256(data2)
            )
        );
        
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(privateKey, hash1);
        bytes memory authorization1 = abi.encodePacked(r1, s1, v1);
        
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(privateKey, hash2);
        bytes memory authorization2 = abi.encodePacked(r2, s2, v2);
        
        console.log("=== Executing EIP-7702 batch transactions ===");
        
        // Execute the batch with a different account as the sponsor
        address sponsor = vm.addr(2); // Use a different key for the sponsor
        console.log("Sponsor address:", sponsor);
        
        // Fund the sponsor
        vm.deal(sponsor, 1 ether);
        
        vm.startBroadcast(2); // Use key 2 for broadcast
        
        // Execute the first operation with attached delegation
        console.log("Executing operation 1...");
        vm.attachDelegation(authorization1);
        (bool success1,) = address(batchTest).call{value: 0.1 ether}(data1);
        console.log("Operation 1 success:", success1);
        
        // Execute the second operation with attached delegation
        console.log("Executing operation 2...");
        vm.attachDelegation(authorization2);
        (bool success2,) = address(batchTest).call(data2);
        console.log("Operation 2 success:", success2);
        
        vm.stopBroadcast();
        
        console.log("=== Batch execution complete ===");
    }
}
```

## Running the Tests

1. Build the project:
```bash
forge build
```

2. Run Foundry script with the Prague hardfork:
```bash
forge script script/BatchTransactions.s.sol --broadcast --rpc-url http://localhost:8545 --hardfork prague
```

## Integration with PureContracts

Our implementation integrates Foundry for EIP-7702 batch transactions in the following ways:

1. **Backend API Route**: `/api/foundry/route.ts` provides an API endpoint for executing batches with Foundry.

2. **Foundry Utilities**: `utils/foundry/index.ts` contains helper functions for generating and executing Foundry scripts.

3. **Transaction Preview UI**: `utils/foundry/TransactionPreview.tsx` renders a MetaMask-like transaction preview.

4. **Batch Execution Flow**: Updated `executeBatch` function in `batchReducer.ts` tries Foundry first before falling back to other methods.

## Manual Verification

1. Start your local development server:
```bash
cd packages/nextjs && yarn dev
```

2. Visit the application and add operations to a batch.

3. Execute the batch and observe the transaction preview dialog.

4. If Foundry is available, it will be used for batch execution with EIP-7702 support.

## Notes

- EIP-7702 is only available from the Prague hardfork onwards.
- For production use, you would need to securely handle private keys rather than exposing them in the browser.
- The integration prioritizes Foundry for EIP-7702 but falls back to traditional methods if unavailable. 