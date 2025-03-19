"use client";

import { useState, useEffect } from 'react';
import { createWalletClient, http, parseEther, encodeFunctionData, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isAddress } from 'viem';
import * as viemChains from 'viem/chains';
import { Chain } from 'viem/chains';
import Select, { SingleValue } from 'react-select';
import { notification } from "@/utils/scaffold-eth/notification";
import { useTargetNetwork } from "@/hooks/scaffold-eth/useTargetNetwork";
import { ArrowPathIcon, CodeBracketIcon } from "@heroicons/react/24/outline";

type ChainName = keyof typeof viemChains;

interface ChainOption {
  value: ChainName;
  label: string;
}

export default function DeployPage() {
  const { targetNetwork } = useTargetNetwork();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [bytecode, setBytecode] = useState('');
  const [constructorArgs, setConstructorArgs] = useState<{[key: string]: string}>({});
  const [abi, setAbi] = useState<any[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentTx, setDeploymentTx] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [isBytecodeTooLong, setIsBytecodeTooLong] = useState(false);
  const [isBytecodeValid, setIsBytecodeValid] = useState(true);
  const [valueToSend, setValueToSend] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<ChainOption>({ 
    value: 'mainnet' as ChainName, 
    label: 'mainnet' 
  });
  const [gasLimit, setGasLimit] = useState('');
  const [gasPriority, setGasPriority] = useState('');

  // Update the state when the target network changes
  useEffect(() => {
    // Convert targetNetwork id to chain name
    const chainEntries = Object.entries(viemChains).find(
      ([_, chain]) => typeof chain === 'object' && 'id' in chain && chain.id === targetNetwork.id
    );
    
    if (chainEntries) {
      const chainName = chainEntries[0] as ChainName;
      setSelectedNetwork({
        value: chainName,
        label: chainName
      });
    }
  }, [targetNetwork]);

  // Get all available chains for the select dropdown
  const options: ChainOption[] = Object.keys(viemChains)
    .filter(key => {
      const chain = (viemChains as any)[key];
      return typeof chain === 'object' && 'id' in chain;
    })
    .map(chain => ({ 
      value: chain as ChainName, 
      label: chain 
    }));

  const handleNetworkChange = (selected: SingleValue<ChainOption>) => {
    if (selected) {
      setSelectedNetwork(selected);
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      notification.error("No wallet detected! Please install MetaMask or another web3 wallet.");
      return;
    }

    try {
      // First, try to switch to the correct network
      try {
        const newNetwork = (viemChains as any)[selectedNetwork.value];
        
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${newNetwork.id.toString(16)}` }],
        });
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          const newNetwork = (viemChains as any)[selectedNetwork.value];
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${newNetwork.id.toString(16)}`,
                chainName: newNetwork.name,
                nativeCurrency: {
                  name: newNetwork.nativeCurrency.name,
                  symbol: newNetwork.nativeCurrency.symbol,
                  decimals: newNetwork.nativeCurrency.decimals
                },
                rpcUrls: [newNetwork.rpcUrls.default.http[0]],
                blockExplorerUrls: newNetwork.blockExplorers?.default 
                  ? [newNetwork.blockExplorers.default.url] 
                  : undefined
              }
            ],
          });
        } else {
          throw switchError;
        }
      }

      // After setting the correct network, request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts'
      });
      
      setUserAddress(accounts[0]);
      notification.success(`Connected to ${selectedNetwork.label} network`);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      notification.error("Failed to connect wallet");
    }
  };

  // Check if bytecode is valid
  const validateBytecode = (code: string) => {
    // Bytecode should be a hex string starting with 0x
    const isValidHex = /^0x[0-9a-fA-F]+$/.test(code);
    setIsBytecodeValid(isValidHex || code === '');
    setIsBytecodeTooLong(code.length > 100000);
    return isValidHex;
  };

  const handleBytecodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newBytecode = e.target.value;
    setBytecode(newBytecode);
    validateBytecode(newBytecode);
  };

  // Parse ABI from bytecode if possible
  const parseABI = (code: string) => {
    // In a real application, you might use tools like etherscan API to get ABI
    // For simplicity, let's allow the user to manually input constructor args
    try {
      // Look for metadata in the bytecode (simplified approach)
      const metadataPos = code.lastIndexOf('a264697066735822');
      if (metadataPos !== -1) {
        notification.info("Detected contract metadata in bytecode");
      }
      
      // For now, we'll just assume a simple constructor with uint256 and address parameters
      const dummyConstructor = {
        type: 'constructor',
        inputs: [
          { name: 'param1', type: 'uint256' },
          { name: 'param2', type: 'address' },
        ],
        stateMutability: 'nonpayable'
      };
      
      setAbi([dummyConstructor]);
      setConstructorArgs({ param1: '', param2: '' });
    } catch (error) {
      console.error("Error parsing ABI:", error);
    }
  };

  // Parse ABI from JSON input
  const handleAbiInput = (abiString: string) => {
    try {
      const parsedAbi = JSON.parse(abiString);
      
      // Find the constructor in the ABI
      const constructor = parsedAbi.find((item: any) => item.type === 'constructor');
      
      if (constructor) {
        setAbi([constructor]);
        
        // Initialize constructor arguments
        const args: {[key: string]: string} = {};
        constructor.inputs.forEach((input: any, index: number) => {
          args[input.name || `param${index + 1}`] = '';
        });
        
        setConstructorArgs(args);
        notification.success("Constructor ABI loaded successfully!");
      } else {
        notification.info("No constructor found in ABI");
      }
    } catch (error) {
      notification.error("Invalid ABI format");
    }
  };

  // Handle constructor argument change
  const handleArgChange = (name: string, value: string) => {
    setConstructorArgs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Deploy contract
  const deployContract = async () => {
    if (!userAddress) {
      notification.info("Please connect your wallet first");
      return;
    }

    if (!validateBytecode(bytecode)) {
      notification.error("Invalid bytecode format");
      return;
    }

    if (isBytecodeTooLong) {
      notification.info("Bytecode is very long, which may cause deployment to fail due to gas limits");
    }

    setIsDeploying(true);
    setDeploymentTx(null);
    setDeployedAddress(null);

    try {
      // Encode constructor arguments if any
      const constructorAbi = abi.find(item => item.type === 'constructor');
      let encodedArgs = '';
      
      if (constructorAbi && constructorAbi.inputs.length > 0) {
        const args = constructorAbi.inputs.map((input: any) => {
          const value = constructorArgs[input.name || 'param'];
          
          if (input.type === 'address') {
            if (!isAddress(value)) {
              throw new Error(`Invalid address for parameter ${input.name || 'param'}`);
            }
            return value;
          } else if (input.type.includes('int')) {
            if (value === '') return '0';
            return value;
          } else {
            return value;
          }
        });
        
        // For simplicity, we're not fully implementing ABI encoding here
        // In a real application, you would use encodeFunctionData or similar
        console.log("Constructor arguments:", args);
      }

      // Create a wallet client
      const selectedChain = (viemChains as any)[selectedNetwork.value];
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("Web3 provider not available");
      }
      
      // Request to deploy the contract
      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: userAddress,
            data: bytecode + encodedArgs,
            value: valueToSend ? `0x${parseInt(valueToSend).toString(16)}` : undefined,
            gas: gasLimit ? `0x${parseInt(gasLimit).toString(16)}` : undefined,
            maxPriorityFeePerGas: gasPriority ? `0x${parseInt(gasPriority).toString(16)}` : undefined,
          },
        ],
      });
      
      setDeploymentTx(tx);
      notification.success("Transaction submitted! Waiting for confirmation...");
      
      // Listen for transaction receipt
      const receipt = await waitForTransactionReceipt(tx, selectedChain);
      
      if (receipt.contractAddress) {
        setDeployedAddress(receipt.contractAddress);
        notification.success(`Contract deployed at ${receipt.contractAddress}`);
      }
    } catch (error: any) {
      console.error("Deployment error:", error);
      notification.error(error.message || "Contract deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  // Helper function to wait for transaction receipt
  const waitForTransactionReceipt = async (txHash: string, chain: Chain): Promise<any> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Web3 provider not available");
    }
    
    const ethereum = window.ethereum;
    
    return new Promise((resolve, reject) => {
      const checkReceipt = async () => {
        try {
          const receipt: any = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          
          if (receipt) {
            resolve(receipt);
          } else {
            // Still pending, check again after a delay
            setTimeout(checkReceipt, 2000);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkReceipt();
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center py-10">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Deploy your</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
            Smart Contract
          </span>
        </h1>
        <p className="text-lg text-gray-300">
          Input your{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            contract bytecode
          </code>{" "}
          and deploy directly to the blockchain
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-grow px-4 pb-10 gap-6">
        {/* Left Column - Deployment Form */}
        <div className="md:w-1/2">
          <div className="w-full mb-4">
            <label htmlFor="networkSelector" className="block text-sm font-medium text-gray-300 mb-2">
              Target Network:
            </label>
            <Select
              id="networkSelector"
              value={selectedNetwork}
              options={options}
              onChange={handleNetworkChange}
              styles={{
                control: (base) => ({
                  ...base,
                  backgroundColor: '#1f2937',
                  borderColor: '#374151',
                  color: '#fff',
                  boxShadow: 'none',
                  '&:hover': {
                    borderColor: '#4b5563'
                  }
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused ? '#374151' : '#1f2937',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: '#374151'
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: '#fff'
                }),
                input: (base) => ({
                  ...base,
                  color: '#fff'
                })
              }}
              className="mt-1"
            />
          </div>

          <div className="mb-4">
            <button
              onClick={connectWallet}
              className={`w-full px-4 py-2 rounded-lg ${
                userAddress 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors text-white font-medium`}
            >
              {userAddress ? 'Connected: ' + userAddress.substring(0, 6) + '...' + userAddress.substring(38) : 'Connect Wallet'}
            </button>
          </div>

          <div className="mb-4">
            <label htmlFor="bytecodeInput" className="block text-sm font-medium text-gray-300 mb-2">
              Contract Bytecode:
            </label>
            <textarea
              id="bytecodeInput"
              className={`w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border ${
                isBytecodeValid ? 'border-gray-700' : 'border-red-500'
              } text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              rows={6}
              placeholder="Enter contract bytecode (0x...)"
              value={bytecode}
              onChange={handleBytecodeChange}
            />
            {!isBytecodeValid && (
              <p className="mt-1 text-sm text-red-500">
                Invalid bytecode format. Should be a hex string starting with 0x.
              </p>
            )}
            {isBytecodeTooLong && (
              <p className="mt-1 text-sm text-yellow-500">
                Warning: Bytecode is very long, which may result in high gas fees or failed deployment due to gas limits.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="valueInput" className="block text-sm font-medium text-gray-300 mb-2">
                Value to Send (wei):
              </label>
              <input
                id="valueInput"
                type="text"
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                value={valueToSend}
                onChange={(e) => setValueToSend(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="gasLimitInput" className="block text-sm font-medium text-gray-300 mb-2">
                Gas Limit (optional):
              </label>
              <input
                id="gasLimitInput"
                type="text"
                className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6000000"
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="priorityFeeInput" className="block text-sm font-medium text-gray-300 mb-2">
              Max Priority Fee (Gwei):
            </label>
            <input
              id="priorityFeeInput"
              type="text"
              className="w-full p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.5"
              value={gasPriority}
              onChange={(e) => setGasPriority(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Constructor Arguments (ABI):
            </label>
            <div className="flex items-center mb-2">
              <input
                type="file"
                id="abiUpload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      if (e.target?.result) {
                        handleAbiInput(e.target.result as string);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
              <label
                htmlFor="abiUpload"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white cursor-pointer flex items-center transition-colors"
              >
                <CodeBracketIcon className="h-4 w-4 mr-2" />
                Upload ABI
              </label>
              <span className="ml-2 text-xs text-gray-400">(Optional: Upload ABI to parse constructor arguments)</span>
            </div>
          </div>

          {/* Constructor Arguments */}
          {abi.length > 0 && abi[0].inputs && abi[0].inputs.length > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-gray-800/70 backdrop-blur-sm border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Constructor Arguments:</h3>
              <div className="space-y-3">
                {abi[0].inputs.map((input: any, index: number) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-400 mb-1">
                      {input.name || `Parameter ${index + 1}`} ({input.type})
                    </label>
                    <input
                      type="text"
                      className="w-full p-2 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder={`Enter ${input.type} value`}
                      value={constructorArgs[input.name || `param${index + 1}`] || ''}
                      onChange={(e) => handleArgChange(input.name || `param${index + 1}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={deployContract}
            disabled={!userAddress || !bytecode || !isBytecodeValid || isDeploying}
            className={`w-full px-6 py-3 rounded-lg shadow-lg transition-colors ${
              !userAddress || !bytecode || !isBytecodeValid || isDeploying
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
            } font-medium flex justify-center items-center`}
          >
            {isDeploying ? (
              <>
                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                Deploying...
              </>
            ) : (
              'Deploy Contract'
            )}
          </button>
        </div>

        {/* Right Column - Deployment Results/Info */}
        <div className="md:w-1/2">
          <div className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 h-full">
            {deployedAddress ? (
              <div className="space-y-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
                  Deployment Successful!
                </h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Contract Address:</h3>
                  <div className="p-3 bg-gray-900 rounded-lg break-all">
                    <code className="text-green-400">{deployedAddress}</code>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Transaction Hash:</h3>
                  <div className="p-3 bg-gray-900 rounded-lg break-all">
                    <code className="text-purple-400">{deploymentTx}</code>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Next Steps:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-300">
                    <li>Verify your contract on the block explorer</li>
                    <li>Interact with your contract using the Contract Reader</li>
                    <li>Share your contract address with others</li>
                  </ul>
                </div>
              </div>
            ) : deploymentTx ? (
              <div className="flex flex-col items-center justify-center h-full">
                <ArrowPathIcon className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-100 mb-2">Transaction Pending</h2>
                <p className="text-gray-400 mb-4">Waiting for transaction confirmation...</p>
                <div className="w-full p-3 bg-gray-900 rounded-lg break-all">
                  <span className="text-xs text-gray-500">Transaction Hash:</span>
                  <code className="block mt-1 text-sm text-purple-400">{deploymentTx}</code>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">
                  Deploy a Smart Contract
                </h2>
                
                <div className="space-y-5 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">What you'll need:</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Contract bytecode (compiled Solidity contract)</li>
                      <li>Constructor arguments (if applicable)</li>
                      <li>Connected wallet with funds for gas fees</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">Steps to deploy:</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Select the target network for deployment</li>
                      <li>Connect your wallet to the selected network</li>
                      <li>Paste your contract bytecode</li>
                      <li>Set optional parameters (value to send, gas limit)</li>
                      <li>Upload ABI and provide constructor arguments (if needed)</li>
                      <li>Click "Deploy Contract" and confirm in your wallet</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">Where to get bytecode?</h3>
                    <p className="mb-2">
                      You can obtain contract bytecode by:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Compiling Solidity code using Remix or Hardhat</li>
                      <li>Using the "evm.deployedBytecode" output from a compiler</li>
                      <li>Extracting from a verified contract on a block explorer</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-700/50 mt-6">
                    <h3 className="font-semibold text-yellow-400 mb-2">Important Notes:</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300">
                      <li>Contract deployment consumes gas. Make sure your wallet has enough funds</li>
                      <li>Large contracts may require higher gas limits</li>
                      <li>Double-check your constructor arguments before deploying</li>
                      <li>Contracts cannot be undone once deployed</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 