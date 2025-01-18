import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetwork: chains.Chain;
  pollingInterval: number;
  alchemyApiKey: string;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
  walletAutoConnect: boolean;
};

const scaffoldConfig = {
  // Network where your DApp will work
  targetNetwork: chains.mainnet,

  // The interval at which your front-end polls the RPC servers for new data
  // it's set in milliseconds
  pollingInterval: 30000,

  // Your Alchemy API key
  alchemyApiKey: process.env.ALCHEMY_API_KEY ?? "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF",

  // This is used for WalletConnect
  walletConnectProjectId: process.env.WALLET_CONNECT_PROJECT_ID ?? "3a8170812b534d0ff9d794f19a901d64",

  // Only show the Burner Wallet when on hardhat local network
  onlyLocalBurnerWallet: true,

  // Set this to false to disable auto wallet connection
  walletAutoConnect: true,
} satisfies ScaffoldConfig;

export default scaffoldConfig;
