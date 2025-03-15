import { GenericContractsDeclaration, useContractStore } from './contract';
import deployedContracts from '../../contracts/deployedContracts';
import externalContracts from '../../contracts/externalContracts';

// Initialize contracts with deployed and external contracts
let contracts: GenericContractsDeclaration = {
  ...deployedContracts,
  ...externalContracts
};

// Update the contracts reference when the store changes
useContractStore.subscribe((state) => {
  contracts = {
    ...deployedContracts,
    ...externalContracts,
    ...state.contracts
  };
});

export const getAllContracts = () => {
  // Get the latest contracts from the store
  const storeContracts = useContractStore.getState().contracts;
  return {
    ...deployedContracts,
    ...externalContracts,
    ...storeContracts
  };
};
