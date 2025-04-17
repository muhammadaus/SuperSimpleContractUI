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