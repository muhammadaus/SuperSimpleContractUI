import { ContractData } from "./contract";
import scaffoldConfig from "~~/scaffold.config";
import { contracts } from "~~/utils/scaffold-eth/contract";

interface ContractData {
  external?: boolean;
}

export function getAllContracts(): Record<string, ContractData> {
  let allContractsData: Record<string, ContractData> = {};
  const contractsData = contracts?.[scaffoldConfig.targetNetwork.id];
  if (contractsData) {
    allContractsData = { ...allContractsData, ...contractsData };
  }
  return allContractsData;
}

export function getContract(contractName: string): ContractData | null {
  const allContracts = getAllContracts();
  return allContracts[contractName] || null;
}

export function getTargetNetwork(): any {
  // Check if targetNetworks is an array and get the first network, or use the single network
  return Array.isArray(scaffoldConfig.targetNetworks) 
    ? scaffoldConfig.targetNetworks[0] 
    : scaffoldConfig.targetNetworks;
}
