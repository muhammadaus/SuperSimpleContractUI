import { useState } from "react";
import { createWalletClient, custom, encodeFunctionData, getAccount } from "viem";
import { useNetworkStore } from "~~/utils/scaffold-eth/networks";

export function useWriteContract() {
  const [isLoading, setIsLoading] = useState(false);
  const [hash, setHash] = useState<string>();
  const { currentNetwork } = useNetworkStore();

  const writeContract = async ({
    address,
    abi,
    functionName,
    args,
  }: {
    address: `0x${string}`;
    abi: any[];
    functionName: string;
    args: any[];
  }) => {
    if (!window.ethereum) throw new Error("No wallet found");
    
    setIsLoading(true);
    try {
      const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const walletClient = createWalletClient({
        account,
        chain: currentNetwork,
        transport: custom(window.ethereum)
      });

      const data = encodeFunctionData({
        abi,
        functionName,
        args,
      });

      const hash = await walletClient.sendTransaction({
        account,
        to: address,
        data,
      });

      setHash(hash);
      return hash;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    writeContractAsync: writeContract,
    isLoading,
    hash,
  };
} 