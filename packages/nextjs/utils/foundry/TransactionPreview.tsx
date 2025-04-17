import React, { useState, useEffect } from 'react';
import { BatchOperation } from '../../types/batch';
import { extractRawTransactionData, decodeTransactionData } from './index';

interface TransactionPreviewProps {
  operations: BatchOperation[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const TransactionPreview: React.FC<TransactionPreviewProps> = ({
  operations,
  isOpen,
  onClose,
  onConfirm,
  isLoading
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [decodedOperations, setDecodedOperations] = useState<Array<{ 
    functionName: string; 
    params: Record<string, any> 
  } | null>>([]);

  const { rawTransactions, totalGasEstimate, totalValue } = extractRawTransactionData(operations);

  // Decode transaction data when component is mounted
  useEffect(() => {
    const decodeData = async () => {
      const decoded = await Promise.all(
        operations.map(async (op) => {
          try {
            return await decodeTransactionData(op);
          } catch (error) {
            console.error('Failed to decode operation:', error);
            return null;
          }
        })
      );
      setDecodedOperations(decoded);
    };

    if (isOpen && operations.length > 0) {
      decodeData();
    }
  }, [isOpen, operations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Confirm Transactions</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-grow">
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center text-sm text-gray-300 mb-2">
              <span>Total Transactions:</span>
              <span className="font-medium text-white">{operations.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-300 mb-2">
              <span>Estimated Gas:</span>
              <span className="font-medium text-white">{totalGasEstimate}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-300">
              <span>Total Value:</span>
              <span className="font-medium text-white">{totalValue}</span>
            </div>
          </div>

          <h4 className="font-medium text-gray-300 mb-2">EIP-7702 Batch Transaction</h4>
          <div className="space-y-2">
            {rawTransactions.map((tx, index) => (
              <div key={index} className="bg-gray-800 rounded-lg overflow-hidden">
                <div 
                  className="p-3 cursor-pointer flex justify-between items-center hover:bg-gray-700"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex-grow mr-2">
                    <div className="text-white font-medium truncate">{tx.description}</div>
                    <div className="text-xs text-gray-400 truncate">To: {tx.to}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-blue-400">{tx.value}</span>
                    <span className="text-gray-400 text-xs">{expandedIndex === index ? '▲' : '▼'}</span>
                  </div>
                </div>
                
                {expandedIndex === index && (
                  <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                    <div className="mb-2">
                      <div className="text-xs text-gray-400">Function:</div>
                      <div className="text-sm text-white font-mono break-all">
                        {decodedOperations[index]?.functionName || 'Unknown Function'}
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-xs text-gray-400">Raw Data:</div>
                      <div className="text-xs text-white font-mono break-all bg-gray-900 p-2 rounded">
                        {tx.data}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 flex items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </>
            ) : (
              'Sign & Execute'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 