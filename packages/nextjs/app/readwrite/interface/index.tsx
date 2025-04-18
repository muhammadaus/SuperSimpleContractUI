"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { isAddress } from 'viem';
import { ethers } from 'ethers';
import { encodeFunctionData } from "viem";
import { AbiFunction, AbiParameter } from "abitype";
import { notification } from '../../../utils/scaffold-eth/notification';
import { FunctionForm } from './FunctionForm';
import { ContractUI } from './ContractUI';
import { BatchOperation } from '../../../types/batch';

export interface ReadWriteInterfaceProps {
  contractAddress: string;
  abi: any[] | [];
  chainId?: number;
  addToBatch?: (operation: BatchOperation) => void;
}

export const ReadWriteInterface = ({ contractAddress, abi, chainId, addToBatch }: ReadWriteInterfaceProps) => {
  const [parsedAbi, setParsedAbi] = useState<AbiFunction[]>([]);
  const [activeTab, setActiveTab] = useState<string>("read");
  const [selectedFunction, setSelectedFunction] = useState<AbiFunction | null>(null);
  const [executionData, setExecutionData] = useState<{ functionName: string; args: any[] } | null>(null);
  const [etherValue, setEtherValue] = useState<string>("");
  const [executeFetching, setExecuteFetching] = useState<boolean>(false);
  const [executeResult, setExecuteResult] = useState<any>();
  const [accountAddress, setAccountAddress] = useState<string | null>(null);

  // Check if wallet is connected
  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccountAddress(accounts[0].address);
          } else {
            setAccountAddress(null);
          }
        } catch (error) {
          console.error("Error checking wallet:", error);
          setAccountAddress(null);
        }
      }
    };
    
    checkWallet();
    
    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', checkWallet);
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', checkWallet);
      }
    };
  }, []);

  // Group functions by type (read, write, fallback, constructor, etc)
  const functionsByType = useCallback(() => {
    const functionTypes: { [key: string]: AbiFunction[] } = {};

    parsedAbi.forEach((func) => {
      if (func.type === "function") {
        const type = func.stateMutability === "view" || func.stateMutability === "pure" ? "read" : "write";
        if (!functionTypes[type]) functionTypes[type] = [];
        functionTypes[type].push(func);
      } else if (func.type === "constructor" || func.type === "fallback" || func.type === "receive") {
        if (!functionTypes[func.type]) functionTypes[func.type] = [];
        functionTypes[func.type].push(func);
      }
    });

    return functionTypes;
  }, [parsedAbi]);

  // Function to prepare ABI
  useEffect(() => {
    try {
      const filteredAbi = abi.filter(
        (item) => item.type === "function" || item.type === "constructor" || item.type === "fallback" || item.type === "receive",
      );
      setParsedAbi(filteredAbi as AbiFunction[]);
    } catch (error) {
      console.error("Error parsing ABI:", error);
    }
  }, [abi]);

  // Function to execute read operations (view functions)
  const executeRead = useCallback(async () => {
    if (!selectedFunction || !executionData || !contractAddress) return;

    setExecuteFetching(true);
    setExecuteResult(undefined);

    try {
      // Create a provider
      const provider = new ethers.JsonRpcProvider(`https://rpc.ankr.com/eth${chainId ? `_${chainId}` : ""}`);
      const contract = new ethers.Contract(contractAddress, abi, provider);

      // Call the read function
      const result = await contract[executionData.functionName](...executionData.args);
      setExecuteResult(result);
    } catch (error) {
      console.error("Error executing read function:", error);
      notification.error("Error executing read function: " + (error as Error).message);
    } finally {
      setExecuteFetching(false);
    }
  }, [selectedFunction, executionData, contractAddress, abi, chainId]);

  // Function to execute write operations (non-view functions)
  const executeWrite = useCallback(async () => {
    if (!selectedFunction || !executionData || !contractAddress || !accountAddress) return;

    setExecuteFetching(true);
    setExecuteResult(undefined);

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("Ethereum provider not available");
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Format the value if provided
      const value = etherValue ? ethers.parseEther(etherValue) : 0n;

      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await contract[executionData.functionName].estimateGas(
          ...executionData.args, 
          { value }
        );
        // Add 20% buffer
        gasEstimate = (gasEstimate * 120n) / 100n;
      } catch (error) {
        console.error("Gas estimation failed:", error);
        
        // Fall back to default gas limit
        gasEstimate = BigInt(300000);
        notification.info(`Could not estimate gas. Using default limit: ${gasEstimate.toString()}`);
      }

      // Send transaction
      const tx = await contract[executionData.functionName](
        ...executionData.args, 
        { 
          value,
          gasLimit: gasEstimate
        }
      );

      setExecuteResult({ hash: tx.hash });
      notification.success("Transaction sent successfully!");
      
      // Wait for confirmation
      notification.info(`Waiting for confirmation...`);
      const receipt = await tx.wait();
      notification.success(`Transaction confirmed in block ${receipt?.blockNumber}!`);
    } catch (error) {
      console.error("Error executing write function:", error);
      notification.error("Error executing write function: " + (error as Error).message);
    } finally {
      setExecuteFetching(false);
    }
  }, [selectedFunction, executionData, contractAddress, accountAddress, etherValue, abi]);

  // Function to add the current operation to batch
  const handleAddToBatch = useCallback(() => {
    if (!selectedFunction || !executionData || !contractAddress || !addToBatch) return;

    try {
      // Format the value if provided
      const value = etherValue ? etherValue : "0";

      // Encode function data
      const data = encodeFunctionData({
        abi: abi,
        functionName: executionData.functionName,
        args: executionData.args,
      });

      // Create operation description
      const paramDescriptions = executionData.args.map((arg, i) => {
        const param = selectedFunction.inputs[i];
        return `${param?.name || `param${i}`}: ${arg.toString()}`;
      }).join(', ');

      const description = `${executionData.functionName}(${paramDescriptions})${etherValue ? ` with ${etherValue} ETH` : ''}`;

      // Add to batch
      addToBatch({
        type: selectedFunction.stateMutability === "payable" ? "payable_call" : "call",
        interfaceType: "readwrite",
        to: contractAddress,
        data,
        value,
        description
      });

      notification.success(`Added "${executionData.functionName}" to batch queue!`);
    } catch (error) {
      console.error("Error adding to batch:", error);
      notification.error("Error adding to batch: " + (error as Error).message);
    }
  }, [selectedFunction, executionData, contractAddress, etherValue, abi, addToBatch]);

  // Effect to execute when executionData changes
  useEffect(() => {
    if (!executionData || !selectedFunction) return;

    if (selectedFunction.stateMutability === "view" || selectedFunction.stateMutability === "pure") {
      executeRead();
    }
  }, [executionData, selectedFunction, executeRead]);

  // Connect wallet handler
  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      notification.error("Ethereum provider not available. Please use a Web3 browser.");
      return;
    }
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccountAddress(accounts[0].address);
        notification.success("Wallet connected!");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      notification.error("Error connecting wallet: " + (error as Error).message);
    }
  };
  
  // Rendering the interface
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-blue-400">Contract Interface</h2>
        <div className="flex gap-2 items-center">
          {!accountAddress ? (
            <button
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          ) : (
            <div className="text-xs text-gray-300 bg-gray-700 rounded-md px-2 py-1 truncate max-w-[150px]">
              {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
            </div>
          )}
          <div className="tabs tabs-boxed bg-gray-800">
            <button
              className={`tab ${activeTab === "read" ? "bg-blue-600 text-white" : "text-gray-400"}`}
              onClick={() => setActiveTab("read")}
            >
              Read
            </button>
            <button
              className={`tab ${activeTab === "write" ? "bg-blue-600 text-white" : "text-gray-400"}`}
              onClick={() => setActiveTab("write")}
            >
              Write
            </button>
            {functionsByType()["constructor"] && functionsByType()["constructor"].length > 0 && (
              <button
                className={`tab ${activeTab === "constructor" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                onClick={() => setActiveTab("constructor")}
              >
                Constructor
              </button>
            )}
            {(functionsByType()["fallback"] || functionsByType()["receive"]) && (
              <button
                className={`tab ${activeTab === "special" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                onClick={() => setActiveTab("special")}
              >
                Special
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 overflow-y-auto max-h-[70vh] bg-gray-700/30 rounded-xl p-4">
          <h3 className="text-lg font-medium text-blue-400 mb-3">Functions</h3>
          <div className="space-y-2">
            {functionsByType()[activeTab]?.map((func, index) => (
              <button
                key={index}
                className={`w-full text-left p-2 rounded-md transition-all ${
                  selectedFunction?.name === func.name
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/70 text-gray-300 hover:bg-gray-700"
                }`}
                onClick={() => setSelectedFunction(func)}
              >
                <div className="font-medium">{func.name || func.type}</div>
                <div className="text-xs opacity-70">
                  {func.inputs.length > 0
                    ? func.inputs.map((input: AbiParameter) => input.type).join(", ")
                    : "No inputs"}
                </div>
              </button>
            ))}
            {(!functionsByType()[activeTab] || functionsByType()[activeTab].length === 0) && (
              <div className="text-gray-400 italic p-2">No functions of this type available</div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-gray-700/30 rounded-xl p-4">
          {selectedFunction ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-400">
                {selectedFunction.name || selectedFunction.type}
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                  {selectedFunction.stateMutability || "function"}
                </span>
              </h3>

              <FunctionForm
                functionDetails={selectedFunction}
                onSubmit={(functionName, args) => {
                  setExecutionData({ functionName, args });
                }}
                onEtherValueChange={
                  selectedFunction.stateMutability === "payable" ? setEtherValue : undefined
                }
              />

              <div className="flex gap-2 mt-4">
                {(selectedFunction.stateMutability === "view" || selectedFunction.stateMutability === "pure") ? (
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    onClick={executeRead}
                    disabled={executeFetching || !executionData}
                  >
                    {executeFetching ? "Loading..." : "Execute Read"}
                  </button>
                ) : (
                  <>
                    <button
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                      onClick={executeWrite}
                      disabled={executeFetching || !executionData || !accountAddress}
                    >
                      {executeFetching ? "Processing..." : "Execute Write"}
                    </button>
                    
                    {addToBatch && (
                      <button
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                        onClick={handleAddToBatch}
                        disabled={!executionData || !accountAddress}
                      >
                        Add to Batch
                      </button>
                    )}
                  </>
                )}
              </div>

              {executeResult !== undefined && (
                <div className="mt-4">
                  <h4 className="text-md font-medium text-blue-400 mb-2">Result:</h4>
                  <ContractUI data={executeResult} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 italic flex items-center justify-center h-full">
              Select a function from the list to interact with it
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadWriteInterface; 