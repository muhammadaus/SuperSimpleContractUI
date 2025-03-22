"use client";

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Link from "next/link";
import type { NextPage } from "next";
import { PencilIcon, TableCellsIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import Select, { SingleValue } from 'react-select';
import * as viemChains from 'viem/chains';
import { isAddress } from 'viem';
import { setContracts } from '@/utils/scaffold-eth/contract';
import scaffoldConfig from '@/scaffold.config';
import { Chain } from 'viem/chains';
import { Address } from "viem";
import { GenericContractsDeclaration } from "@/utils/scaffold-eth/contract";
import { useRouter } from 'next/navigation';
import { useContractStore } from "@/utils/scaffold-eth/contract";
import { setTargetNetwork } from "@/utils/scaffold-eth/networks";
import { getAllContracts } from "@/utils/scaffold-eth/contractsData";
import { notification } from "@/utils/scaffold-eth/notification";
import dynamic from 'next/dynamic';

// Lazy load contract interfaces
const ERC20Interface = dynamic(() => import('./erc20/interface'), { ssr: false });
const NFTInterface = dynamic(() => import('./nft/interface'), { ssr: false });
const WrapInterface = dynamic(() => import('./wrap/interface'), { ssr: false });
const BridgeInterface = dynamic(() => import('./bridge/interface'), { ssr: false });
const ReadWriteInterface = dynamic(() => import('./readwrite/_components/ReadWrite'), { ssr: false });

// Define the chain names type from viem/chains
type ChainName = keyof typeof viemChains;

// Define the ChainOption interface
interface ChainOption {
  value: ChainName;
  label: string;
}

// Define ABI function type for table view
interface ABIFunction {
  type: string;
  name: string;
  inputs: { type: string; name: string }[];
  outputs?: { type: string; name: string }[];
  stateMutability?: string;
}

const Home: NextPage = () => {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [abi, setAbi] = useState('');
  const [formattedAbi, setFormattedAbi] = useState('');
  const [isAddressEmpty, setIsAddressEmpty] = useState(true);
  const [isAddressTooShort, setIsAddressTooShort] = useState(false);
  const [isAbiInvalid, setIsAbiInvalid] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<ChainOption>({ 
    value: 'mainnet' as ChainName, 
    label: 'mainnet' 
  });
  const [isContractLoaded, setIsContractLoaded] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [isValidAbi, setIsValidAbi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [parsedAbi, setParsedAbi] = useState<any[]>([]);
  const [showTutorial, setShowTutorial] = useState(true);
  const [contractInterface, setContractInterface] = useState<string | null>(null);

  // Get all chain information
  const chainInfo = useMemo(() => {
    const chains = Object.entries(viemChains)
      .filter(([name, chain]) => 
        typeof chain === 'object' && 
        'id' in chain && 
        'name' in chain
      )
      .map(([name, chain]) => ({
        name,
        id: chain.id,
        displayName: chain.name,
      }));

    console.log("Available Chains:", chains);
    
    // Create a mapping of chain IDs to names
    const chainIdToName = Object.fromEntries(
      chains.map(chain => [chain.id, chain.name])
    );
    console.log("Chain ID to Name mapping:", chainIdToName);

    return {
      chains,
      chainIdToName,
    };
  }, []);

  const options: ChainOption[] = Object.keys(viemChains).map(chain => ({ 
    value: chain as ChainName, 
    label: chain 
  }));

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setAddress(newAddress);
    setIsAddressEmpty(!newAddress);
    setIsAddressTooShort(newAddress.length < 42);
    setIsValidAddress(isAddress(newAddress));
  };

  const handleAbiChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAbi = e.target.value;
    setAbi(newAbi);
    try {
      const parsed = JSON.parse(newAbi);
      setParsedAbi(parsed);
      setIsAbiInvalid(false);
      setIsValidAbi(true);
      
      // Format the ABI with proper indentation for display
      setFormattedAbi(JSON.stringify(parsed, null, 2));
    } catch (error) {
      setIsAbiInvalid(true);
      setIsValidAbi(false);
      setFormattedAbi(newAbi);
    }
  };

  // Format ABI on initial load
  useEffect(() => {
    if (abi) {
      try {
        const parsed = JSON.parse(abi);
        setFormattedAbi(JSON.stringify(parsed, null, 2));
      } catch (error) {
        setFormattedAbi(abi);
      }
    }
  }, []);

  const handleNetworkChange = (selected: SingleValue<ChainOption>) => {
    if (selected) {
      setSelectedNetwork(selected);
      const newNetwork = (viemChains as any)[selected.value];
      setTargetNetwork(newNetwork);
    }
  };

  const isERC20Contract = (abi: any[]) => {
    const requiredMethods = [
      'transfer',
      'balanceOf',
      'totalSupply',
      'approve',
      'allowance'
    ];
    
    const abiMethods = abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    return requiredMethods.every(method => 
      abiMethods.includes(method)
    );
  };

  const isERC721Contract = (abi: any[]) => {
    const requiredMethods = [
      'balanceOf',
      'ownerOf',
      'transferFrom',
      'approve',
      'setApprovalForAll'
    ];
    
    const abiMethods = abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    return requiredMethods.every(method => 
      abiMethods.includes(method)
    );
  };

  const isBridgeContract = (abi: any[]) => {
    // Check for common bridge functions and events
    const bridgeIndicators = [
      'depositV3',
      'deposit',
      'relayMessage',
      'relayTokens',
      'l2GasPrice',
      'l1Inbox',
      'MessageRelayed',
      'TokensRelayed',
      'FundsDeposited',
      'FilledRelay'
    ];
    
    const abiElements = abi.map(item => 
      item.type === 'function' || item.type === 'event' ? item.name : ''
    );
    
    // If the ABI contains several of these indicators, it's likely a bridge
    const matchCount = bridgeIndicators.filter(indicator => 
      abiElements.includes(indicator)
    ).length;

    // Consider it a bridge if it matches 2 or more indicators
    return matchCount >= 2;
  };

  // Add this function to detect wrappable tokens
  const isWrappableToken = (abi: any[]): boolean => {
    // Check for WETH (has deposit and withdraw functions)
    const isWETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'deposit' &&
        item.stateMutability === 'payable'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'withdraw'
    );

    // Check for wstETH (has wrap and unwrap functions)
    const isWstETH = abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'wrap'
    ) && abi.some(
      (item: any) => 
        item.type === 'function' && 
        item.name === 'unwrap'
    );

    return isWETH || isWstETH;
  };

  const handleReadWrite = async () => {
    if (!address) {
      setIsAddressEmpty(true);
      return;
    }

    setIsLoading(true);

    let parsedAbi;
    try {
      parsedAbi = JSON.parse(abi);
    } catch (error) {
      console.error('Invalid ABI:', error);
      setIsAbiInvalid(true);
      setIsLoading(false);
      return;
    }

    const formattedAddress = address as `0x${string}`;
    
    try {
      // Check contract type
      const isUniversalRouter = parsedAbi.some(
        (item: any) => 
          item.type === 'function' && 
          item.name === 'execute' &&
          item.inputs.some((input: any) => input.type === 'bytes')
      );

      const isBridge = isBridgeContract(parsedAbi);
      const isWrappable = isWrappableToken(parsedAbi);
      const isERC20 = isERC20Contract(parsedAbi);
      const isERC721 = isERC721Contract(parsedAbi);

      // Get the network ID from the selected network
      const selectedChain = (viemChains as any)[selectedNetwork.value];
      if (!selectedChain || !selectedChain.id) {
        throw new Error(`Invalid network selected: ${selectedNetwork.value}`);
      }
      const networkId = selectedChain.id;
      
      // Set the target network
      setTargetNetwork(selectedChain);
      
      // Create the contract update
      const contractUpdate: GenericContractsDeclaration = {
        [networkId]: {
          "YourContract": {
            address: formattedAddress,
            abi: parsedAbi,
            inheritedFunctions: {}
          }
        }
      };

      // Set the contracts in the store
      await setContracts(contractUpdate);
      
      // Wait for the state to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get all contracts and verify the contract was set
      const allContracts = getAllContracts();
      console.log("All contracts after setting:", allContracts);
      
      // Check if the contract exists for the selected network
      if (!allContracts[networkId] || !allContracts[networkId]["YourContract"]) {
        console.error("Contract not found for network ID:", networkId);
        console.error("Available contracts:", allContracts);
        throw new Error("Contract not set properly for the selected network");
      }
      
      setIsContractLoaded(true);
      setShowTableView(true);
      setShowTutorial(false);

      // Set the appropriate interface based on contract type
      if (isWrappable) {
        setContractInterface('wrap');
        notification.success("Wrapped token contract detected!");
      } else if (isBridge) {
        setContractInterface('bridge');
        notification.success("Bridge contract detected!");
      } else if (isUniversalRouter) {
        setContractInterface('swap');
        notification.success("Router contract detected!");
      } else if (isERC20) {
        setContractInterface('erc20');
        notification.success("ERC20 token contract detected!");
      } else if (isERC721) {
        setContractInterface('nft');
        notification.success("NFT contract detected!");
      } else {
        setContractInterface('readwrite');
        notification.success("Contract loaded successfully!");
      }

    } catch (error) {
      console.error('Error:', error);
      notification.error('Error setting contract: ' + (error as Error).message);
      setContractInterface(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to render syntax highlighted JSON
  const renderSyntaxHighlightedJson = (json: string) => {
    if (!json) return '';
    
    // Simple syntax highlighting
    return json
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'text-blue-400'; // strings
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-purple-400'; // keys
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-green-400'; // booleans
        } else if (/null/.test(match)) {
          cls = 'text-red-400'; // null
        } else {
          cls = 'text-yellow-400'; // numbers
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/[{}\[\]]/g, (match) => {
        return `<span class="text-gray-300">${match}</span>`;
      })
      .replace(/,/g, '<span class="text-gray-300">,</span>');
  };

  console.log("Chain Names:", chainInfo.chains.map(c => c.name));
  console.log("Chain IDs:", chainInfo.chains.map(c => c.id));

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center py-10">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">Interact with</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            EVM Smart Contract
          </span>
        </h1>
        <p className="text-lg text-gray-300">
          Input your{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            smart contract address
          </code>{" "}
          and the designated{" "}
          <code className="italic bg-gray-800 text-blue-400 font-bold max-w-full break-words inline-block px-2 py-1 rounded">
            abi(application binary interface)
          </code>
        </p>
      </div>

      <div className="flex flex-col md:flex-row flex-grow px-4 pb-10 gap-6">
        {/* Left Column - Contract Input Form */}
        <div className="md:w-1/2">
          <div className="w-full mb-4">
        <label htmlFor="networkSelector" className="block text-sm font-medium text-gray-300 mb-2">
          Select Network:
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

      <input
        type="text"
        value={address}
        onChange={handleAddressChange}
        placeholder="Enter Smart Contract Address"
            className={`w-full my-4 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
          ${!isValidAddress ? 'border-red-500' : 'border-gray-700'}
          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
          ${!isValidAddress ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
      />

          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="abiInput" className="block text-sm font-medium text-gray-300">
                Contract ABI (JSON format):
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => { setShowTableView(false); setShowTutorial(true); }}
                  className={`p-1.5 rounded-md ${!showTableView ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="JSON View"
                >
                  <CodeBracketIcon className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => { 
                    if (parsedAbi.length > 0) {
                      setShowTableView(true); 
                      setShowTutorial(false); 
                    }
                  }}
                  className={`p-1.5 rounded-md ${showTableView ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="Table View"
                >
                  <TableCellsIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

      <textarea
              id="abiInput"
        value={abi}
        onChange={handleAbiChange}
        placeholder="Enter Contract ABI (JSON format)"
              className={`w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border 
          ${!isValidAbi ? 'border-red-500' : 'border-gray-700'}
          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 
          ${!isValidAbi ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        rows={8}
              style={{ fontFamily: 'monospace' }}
            />
            
            {isAbiInvalid && (
              <p className="mt-1 text-sm text-red-500">
                Invalid JSON format. Please check your ABI.
              </p>
            )}
          </div>

      <button
        onClick={handleReadWrite}
        disabled={!isValidAddress || !isValidAbi || !address || !abi || isLoading}
            className={`w-full px-6 py-3 rounded-xl shadow-lg transition-all duration-200 relative mb-4
          ${(!isValidAddress || !isValidAbi || !address || !abi || isLoading)
            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
          } font-medium`}
      >
        <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          Load Contract
        </span>
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </button>
          
          {/* ABI Table View */}
          {showTableView && parsedAbi.length > 0 && (
            <div className="border border-gray-700 rounded-xl bg-gray-800/50 backdrop-blur-sm overflow-auto max-h-[500px] mb-4">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Inputs</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Outputs</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">State Mutability</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                  {parsedAbi.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-700/50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-400">{item.type}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-purple-400">{item.name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        {item.inputs?.map((input: any, i: number) => (
                          <div key={i} className="mb-1">
                            <span className="text-yellow-400">{input.type}</span>
                            {input.name && <span className="text-gray-400"> {input.name}</span>}
                          </div>
                        )) || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-300">
                        {item.outputs?.map((output: any, i: number) => (
                          <div key={i} className="mb-1">
                            <span className="text-green-400">{output.type}</span>
                            {output.name && <span className="text-gray-400"> {output.name}</span>}
                          </div>
                        )) || '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {item.stateMutability ? (
                          <span className={`
                            ${item.stateMutability === 'view' || item.stateMutability === 'pure' ? 'text-blue-400' : ''}
                            ${item.stateMutability === 'nonpayable' ? 'text-yellow-400' : ''}
                            ${item.stateMutability === 'payable' ? 'text-red-400' : ''}
                          `}>
                            {item.stateMutability}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column - Tutorial or Contract Interface */}
        <div className="md:w-1/2">
          {contractInterface ? (
            <div className="border border-gray-700 rounded-xl bg-gray-800/50 backdrop-blur-sm overflow-auto">
              <Suspense fallback={
                <div className="p-6 text-center">
                  <div className="flex justify-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <p className="mt-2">Loading contract interface...</p>
                </div>
              }>
                {contractInterface === 'erc20' && <ERC20Interface />}
                {contractInterface === 'nft' && <NFTInterface />}
                {contractInterface === 'wrap' && <WrapInterface />}
                {contractInterface === 'bridge' && <BridgeInterface />}
                {contractInterface === 'readwrite' && <ReadWriteInterface />}
              </Suspense>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 h-full overflow-auto">
              <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
                Getting Started
              </h2>
              
              <div className="space-y-4 text-gray-300">
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">What is this tool?</h3>
                  <p>
                    This interface allows you to interact with any smart contract on EVM-compatible blockchains.
                    Simply input the contract address and ABI to access read and write functions.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">How to use:</h3>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Select the appropriate network from the dropdown</li>
                    <li>Enter the smart contract address</li>
                    <li>Paste the contract ABI (JSON format)</li>
                    <li>Click "Load Contract" to interact with the contract</li>
                  </ol>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Contract types supported:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><span className="font-medium">ERC-20 tokens</span> - For standard fungible tokens</li>
                    <li><span className="font-medium">ERC-721 NFTs</span> - For non-fungible tokens</li>
                    <li><span className="font-medium">Wrapped tokens</span> - For WETH, wstETH, and similar contracts</li>
                    <li><span className="font-medium">Bridge contracts</span> - For cross-chain interactions</li>
                    <li><span className="font-medium">Universal Router</span> - For complex swap workflows</li>
                    <li><span className="font-medium">General contracts</span> - Any other EVM contract</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Where to find contract ABI?</h3>
                  <p>
                    You can find contract ABIs on:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Etherscan (verified contracts)</li>
                    <li>Project documentation or GitHub repositories</li>
                    <li>Directly from smart contract developers</li>
                  </ul>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">Need to deploy a contract?</h3>
                  <p className="mb-4">
                    If you need to deploy a smart contract instead of interacting with an existing one:
                  </p>
                  <Link 
                    href="/deploy" 
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white text-sm font-medium transition-all duration-200"
                  >
                    Go to Contract Deployment →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional: Add a loading overlay for the entire page */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl shadow-xl border border-gray-800">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-white">Loading Contract Interface...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;