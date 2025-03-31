export interface BatchOperation {
  type: 'transfer' | 'approve' | 'call' | 'payable_call';
  interfaceType: 'erc20' | 'erc721' | 'universalRouter' | 'bridge' | 'liquidityPool' | 'positionManager' | 'wrappableToken' | 'readwrite';
  to: string;
  data: string;
  value: string;
  description: string;
} 