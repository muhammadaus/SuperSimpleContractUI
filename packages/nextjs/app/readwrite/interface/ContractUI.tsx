import React from 'react';
import { formatEther } from 'ethers';

interface ContractUIProps {
  data: any;
}

/**
 * Component to display contract data in a nicely formatted way
 */
export const ContractUI = ({ data }: ContractUIProps) => {
  if (data === undefined || data === null) {
    return <div className="text-gray-400 italic">No data to display</div>;
  }

  // Format transaction hash
  if (data.hash && typeof data.hash === 'string') {
    return (
      <div className="bg-gray-800/50 rounded-lg p-3">
        <p className="text-sm font-semibold text-gray-300 mb-1">Transaction Hash:</p>
        <a 
          href={`https://etherscan.io/tx/${data.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-sm break-all"
        >
          {data.hash}
        </a>
      </div>
    );
  }

  // Format BigInt
  if (typeof data === 'bigint') {
    try {
      // Try to format as ether in case it's a wei value
      const etherValue = formatEther(data);
      return (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-sm font-normal text-gray-300">{data.toString()}</p>
          <p className="text-xs font-normal text-blue-400">{etherValue} ETH</p>
        </div>
      );
    } catch (e) {
      return <div className="bg-gray-800/50 rounded-lg p-3 text-sm">{data.toString()}</div>;
    }
  }

  // Format array or object
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-sm font-semibold text-gray-300 mb-1">Array ({data.length} items):</p>
          <div className="space-y-1 ml-4">
            {data.map((item, index) => (
              <div key={index} className="flex">
                <span className="text-xs text-gray-400 mr-2">{index}:</span>
                <ContractUI data={item} />
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return <div className="text-gray-400 italic">Empty object</div>;
      }
      
      return (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-sm font-semibold text-gray-300 mb-1">Object:</p>
          <div className="space-y-1 ml-4">
            {entries.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs text-gray-400">{key}:</span>
                <div className="ml-4">
                  <ContractUI data={value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Format boolean
  if (typeof data === 'boolean') {
    return (
      <div className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
        data ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
      }`}>
        {data.toString()}
      </div>
    );
  }

  // Default for strings and other primitive types
  return <div className="bg-gray-800/50 rounded-lg p-3 text-sm break-all">{String(data)}</div>;
}; 