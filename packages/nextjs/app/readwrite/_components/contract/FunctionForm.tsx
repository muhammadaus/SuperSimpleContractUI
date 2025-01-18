"use client";

import { useState } from "react";
import { Address } from "~~/components/scaffold-eth";
import { useContractWrite, useContractRead } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useContractStore } from "~~/utils/scaffold-eth/contract";
import { notification } from "~~/utils/scaffold-eth";

interface FunctionFormProps {
  functionFragment: any;
  contractAddress: string;
}

export const FunctionForm = ({ functionFragment, contractAddress }: FunctionFormProps) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const { targetNetwork } = useTargetNetwork();
  const contractStore = useContractStore();
  const contract = contractStore.contracts?.[targetNetwork.id]?.["YourContract"];

  const isWriteFunction = functionFragment.stateMutability !== "view" && functionFragment.stateMutability !== "pure";

  const { data: readData, isLoading: isReadLoading } = useContractRead({
    address: contractAddress as `0x${string}`,
    abi: contract?.abi,
    functionName: functionFragment.name,
    args: functionFragment.inputs.map((input: any) => inputs[input.name] || ""),
    enabled: !isWriteFunction && !!contractAddress,
  });

  const { write: writeFunction, isLoading: isWriteLoading } = useContractWrite({
    address: contractAddress as `0x${string}`,
    abi: contract?.abi,
    functionName: functionFragment.name,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWriteFunction) {
      try {
        const args = functionFragment.inputs.map((input: any) => inputs[input.name] || "");
        await writeFunction({ args });
      } catch (error: any) {
        notification.error(error.message || "Error executing function");
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-1">
      <p className="font-medium my-0 break-words">
        {functionFragment.name}
        <span className="text-xs opacity-70 ml-2">
          ({isWriteFunction ? "Write" : "Read"})
        </span>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {functionFragment.inputs.map((input: any, idx: number) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{input.name}</span>
              <span className="text-xs opacity-70">({input.type})</span>
            </div>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder={input.type}
              value={inputs[input.name] || ""}
              onChange={(e) => setInputs(prev => ({ ...prev, [input.name]: e.target.value }))}
            />
          </div>
        ))}

        <div className="flex justify-between gap-2 flex-wrap">
          <div className="flex-grow w-full md:w-auto">
            {!isWriteFunction && readData !== undefined && (
              <div className="bg-secondary rounded-3xl text-sm px-4 py-1.5 break-words">
                <p className="font-bold m-0 mb-1">Result:</p>
                <pre className="whitespace-pre-wrap break-words">
                  {typeof readData === "object" ? JSON.stringify(readData, null, 2) : String(readData)}
                </pre>
              </div>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={isWriteFunction ? isWriteLoading : isReadLoading}
          >
            {isWriteLoading || isReadLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : isWriteFunction ? (
              "Write 🖊️"
            ) : (
              "Read 📖"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}; 