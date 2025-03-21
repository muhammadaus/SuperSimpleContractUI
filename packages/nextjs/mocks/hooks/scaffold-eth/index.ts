// Mock hooks index file

export * from './useTargetNetwork';

// Add additional hook mocks as needed
export const useScaffoldContract = () => {
  return {
    data: null,
    isLoading: false,
    error: null
  };
};

export const useScaffoldContractRead = () => {
  return {
    data: null,
    isLoading: false,
    error: null
  };
};

export const useScaffoldContractWrite = () => {
  return {
    writeAsync: async () => Promise.resolve(),
    isLoading: false,
    error: null
  };
};

export const useDeployedContractInfo = () => {
  return {
    data: null,
    isLoading: false
  };
};

export const useScaffoldEventHistory = () => {
  return {
    data: [],
    isLoading: false,
    error: null
  };
};

export const useScaffoldEventSubscriber = () => {
  return {
    data: null,
    isLoading: false,
    error: null
  };
};

export const useAccountBalance = () => {
  return {
    balance: "0.0",
    isLoading: false,
    price: 0
  };
};

export const useNativeCurrencyPrice = () => {
  return {
    price: 0,
    isLoading: false
  };
};

export const useNetworkColor = () => {
  return "blue";
};

export const useAnimationConfig = () => {
  return {
    springConfig: { tension: 150, friction: 20 },
    onSpringComplete: () => {},
  };
}; 