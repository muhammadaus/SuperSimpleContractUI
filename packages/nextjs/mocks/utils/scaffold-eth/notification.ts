// Mock implementation of scaffold-eth notification utility

export const notification = {
  info: (message: string) => {
    console.log(`[INFO] ${message}`);
  },
  success: (message: string) => {
    console.log(`[SUCCESS] ${message}`);
  },
  error: (message: string) => {
    console.log(`[ERROR] ${message}`);
  },
  warning: (message: string) => {
    console.log(`[WARNING] ${message}`);
  },
}; 