"use client";

import { useEffect, useState } from "react";
import { InheritanceTooltip } from "./InheritanceTooltip";
import { Abi, AbiFunction } from "abitype";
import { Address, createPublicClient, custom } from "viem";
import { useWalletClient } from "wagmi";
import {
  ContractInput,
  displayTxResult,
  getFunctionInputKey,
  getInitialFormState,
  getParsedContractFunctionArgs,
  transformAbiFunction,
} from "~~/app/readwrite/_components/contract";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type ReadOnlyFunctionFormProps = {
  contractAddress: Address;
  abiFunction: AbiFunction;
  inheritedFrom?: string;
  abi: Abi;
};

export const ReadOnlyFunctionForm = ({
  contractAddress,
  abiFunction,
  inheritedFrom,
  abi,
}: ReadOnlyFunctionFormProps) => {
  const [form, setForm] = useState<Record<string, any>>(() => getInitialFormState(abiFunction));
  const [result, setResult] = useState<unknown>();
  const [isFetching, setIsFetching] = useState(false);
  const { data: walletClient } = useWalletClient();

  const parsedArgs = getParsedContractFunctionArgs(form);

  const handleRead = async () => {
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
        args: parsedArgs,
      });

      console.log('Read successful:', data);
      setResult(data);
    } catch (err) {
      console.error('Read failed:', err);
      const parsedError = getParsedError(err);
      notification.error(parsedError);
    } finally {
      setIsFetching(false);
    }
  };

  const transformedFunction = transformAbiFunction(abiFunction);
  const inputElements = transformedFunction.inputs.map((input, inputIndex) => {
    const key = getFunctionInputKey(abiFunction.name, input, inputIndex);
    return (
      <ContractInput
        key={key}
        setForm={updatedFormValue => {
          setResult(undefined);
          setForm(updatedFormValue);
        }}
        form={form}
        stateObjectKey={key}
        paramType={input}
      />
    );
  });

  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-1">
      <p className="font-medium my-0 break-words">
        {abiFunction.name}
        <InheritanceTooltip inheritedFrom={inheritedFrom} />
      </p>
      {inputElements}
      <div className="flex flex-col md:flex-row justify-between gap-2 flex-wrap">
        <div className="flex-grow w-full md:max-w-[80%]">
          {result !== null && result !== undefined && (
            <div className="bg-secondary rounded-3xl text-sm px-4 py-1.5 break-words overflow-auto">
              <p className="font-bold m-0 mb-1">Result:</p>
              <pre className="whitespace-pre-wrap break-words">{displayTxResult(result, "sm")}</pre>
            </div>
          )}
        </div>
        <button
          className="btn btn-secondary btn-sm self-end md:self-start"
          onClick={handleRead}
          disabled={isFetching}
        >
          {isFetching && <span className="loading loading-spinner loading-xs"></span>}
          Read 📖
        </button>
      </div>
    </div>
  );
};
