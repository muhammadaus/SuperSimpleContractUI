export interface BatchOperation {
  type: 'transfer' | 'approve' | 'call' | 'payable_call';
  interfaceType: 'erc20' | 'erc721' | 'nft' | 'universalRouter' | 'bridge' | 'liquidityPool' | 'positionManager' | 'wrappableToken' | 'readwrite' | 'wrap' | 'liquidity' | 'swap';
  to: string;
  data: string;
  value: string;
  description: string;
} 