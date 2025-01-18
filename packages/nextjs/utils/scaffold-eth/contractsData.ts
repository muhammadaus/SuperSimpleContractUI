import { Contract } from "./contract";
import scaffoldConfig from "~~/scaffold.config";
import { contracts, useContractStore } from "~~/utils/scaffold-eth/contract";
import { getAllTargetNetworks } from "./networks";

// Update the interface to match the contract structure
interface ContractData {
  address: string;
  abi: any[];
  inheritedFunctions: Record<string, string>;
}

export function getAllContracts(): Record<string, ContractData> {
  // Get contracts directly from the store instead of the imported contracts
  const contractStore = useContractStore.getState();
  return contractStore.contracts || {};
}

export function getContract(contractName: string): ContractData | null {
  const allContracts = getAllContracts();
  return allContracts[contractName] || null;
}

export function getTargetNetwork(): any {
  return Array.isArray(scaffoldConfig.targetNetwork) 
    ? scaffoldConfig.targetNetwork[0] 
    : scaffoldConfig.targetNetwork;
}
