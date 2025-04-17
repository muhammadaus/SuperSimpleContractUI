#!/bin/bash

# Script to install Foundry and set up the environment for EIP-7702 testing

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "=========================================================="
echo " Foundry EIP-7702 Installer for PureContracts"
echo "=========================================================="
echo -e "${NC}"

# Check if Foundry is already installed
if command -v forge &> /dev/null; then
    echo -e "${GREEN}Foundry is already installed.${NC}"
    forge --version
else
    echo "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    
    # Load the environment
    source ~/.bashrc || source ~/.zshrc || echo "Please restart your terminal or source your shell config file"
    
    # Update Foundry to the latest version
    foundryup
    
    # Check if installation was successful
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}Failed to install Foundry. Please try to install it manually:${NC}"
        echo "curl -L https://foundry.paradigm.xyz | bash"
        echo "foundryup"
        exit 1
    fi
    
    echo -e "${GREEN}Foundry installation successful!${NC}"
fi

# Create src and test directories if they don't exist
mkdir -p src test

# Create a sample test contract for EIP-7702
cat > src/BatchTest.sol << 'EOL'
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
EOL

# Create a test script for the contract
cat > test/BatchTest.t.sol << 'EOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/BatchTest.sol";

contract BatchTestTest is Test {
    BatchTest public batchTest;
    
    function setUp() public {
        batchTest = new BatchTest();
    }
    
    function testBatchOperation() public {
        // First operation
        vm.expectEmit(true, true, true, true);
        emit BatchTest.BatchOperation(address(this), 1 ether, "Operation 1");
        batchTest.performOperation{value: 1 ether}("Operation 1");
        
        // Second operation
        vm.expectEmit(true, true, true, true);
        emit BatchTest.BatchOperation(address(this), 0, "Operation 2");
        batchTest.performOperation("Operation 2");
    }
    
    function testEIP7702Batch() public {
        // Create the first operation
        bytes memory data1 = abi.encodeWithSelector(
            BatchTest.performOperation.selector,
            "EIP-7702 Operation 1"
        );
        
        // Create the second operation
        bytes memory data2 = abi.encodeWithSelector(
            BatchTest.performOperation.selector,
            "EIP-7702 Operation 2"
        );
        
        // Create typed data hash for the first operation
        bytes32 hash1 = keccak256(
            abi.encode(
                keccak256("Authorization(address to,uint256 value,bytes data)"),
                address(batchTest),
                uint256(1 ether),
                keccak256(data1)
            )
        );
        
        // Create typed data hash for the second operation
        bytes32 hash2 = keccak256(
            abi.encode(
                keccak256("Authorization(address to,uint256 value,bytes data)"),
                address(batchTest),
                uint256(0),
                keccak256(data2)
            )
        );
        
        // Sign the authorizations
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(1, hash1); // Using private key 1
        bytes memory authorization1 = abi.encodePacked(r1, s1, v1);
        
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(1, hash2); // Using private key 1
        bytes memory authorization2 = abi.encodePacked(r2, s2, v2);
        
        // Execute the operations with authorizations attached
        vm.startPrank(vm.addr(2)); // Using a different address than the signer
        
        // First operation
        vm.expectEmit(true, true, true, true);
        emit BatchTest.BatchOperation(vm.addr(1), 1 ether, "EIP-7702 Operation 1");
        
        vm.attachDelegation(authorization1);
        (bool success1,) = address(batchTest).call{value: 1 ether}(data1);
        assertTrue(success1, "First operation should succeed");
        
        // Second operation
        vm.expectEmit(true, true, true, true);
        emit BatchTest.BatchOperation(vm.addr(1), 0, "EIP-7702 Operation 2");
        
        vm.attachDelegation(authorization2);
        (bool success2,) = address(batchTest).call(data2);
        assertTrue(success2, "Second operation should succeed");
        
        vm.stopPrank();
    }
}
EOL

# Create a deployment script
cat > script/BatchTest.s.sol << 'EOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BatchTest.sol";

contract BatchTestScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        BatchTest batchTest = new BatchTest();
        console.log("BatchTest deployed at:", address(batchTest));
        
        vm.stopBroadcast();
    }
}
EOL

# Make sure script directory exists
mkdir -p script

# Create a README for testing EIP-7702
cat > EIP7702_TESTING.md << 'EOL'
# Testing EIP-7702 with Foundry

This guide explains how to use the Foundry integration for testing EIP-7702 (Authorization) functionality.

## Prerequisites

1. Foundry installed (already done if you ran the installer script)
2. Anvil (local node) running with Prague hardfork

## Running Anvil with EIP-7702 Support

```bash
anvil --hardfork prague
```

## Running Tests

```bash
forge test -vv
```

## Running the Batch Test Script

```bash
# Option 1: With environment variable
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script script/BatchTest.s.sol --broadcast --rpc-url http://localhost:8545 --hardfork prague

# Option 2: Using your own private key
forge script script/BatchTest.s.sol --broadcast --rpc-url http://localhost:8545 --hardfork prague
```

## Testing from Node.js

To test from Node.js, run the test script:

```bash
yarn ts-node packages/nextjs/scripts/test-foundry.ts
```

## Web UI Testing

1. Start your local development server:
```bash
yarn dev
```

2. Visit the website and use the batch transaction feature.
3. When executing batch operations, the app will attempt to use Foundry for EIP-7702 support if available.

## Troubleshooting

- Make sure Anvil is running with the `--hardfork prague` flag
- Ensure you have the correct private key set (default Anvil: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
- Check if the Foundry executable is in your PATH
EOL

# Try to build the project
echo "Building Foundry project..."
forge build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Foundry project build successful!${NC}"
    
    # Run tests if build was successful
    echo "Running tests to verify EIP-7702 support..."
    forge test -vv
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}EIP-7702 tests passed successfully!${NC}"
    else
        echo -e "${RED}EIP-7702 tests failed. Please check the error messages.${NC}"
    fi
else
    echo -e "${RED}Foundry project build failed. Please check the error messages.${NC}"
fi

echo -e "${BLUE}"
echo "=========================================================="
echo " Installation Complete"
echo "=========================================================="
echo -e "${NC}"
echo "To learn how to test EIP-7702, see the EIP7702_TESTING.md file."
echo ""
echo "To start a local node with EIP-7702 support, run:"
echo "  anvil --hardfork prague"
echo "" 