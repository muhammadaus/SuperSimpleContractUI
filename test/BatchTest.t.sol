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
    
    function testSignAndAttachDelegation() public {
        // This test uses the combined signAndAttachDelegation function
        bytes memory data = abi.encodeWithSelector(
            BatchTest.performOperation.selector,
            "Combined Operation"
        );
        
        address signer = vm.addr(1);
        address sponsor = vm.addr(2);
        
        // Start with a different account than the signer
        vm.startPrank(sponsor);
        
        // Setup the delegation and expectation
        vm.expectEmit(true, true, true, true);
        emit BatchTest.BatchOperation(signer, 0.5 ether, "Combined Operation");
        
        // Use the combined function to sign and attach the delegation
        vm.signAndAttachDelegation(
            1, // Private key for signer
            address(batchTest), // Target contract
            0.5 ether, // Value to send
            data // Call data
        );
        
        // Execute the call
        (bool success,) = address(batchTest).call{value: 0.5 ether}(data);
        assertTrue(success, "Operation should succeed");
        
        vm.stopPrank();
    }
} 