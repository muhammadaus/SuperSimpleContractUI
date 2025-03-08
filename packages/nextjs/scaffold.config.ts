import { mainnet } from 'viem/chains';

const scaffoldConfig = {
  targetNetwork: mainnet,
  alchemyApiKey: process.env.ALCHEMY_API_KEY || '',
};

export default scaffoldConfig;
