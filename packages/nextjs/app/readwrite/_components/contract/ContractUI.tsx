"use client";

// @refresh reset
import React, { useReducer } from "react";
import { ContractReadMethods } from "./ContractReadMethods";
import { ContractVariables } from "./ContractVariables";
import { ContractWriteMethods } from "./ContractWriteMethods";
import { FunctionForm } from "./FunctionForm";
import { Address, Balance } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ContractName } from "~~/utils/scaffold-eth/contract";
import { isAddress } from "viem";
import { useContractStore } from "~~/utils/scaffold-eth/contract";

/**
 * UI component to interface with deployed contracts.
 **/
export const ContractUI = ({ contractName, className = "" }: ContractUIProps) => {
  const [refreshDisplayVariables, triggerRefreshDisplayVariables] = useReducer(value => !value, false);
  const { targetNetwork } = useTargetNetwork();
  const contractStore = useContractStore();
  
  console.log("ContractUI Store State:", {
    networkId: targetNetwork.id,
    contracts: contractStore.contracts,
    networkContracts: contractStore.contracts?.[targetNetwork.id],
    hasYourContract: !!contractStore.contracts?.[targetNetwork.id]?.["YourContract"]
  });

  const { data: deployedContractData, isLoading: deployedContractLoading } = useDeployedContractInfo("YourContract");
  const networkColor = useNetworkColor();

  // Add debug logs
  console.log("Contract Data:", {
    targetNetwork,
    deployedContractData,
    isLoading: deployedContractLoading,
    status: deployedContractData ? 'Found' : 'Not Found'
  });

  if (deployedContractLoading) {
    return (
      <div className="mt-14">
        <span className="loading loading-spinner loading-lg text-blue-500"></span>
      </div>
    );
  }

  if (!deployedContractData) {
    return (
      <p className="text-3xl mt-14 text-gray-300">
        {`No contract found on chain "${targetNetwork.name}"!`}
      </p>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-6 px-6 lg:px-10 lg:gap-12 w-full max-w-7xl my-0 ${className}`}>
      <div className="col-span-5 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="col-span-1 flex flex-col">
          {/* Contract Info Card */}
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl 
            px-6 lg:px-8 mb-6 space-y-1 py-4 shadow-lg">
            <div className="flex">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-200">{contractName}</span>
                <Address address={deployedContractData.address} />
                <div className="flex gap-1 items-center">
                  <span className="font-bold text-sm text-gray-300">Balance:</span>
                  <Balance address={deployedContractData.address} className="px-0 h-1.5 min-h-[0.375rem]" />
                </div>
              </div>
            </div>
            {targetNetwork && (
              <p className="my-0 text-sm text-gray-300">
                <span className="font-bold">Network</span>:{" "}
                <span style={{ color: networkColor }}>{targetNetwork.name}</span>
              </p>
            )}
          </div>

          {/* Contract Variables */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl px-6 lg:px-8 py-4 
            shadow-lg border border-gray-700">
            <ContractVariables
              refreshDisplayVariables={refreshDisplayVariables}
              deployedContractData={deployedContractData}
            />
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          {/* Read Methods */}
          <div className="z-10">
            <div className="relative mb-2">
              <div className="h-[3rem] w-[4rem] bg-gray-800 rounded-xl py-2">
                <div className="flex items-center justify-center">
                  <p className="my-0 text-sm text-gray-300">Read</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl shadow-lg 
              border border-gray-800 flex flex-col">
              <div className="p-5 divide-y divide-gray-800">
                <ContractReadMethods deployedContractData={deployedContractData} />
              </div>
            </div>
          </div>

          {/* Write Methods */}
          <div className="z-10">
            <div className="relative mb-2">
              <div className="h-[3rem] w-[4rem] bg-gray-800 rounded-xl py-2">
                <div className="flex items-center justify-center">
                  <p className="my-0 text-sm text-gray-300">Write</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl shadow-lg 
              border border-gray-800 flex flex-col">
              <div className="p-5 divide-y divide-gray-800">
                <ContractWriteMethods
                  deployedContractData={deployedContractData}
                  onChange={triggerRefreshDisplayVariables}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
