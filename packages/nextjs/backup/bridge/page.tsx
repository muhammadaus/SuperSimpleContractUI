"use client";

import { useEffect, useState } from "react";
import { Address, createPublicClient, http } from 'viem';
// import { useAccount } from "wagmi";
import { useDeployedContractInfo } from "../../hooks/scaffold-eth/useDeployedContractInfo";
import { notification } from "../../utils/scaffold-eth/notification";
import { useTargetNetwork } from "../../hooks/scaffold-eth/useTargetNetwork";

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function BridgePage() {
  // Mock user address for now
  const userAddress = "0x0000000000000000000000000000000000000000";
  const { data: deployedContractData } = useDeployedContractInfo("YourContract");
  const { targetNetwork } = useTargetNetwork();
  const [amount, setAmount] = useState("");
  const [l2Address, setL2Address] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBridge = async () => {
    if (!window.ethereum) {
      notification.error("Please install MetaMask");
      return;
    }

    try {
      setIsLoading(true);
      
      // Create a public client for reading
      const client = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });

      // Mock bridge transaction
      notification.success("Bridge transaction submitted!");
      console.log("Bridge transaction would send:", {
        from: userAddress,
        to: l2Address,
        amount: amount
      });

    } catch (err) {
      console.error('Bridge failed:', err);
      notification.error("Bridge failed: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center pt-10">
      <h1 className="text-4xl font-bold mb-8">Bridge</h1>
      
      <div className="w-full max-w-md space-y-4">
        <div>
          <label className="label">Amount</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input input-bordered w-full"
            placeholder="Enter amount"
          />
        </div>

        <div>
          <label className="label">Destination Address</label>
          <input
            type="text"
            value={l2Address}
            onChange={(e) => setL2Address(e.target.value)}
            className="input input-bordered w-full"
            placeholder="Enter Destination address"
          />
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={handleBridge}
          disabled={isLoading || !amount || !l2Address}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "Bridge Tokens"
          )}
        </button>
      </div>
    </div>
  );
} 