import React, { useState } from 'react';
import { useBatchStore, executeBatch } from './batchReducer';
import { usePorto } from '@/utils/porto';

/**
 * A reusable panel component that displays the current batch operations
 * and provides controls to manage them.
 */
export const BatchPanel: React.FC = () => {
  const { operations, isLoading, showPanel, removeOperation, clearOperations, togglePanel } = useBatchStore();
  const { isAvailable: isPortoAvailable } = usePorto();
  
  if (!showPanel || operations.length === 0) {
    return null;
  }

  const handleExecute = async () => {
    try {
      await executeBatch();
      // Note: This won't actually be reached unless executeBatch doesn't clear operations
      // because the component will unmount when operations are cleared
    } catch (error) {
      console.error('Failed to execute batch:', error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 w-80 bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Batch Operations</h2>
        <div className="flex space-x-2">
          <button
            onClick={clearOperations}
            disabled={isLoading}
            className={`py-1 px-2 rounded text-xs ${isLoading ? 'bg-gray-700 text-gray-500' : 'bg-red-600 hover:bg-red-700'}`}
          >
            Clear
          </button>
          <button
            onClick={handleExecute}
            disabled={isLoading}
            className={`py-1 px-2 rounded text-xs ${isLoading ? 'bg-gray-700 text-gray-500' : 'bg-green-600 hover:bg-green-700'} relative`}
          >
            <span className={isLoading ? 'opacity-0' : 'opacity-100'}>
              Execute
            </span>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </button>
          <button 
            onClick={() => togglePanel(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* EIP-7702 Info Banner with Porto support */}
      <div className="text-xs mb-2 p-1 rounded bg-blue-900/50 text-blue-300">
        <span className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isPortoAvailable ? (
            "Porto wallet detected! Using single signature batch"
          ) : (
            "Using EIP-7702 single signature batch"
          )}
        </span>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {operations.map((op, index) => (
          <div key={index} className="flex justify-between items-center bg-gray-700 p-2 rounded text-xs">
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center space-x-2">
                <span className={`px-1 py-0.5 rounded text-xs ${getInterfaceColor(op.interfaceType)}`}>
                  {op.interfaceType}
                </span>
                <span className="truncate">{op.description}</span>
              </div>
            </div>
            <button
              onClick={() => removeOperation(index)}
              disabled={isLoading}
              className="text-red-400 hover:text-red-300 ml-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      
      {/* Add EIP-7702 and Porto explanation at the bottom */}
      <div className="mt-2 text-xs text-gray-400 border-t border-gray-700 pt-2">
        <p>
          {isPortoAvailable ? (
            "Porto wallet supports atomic batches via EIP-7702, allowing multiple transactions with a single signature."
          ) : (
            "EIP-7702 enables executing multiple transactions with a single signature. We'll try Porto wallet first or fall back to sequential transactions if needed."
          )}
        </p>
      </div>
    </div>
  );
};

/**
 * Get a color for the interface type badge
 */
function getInterfaceColor(interfaceType: string): string {
  switch (interfaceType) {
    case 'erc20':
      return 'bg-blue-600';
    case 'erc721':
      return 'bg-purple-600';
    case 'universalRouter':
      return 'bg-green-600';
    case 'bridge':
      return 'bg-indigo-600';
    case 'liquidityPool':
      return 'bg-pink-600';
    case 'positionManager':
      return 'bg-cyan-600';
    case 'wrappableToken':
      return 'bg-yellow-600';
    case 'readwrite':
      return 'bg-gray-600';
    default:
      return 'bg-gray-600';
  }
} 