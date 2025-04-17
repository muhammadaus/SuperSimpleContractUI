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