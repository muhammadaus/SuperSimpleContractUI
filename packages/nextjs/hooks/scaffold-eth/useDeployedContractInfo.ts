import { useEffect, useState } from "react";
import { useTargetNetwork } from "./useTargetNetwork";
import { useIsMounted } from "usehooks-ts";
// import { usePublicClient } from "wagmi";
import { Contract, ContractCodeStatus, ContractName, useContractStore } from "~~/utils/scaffold-eth/contract";

export const useDeployedContractInfo = <TContractName extends ContractName>(contractName: TContractName) => {
  const isMounted = useIsMounted();
  const { targetNetwork } = useTargetNetwork();
  const contractStore = useContractStore();
  
  // Get contract from the store using the provided contractName
  const deployedContract = contractStore.contracts?.[targetNetwork.id]?.[contractName] as Contract<TContractName>;
  
  console.log("Contract Store Debug:", {
    targetNetworkId: targetNetwork.id,
    contractName,
    allContracts: contractStore.contracts,
    networkContracts: contractStore.contracts?.[targetNetwork.id],
    deployedContract,
  });

  const [status, setStatus] = useState<ContractCodeStatus>(ContractCodeStatus.LOADING);
  // const publicClient = usePublicClient({ chainId: targetNetwork.id });

  useEffect(() => {
    const checkContractDeployment = async () => {
      try {
        if (!isMounted()) return;

        if (!deployedContract) {
          setStatus(ContractCodeStatus.NOT_FOUND);
          return;
        }

        // If we have a contract in the store, consider it deployed
        // This is because we just added it ourselves
        setStatus(ContractCodeStatus.DEPLOYED);

        // Optionally verify the bytecode
        try {
          const code = await publicClient.getBytecode({
            address: deployedContract.address as `0x${string}`,
          });

          if (code === "0x") {
            console.warn("Contract has no bytecode, but continuing anyway as it was manually added");
          }
        } catch (e) {
          console.warn("Failed to verify bytecode, but continuing as contract was manually added:", e);
        }

      } catch (e) {
        console.error("Contract deployment check error:", e);
        setStatus(ContractCodeStatus.NOT_FOUND);
      }
    };

    checkContractDeployment();
  }, [isMounted, contractName, deployedContract, publicClient]);

  // If we have a contract in the store, return it regardless of bytecode check
  if (deployedContract && status === ContractCodeStatus.LOADING) {
    setStatus(ContractCodeStatus.DEPLOYED);
  }

  return {
    data: (deployedContract && status !== ContractCodeStatus.NOT_FOUND) ? deployedContract : undefined,
    isLoading: status === ContractCodeStatus.LOADING,
  };
};