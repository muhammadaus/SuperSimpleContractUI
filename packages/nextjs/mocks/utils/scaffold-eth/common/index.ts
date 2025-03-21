// Mock implementation of scaffold-eth common utils

export const formatEther = (value: any) => {
  return "0.0";
};

export const formatUnits = (value: any, decimals: number) => {
  return "0.0";
};

export const shortenAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const blockExplorerAddressLink = (address: string) => {
  return `https://etherscan.io/address/${address}`;
};

export const blockExplorerTxLink = (txHash: string) => {
  return `https://etherscan.io/tx/${txHash}`;
}; 