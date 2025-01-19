"use client";

import { useEffect, useState } from "react";
import { InheritanceTooltip } from "./InheritanceTooltip";
import { displayTxResult } from "./utilsDisplay";
import { Abi, AbiFunction } from "abitype";
import { Address, createPublicClient, custom } from "viem";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAnimationConfig } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type DisplayVariableProps = {
  contractAddress: Address;
  abiFunction: AbiFunction;
  refreshDisplayVariables: boolean;
  inheritedFrom?: string;
  abi: Abi;
};

export const DisplayVariable = ({
  contractAddress,
  abiFunction,
  refreshDisplayVariables,
  abi,
  inheritedFrom,
}: DisplayVariableProps) => {
  const [result, setResult] = useState<unknown>();
  const [isFetching, setIsFetching] = useState(false);
  const { showAnimation } = useAnimationConfig(result);

  const readData = async () => {
    if (!window.ethereum) {
      notification.error("Please install MetaMask");
      return;
    }

    try {
      setIsFetching(true);
      
      // Create a client using the wallet's provider
      const client = createPublicClient({
        transport: custom(window.ethereum),
      });

      // Read directly using viem client
      const data = await client.readContract({
        address: contractAddress,
        abi: abi,
        functionName: abiFunction.name,
      });

      setResult(data);
    } catch (err) {
      console.error('Read failed:', err);
      const parsedError = getParsedError(err);
      notification.error(parsedError);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    readData();
  }, [refreshDisplayVariables]);

  return (
    <div className="space-y-1 pb-2">
      <div className="flex items-center">
        <h3 className="font-medium text-lg mb-0 break-all">{abiFunction.name}</h3>
        <button className="btn btn-ghost btn-xs" onClick={readData}>
          {isFetching ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <ArrowPathIcon className="h-3 w-3 cursor-pointer" aria-hidden="true" />
          )}
        </button>
        <InheritanceTooltip inheritedFrom={inheritedFrom} />
      </div>
      <div className="text-gray-500 font-medium flex flex-col items-start">
        <div>
          <div
            className={`break-all block transition bg-transparent ${
              showAnimation ? "bg-warning rounded-sm animate-pulse-fast" : ""
            }`}
          >
            {displayTxResult(result)}
          </div>
        </div>
      </div>
    </div>
  );
};
