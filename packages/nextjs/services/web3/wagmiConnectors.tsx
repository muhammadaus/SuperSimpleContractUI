import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { getTargetNetwork } from "~~/utils/scaffold-eth";

const targetNetwork = getTargetNetwork();

// Create wagmi config
export const config = createConfig({
  chains: [targetNetwork],
  transports: {
    [targetNetwork.id]: http(
      targetNetwork.rpcUrls.default.http[0],
      {
        apiKey: scaffoldConfig.alchemyApiKey,
      }
    ),
  },
});

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = connectorsForWallets(
  [
    {
      groupName: "Supported Wallets",
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
        ledgerWallet,
        braveWallet,
        coinbaseWallet,
        rainbowWallet,
        safeWallet,
      ],
    },
  ],
  {
    appName: "Pure Contracts",
    projectId: scaffoldConfig.walletConnectProjectId,
    chains: [targetNetwork],
  },
);
