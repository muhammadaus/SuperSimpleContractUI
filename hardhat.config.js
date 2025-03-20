require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    sepolia: {
      url: "https://rpc.sepolia.org", // Public RPC endpoint for Sepolia
      chainId: 11155111
    }
  }
};

module.exports = config;