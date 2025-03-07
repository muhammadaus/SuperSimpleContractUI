"use client";

import { useEffect, useState } from "react";
import { Address } from "viem";
// import { useAccount } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export default function BridgePage() {
  // const { address: userAddress } = useAccount();
  const { data: deployedContractData } = useDeployedContractInfo("YourContract");
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
      
      // Create a wallet client for bridging
      const client = createWalletClient({
        transport: custom(window.ethereum)
      });

      // Get the L2 gas estimate
      const l2GasPrice = await client.readContract({
        address: deployedContractData?.address as Address,
        abi: deployedContractData?.abi,
        functionName: 'l2GasPrice',
      });

      // Execute the bridge transaction
      const hash = await client.writeContract({
        address: deployedContractData?.address as Address,
        abi: deployedContractData?.abi,
        functionName: 'relayTokens',
        args: [
          userAddress, // l1Token (using user's address as example)
          l2Address,   // l2Token
          BigInt(amount),
          userAddress  // recipient
        ],
        value: l2GasPrice, // Pay for L2 gas
      });

      console.log('Bridge transaction submitted:', hash);
      notification.success("Bridge transaction submitted!");

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