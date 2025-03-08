import { create } from 'zustand';
import { Chain } from 'viem/chains';

export type GenericContractsDeclaration = {
  [chainId: number]: {
    [contractName: string]: {
      address: `0x${string}`;
      abi: any[];
      inheritedFunctions?: {
        [key: string]: string;
      };
    };
  };
};

type ContractData = {
  [key: string]: {
    address: `0x${string}`;
    abi: any[];
  };
};

interface ContractStore {
  contracts: GenericContractsDeclaration;
  setContracts: (contracts: GenericContractsDeclaration) => void;
}

export const useContractStore = create<ContractStore>((set) => ({
  contracts: {},
  setContracts: (contracts) => set({ contracts }),
}));

export const setContracts = async (contracts: GenericContractsDeclaration) => {
  useContractStore.getState().setContracts(contracts);
};
