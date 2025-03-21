// Index barrel file for mocks

// Export all scaffold-eth hooks
export * from './hooks/scaffold-eth';

// Export scaffold-eth utilities
export * from './utils/scaffold-eth/common';
export * from './utils/scaffold-eth/contract';
export * from './utils/scaffold-eth/networks';
export * from './utils/scaffold-eth/notification';

// Export contractsData with renamed function to avoid ambiguity
export { getAllContracts as getContractsData } from './utils/scaffold-eth/contractsData';

// Export scaffold-eth components
export * from './components/scaffold-eth';

// Export configuration
export { default as scaffoldConfig } from './scaffold.config'; 