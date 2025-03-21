import { create } from 'zustand';
import { Chain } from 'viem/chains';

export enum ContractCodeStatus {
  LOADING = "loading",
  DEPLOYED = "deployed",
  NOT_FOUND = "not-found"
}

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

export type ContractName = string;

export type Contract<TContractName extends ContractName = ContractName> = {
  address: `0x${string}`;
  abi: any[];
  inheritedFunctions?: {
    [key: string]: string;
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
