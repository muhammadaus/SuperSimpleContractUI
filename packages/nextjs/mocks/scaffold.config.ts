// Mock implementation of scaffold.config.ts
import { mainnet } from 'viem/chains';

const scaffoldConfig = {
  targetNetworks: [mainnet],
  pollingInterval: 30000,
};

export default scaffoldConfig; 