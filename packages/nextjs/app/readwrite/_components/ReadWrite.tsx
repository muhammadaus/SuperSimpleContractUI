"use client";

import React, { useEffect, useState } from 'react';
import { isAddress, parseEther, formatEther, createPublicClient, http, Address } from 'viem';
import { useTargetNetwork } from '../../../hooks/scaffold-eth/useTargetNetwork';
import { useContractStore } from "../../../utils/scaffold-eth/contract";
import { notification } from "../../../utils/scaffold-eth/notification";
import { useQRTransactionFlow } from "../../../hooks/scaffold-eth/useQRTransactionFlow";

interface FunctionData {
  type: string;
  name: string;
  inputs: {type: string, name: string, internalType?: string}[];
  outputs?: {type: string, name: string, internalType?: string}[];
  stateMutability: string;
}

interface FunctionInputValue {
  [key: string]: string;
}

export default function ReadWrite() {
  const [contractName, setContractName] = useState<string>("");
  const [functions, setFunctions] = useState<FunctionData[]>([]);
  const [readFunctions, setReadFunctions] = useState<FunctionData[]>([]);
  const [writeFunctions, setWriteFunctions] = useState<FunctionData[]>([]);
  const [viewTab, setViewTab] = useState<'read' | 'write'>('read');
  const [functionInputs, setFunctionInputs] = useState<{[key: string]: FunctionInputValue}>({});
  const [functionResults, setFunctionResults] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [errorMessages, setErrorMessages] = useState<{[key: string]: string}>({});
  
  // Default to the first account for reading purposes
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const { targetNetwork } = useTargetNetwork();
  
  // Get contract data from the store
  const contracts = useContractStore(state => state.contracts);
  const contractData = contracts?.[targetNetwork.id]?.YourContract;

  // Add QR transaction flow
  const { 
    initiateQRTransaction, 
    QRTransactionModalComponent, 
    isExecuting, 
    cancelTransaction,
    isModalOpen
  } = useQRTransactionFlow({
    chainId: targetNetwork.id,
  });

  // Get user address if wallet is connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0]);
          }
        } catch (error) {
          console.error("Error checking connection:", error);
        }
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    const initContractInterface = async () => {
      if (!contractData?.abi) return;
      
      try {
        // Try to get contract name
        const client = createPublicClient({
          chain: targetNetwork,
          transport: http(),
        });
        
        try {
          const name = await client.readContract({
            address: contractData.address as Address,
            abi: contractData.abi,
            functionName: 'name',
            args: []
          });
          
          if (name) {
            setContractName(typeof name === 'string' ? name : String(name));
          }
        } catch (error) {
          console.log("Contract might not have a name function");
          // Use a fallback name if the contract doesn't have a name function
          setContractName("Smart Contract");
        }
        
        // Parse ABI to get functions
        const abiFunctions = contractData.abi
          .filter((item: any) => item.type === 'function')
          .map((func: any) => ({
            type: func.type,
            name: func.name,
            inputs: func.inputs || [],
            outputs: func.outputs || [],
            stateMutability: func.stateMutability
          }));
        
        setFunctions(abiFunctions);
        
        // Split into read and write functions
        const reads = abiFunctions.filter((func: FunctionData) => 
          func.stateMutability === 'view' || func.stateMutability === 'pure'
        );
        
        const writes = abiFunctions.filter((func: FunctionData) => 
          func.stateMutability !== 'view' && func.stateMutability !== 'pure'
        );
        
        setReadFunctions(reads);
        setWriteFunctions(writes);
        
        // Initialize inputs for all functions
        const initialInputs: {[key: string]: FunctionInputValue} = {};
        
        abiFunctions.forEach((func: FunctionData) => {
          initialInputs[func.name] = {};
          func.inputs.forEach(input => {
            initialInputs[func.name][input.name] = '';
          });
        });
        
        setFunctionInputs(initialInputs);
      } catch (error) {
        console.error("Error initializing contract interface:", error);
        notification.error("Failed to initialize contract interface");
      }
    };
    
    initContractInterface();
  }, [contractData, targetNetwork]);

  const handleInputChange = (functionName: string, inputName: string, value: string) => {
    setFunctionInputs(prev => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        [inputName]: value
      }
    }));
    
    // Clear previous errors when input changes
    setErrorMessages(prev => ({
      ...prev,
      [functionName]: ''
    }));
  };

  const getParamType = (type: string) => {
    if (type.includes('int') && !type.includes('[]')) {
      return 'number';
    }
    if (type === 'bool') {
      return 'checkbox';
    }
    return 'text';
  };

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'object' && BigInt.prototype.isPrototypeOf(value)) {
      return value.toString();
    }
    
    if (Array.isArray(value)) {
      return `[${value.map(v => formatValue(v, 'unknown')).join(', ')}]`;
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    if (type.includes('int') && !type.includes('[]')) {
      return value.toString();
    }
    
    if (type === 'bool') {
      return value ? 'true' : 'false';
    }
    
    return String(value);
  };

  const parseInputValue = (value: string, type: string): any => {
    if (type.includes('int') && !type.includes('[]')) {
      if (type.startsWith('uint')) {
        try {
          return BigInt(value);
        } catch (e) {
          throw new Error(`Invalid uint value: ${value}`);
        }
      } else {
        try {
          return BigInt(value);
        } catch (e) {
          throw new Error(`Invalid int value: ${value}`);
        }
      }
    }
    
    if (type === 'bool') {
      return value.toLowerCase() === 'true';
    }
    
    if (type === 'address') {
      if (!isAddress(value)) {
        throw new Error(`Invalid address: ${value}`);
      }
      return value as Address;
    }
    
    if (type.includes('[]')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error(`Invalid array format: ${value}`);
      }
    }
    
    return value;
  };

  const callReadFunction = async (func: FunctionData) => {
    if (!contractData?.address) return;
    
    setIsLoading({ ...isLoading, [func.name]: true });
    setErrorMessages({ ...errorMessages, [func.name]: '' });
    
    try {
      const client = createPublicClient({
        chain: targetNetwork,
        transport: http(),
      });
      
      // Prepare the arguments
      const args = func.inputs.map(input => {
        const value = functionInputs[func.name]?.[input.name] || '';
        
        if (!value && input.type !== 'bool') {
          if (input.type.includes('[]')) {
            return []; // Empty array for array types
          }
          if (input.type.includes('int')) {
            return BigInt(0);
          }
          if (input.type === 'address') {
            return '0x0000000000000000000000000000000000000000' as Address;
          }
          return '';
        }
        
        return parseInputValue(value, input.type);
      });
      
      const result = await client.readContract({
        address: contractData.address as Address,
        abi: contractData.abi,
        functionName: func.name,
        args
      });
      
      console.log(`${func.name} result:`, result);
      setFunctionResults(prev => ({ ...prev, [func.name]: result }));
      
      // Show notification for successful read
      notification.success(`Successfully read ${func.name}`);
    } catch (error) {
      console.error(`Error calling ${func.name}:`, error);
      const errorMessage = (error as Error).message || 'Unknown error';
      setErrorMessages(prev => ({ ...prev, [func.name]: errorMessage }));
      notification.error(`Error calling ${func.name}: ${errorMessage}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [func.name]: false }));
    }
  };

  const callWriteFunction = async (func: FunctionData) => {
    if (!contractData?.address) return;
    
    setIsLoading({ ...isLoading, [func.name]: true });
    setErrorMessages({ ...errorMessages, [func.name]: '' });
    
    try {
      // Prepare function data using function selector and ABI encoding
      // For simplicity, we'll use a basic approach here
      const functionSelector = contractData.abi.find(
        (item: any) => item.type === 'function' && item.name === func.name
      );
      
      if (!functionSelector) {
        throw new Error(`Function ${func.name} not found in ABI`);
      }
      
      const args = func.inputs.map(input => {
        const value = functionInputs[func.name]?.[input.name] || '';
        
        if (!value && input.type !== 'bool') {
          if (input.type.includes('[]')) {
            return []; // Empty array for array types
          }
          if (input.type.includes('int')) {
            return BigInt(0);
          }
          if (input.type === 'address') {
            return '0x0000000000000000000000000000000000000000' as Address;
          }
          return '';
        }
        
        return parseInputValue(value, input.type);
      });
      
      // This is a very simplified approach and won't work for most functions
      // In a real implementation, you'd use a proper ABI encoder
      // But for the purposes of this demo, we'll use a generic approach for QR transactions
      
      // If function is payable, determine the ETH value to send
      let ethValue = BigInt(0);
      
      if (func.stateMutability === 'payable') {
        const etherInput = functionInputs[func.name]?.['_value'] || '0';
        try {
          ethValue = parseEther(etherInput);
        } catch (error) {
          console.error("Error parsing ether value:", error);
          ethValue = BigInt(0);
        }
      }
      
      notification.info(`Initiating transaction for ${func.name}...`);
      
      // We would encode the function call properly in a real application
      // For this demo, we'll use a placeholder approach for QR code flow
      try {
        // In a real app, this would be the properly encoded function call
        await initiateQRTransaction(
          contractData.address as Address,
          "0x", // This should be the properly encoded function call
          ethValue
        );
        
        // Reset input values after successful transaction initiation
        const updatedInputs = { ...functionInputs };
        func.inputs.forEach(input => {
          updatedInputs[func.name][input.name] = '';
        });
        setFunctionInputs(updatedInputs);
        
      } catch (error) {
        console.error(`Failed to initiate transaction for ${func.name}:`, error);
        setErrorMessages(prev => ({ 
          ...prev, 
          [func.name]: `Failed to initiate transaction: ${(error as Error).message}` 
        }));
        notification.error(`Transaction Failed: ${(error as Error).message}`);
      }
    } catch (error) {
      console.error(`Error processing ${func.name}:`, error);
      const errorMessage = (error as Error).message || 'Unknown error';
      setErrorMessages(prev => ({ ...prev, [func.name]: errorMessage }));
      notification.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [func.name]: false }));
    }
  };

  const renderFunctionCard = (func: FunctionData, isRead: boolean) => {
    return (
      <div 
        key={func.name} 
        className="p-4 mb-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-blue-400">
            {func.name}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full
            ${func.stateMutability === 'view' ? 'bg-green-900/50 text-green-300' : 
              func.stateMutability === 'pure' ? 'bg-blue-900/50 text-blue-300' : 
              func.stateMutability === 'payable' ? 'bg-red-900/50 text-red-300' : 
              'bg-yellow-900/50 text-yellow-300'}`}
          >
            {func.stateMutability}
          </span>
        </div>
        
        {/* Function inputs */}
        {func.inputs.length > 0 && (
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Inputs:</h4>
            {func.inputs.map((input, idx) => (
              <div key={idx} className="mb-2">
                <label className="block text-xs text-gray-400 mb-1">
                  {input.name || `param${idx}`} ({input.type})
                </label>
                <input
                  type={getParamType(input.type)}
                  value={functionInputs[func.name]?.[input.name] || ''}
                  onChange={(e) => handleInputChange(func.name, input.name, e.target.value)}
                  placeholder={`${input.type}`}
                  className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        
        {/* Add value input for payable functions */}
        {func.stateMutability === 'payable' && (
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">
              ETH Value to Send
            </label>
            <input
              type="text"
              value={functionInputs[func.name]?.['_value'] || ''}
              onChange={(e) => handleInputChange(func.name, '_value', e.target.value)}
              placeholder="0.0"
              className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
        )}
        
        {/* Function outputs for read functions */}
        {isRead && func.outputs && func.outputs.length > 0 && (
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Outputs:</h4>
            {functionResults[func.name] !== undefined ? (
              <div className="p-2 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-100 text-sm font-mono">
                {Array.isArray(functionResults[func.name]) ? (
                  <div className="space-y-1">
                    {functionResults[func.name].map((val: any, idx: number) => (
                      <div key={idx} className="flex">
                        <span className="text-gray-400 mr-2">[{idx}]:</span>
                        <span>{formatValue(val, func.outputs && idx < func.outputs.length ? func.outputs[idx]?.type || 'unknown' : 'unknown')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  formatValue(functionResults[func.name], func.outputs[0]?.type || 'unknown')
                )}
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-500 text-sm italic">
                No data
              </div>
            )}
          </div>
        )}
        
        {/* Error message */}
        {errorMessages[func.name] && (
          <div className="mb-3 p-2 rounded-lg bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {errorMessages[func.name]}
          </div>
        )}
        
        {/* Call button */}
        <button
          onClick={() => isRead ? callReadFunction(func) : callWriteFunction(func)}
          disabled={isLoading[func.name] || isExecuting}
          className={`w-full py-2 px-4 rounded-lg shadow-md transition-all duration-200 relative
            ${(isLoading[func.name] || isExecuting)
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : isRead
                ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium text-sm`}
        >
          <span className={`${isLoading[func.name] ? 'opacity-0' : 'opacity-100'}`}>
            {isRead ? 'Read' : 'Write'}
          </span>
          
          {isLoading[func.name] && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          {contractName || "Smart Contract Interface"}
        </h2>
        <p className="text-md text-gray-300 mt-2">
          {contractData?.address ? (
            <>Contract Address: <span className="font-mono text-sm">{contractData.address.substring(0, 8)}...{contractData.address.substring(36)}</span></>
          ) : (
            "Loading contract address..."
          )}
        </p>
      </div>

      {/* Read/Write Tabs */}
      <div className="flex justify-center mb-6">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setViewTab('read')}
            className={`px-6 py-2 ${
              viewTab === 'read'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } transition-colors`}
          >
            Read
          </button>
          <button
            onClick={() => setViewTab('write')}
            className={`px-6 py-2 ${
              viewTab === 'write'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } transition-colors`}
          >
            Write
          </button>
        </div>
      </div>

      {/* Function Cards */}
      <div className="space-y-4">
        {viewTab === 'read' ? (
          readFunctions.length > 0 ? (
            readFunctions.map(func => renderFunctionCard(func, true))
          ) : (
            <div className="text-center text-gray-400 py-8">
              No read functions found in this contract
            </div>
          )
        ) : (
          writeFunctions.length > 0 ? (
            writeFunctions.map(func => renderFunctionCard(func, false))
          ) : (
            <div className="text-center text-gray-400 py-8">
              No write functions found in this contract
            </div>
          )
        )}
      </div>
      
      {/* Cancel transaction option during loading/executing */}
      {isExecuting && (
        <div className="mt-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="text-center mb-2">
            Transaction in progress. Please check your wallet for confirmation requests.
          </p>
          <button
            onClick={() => {
              cancelTransaction();
              // Reset loading states
              const newLoadingState = { ...isLoading };
              Object.keys(newLoadingState).forEach(key => {
                newLoadingState[key] = false;
              });
              setIsLoading(newLoadingState);
            }}
            className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Render QR Transaction Modal */}
      <QRTransactionModalComponent />
    </div>
  );
}
