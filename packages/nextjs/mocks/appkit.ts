/**
 * Mock implementation of the AppKit for server-side rendering compatibility
 */

export const LOADING = 'loading';
export const READY = 'ready';
export const ERROR = 'error';

export function createAppKit() {
  console.log('Mock AppKit created');
  return {
    status: READY,
    error: null,
    connect: async () => {
      console.log('Mock AppKit connect called');
      return { address: '0x0000000000000000000000000000000000000000' };
    },
    disconnect: async () => {
      console.log('Mock AppKit disconnect called');
    },
    signMessage: async (message: string) => {
      console.log('Mock AppKit signMessage called with:', message);
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    },
    switchNetwork: async (chainId: number) => {
      console.log('Mock AppKit switchNetwork called with:', chainId);
    },
  };
}

export function useAppKit() {
  return {
    status: READY,
    isConnected: false,
    address: null,
    chainId: 1,
    connect: async () => {
      console.log('Mock AppKit connect called');
    },
    disconnect: async () => {
      console.log('Mock AppKit disconnect called');
    },
    signMessage: async (message: string) => {
      console.log('Mock AppKit signMessage called with:', message);
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    },
    switchNetwork: async (chainId: number) => {
      console.log('Mock AppKit switchNetwork called with:', chainId);
    },
  };
} 