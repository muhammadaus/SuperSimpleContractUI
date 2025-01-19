import { useState } from "react";
import { Hash } from "viem";
import { useNetworkStore } from "~~/utils/scaffold-eth/networks";

export const useTransactor = () => {
  const [isPending, setIsPending] = useState(false);
  const { currentNetwork } = useNetworkStore();

  const transactor = async (tx: () => Promise<Hash>) => {
    setIsPending(true);
    try {
      const result = await tx();
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return transactor;
}; 