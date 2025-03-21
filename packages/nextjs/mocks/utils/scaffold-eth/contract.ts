/**
 * Mock implementation of scaffold-eth contract utilities
 */

export enum ContractCodeStatus {
  LOADING = "loading",
  DEPLOYED = "deployed",
  NOT_FOUND = "not-found",
}

export interface GenericContractsDeclaration {
  [chainId: number]: {
    [contractName: string]: {
      address: string;
      abi: any[];
      inheritedFunctions?: {
        [key: string]: string;
      };
    };
  };
}

export function setContracts(contracts: GenericContractsDeclaration): void {
  console.log("setContracts mock called with:", contracts);
  // Mock implementation
}

export function useContractStore(selector: any) {
  // Return an empty object as this is a mock
  return {
    contracts: {},
    addContract: () => {},
    removeContract: () => {},
  };
}

export function getAllContracts() {
  return {};
} 