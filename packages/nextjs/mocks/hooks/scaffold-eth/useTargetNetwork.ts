// Mock implementation of the useTargetNetwork hook
import { mainnet } from 'viem/chains';

export const useTargetNetwork = () => {
  return {
    targetNetwork: mainnet,
    isTargetNetwork: true,
    setTargetNetwork: () => {},
  };
}; 