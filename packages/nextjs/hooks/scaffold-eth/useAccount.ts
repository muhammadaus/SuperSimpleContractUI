import { useEffect, useState } from "react";
import { Address } from "viem";

export function useAccount() {
  const [address, setAddress] = useState<Address | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function getAccount() {
      if (typeof window !== 'undefined' && window.ethereum) {
        setIsConnecting(true);
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAddress(accounts[0] as Address);
        } catch (e) {
          console.error("Error connecting to wallet:", e);
        }
        setIsConnecting(false);
      }
    }

    getAccount();
  }, []);

  return {
    address,
    isConnecting,
    isConnected: !!address,
  };
} 