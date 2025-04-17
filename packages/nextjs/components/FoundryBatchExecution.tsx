import React, { useState } from "react";
import { TransactionPreview } from "../utils/foundry/TransactionPreview";
import { BatchOperation } from "../types/batch";
import { useBatchStore } from "../utils/batch";
import { executeBatch } from "../utils/batch/batchReducer";
import { notification } from "../utils/scaffold-eth/notification";

interface FoundryBatchExecutionProps {
  operations: BatchOperation[];
  onComplete?: () => void;
}

const FoundryBatchExecution: React.FC<FoundryBatchExecutionProps> = ({ operations, onComplete }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setLoading } = useBatchStore();

  const handleExecute = () => {
    if (operations.length === 0) {
      notification.info("No operations to execute");
      return;
    }

    setShowPreview(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setLoading(true);
    
    try {
      await executeBatch();
      
      // After execution is complete
      if (onComplete) onComplete();
      
    } catch (error) {
      console.error("Failed to execute batch:", error);
      notification.error(`Execution failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
      setLoading(false);
      setShowPreview(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExecute}
        disabled={operations.length === 0 || isProcessing}
        className={`
          px-4 py-2 rounded-xl text-white font-medium
          ${operations.length === 0 || isProcessing 
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'}
          transition-colors
        `}
      >
        {isProcessing ? (
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Processing...
          </div>
        ) : (
          `Execute ${operations.length} Operation${operations.length !== 1 ? 's' : ''}`
        )}
      </button>

      <TransactionPreview
        operations={operations}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirm}
        isLoading={isProcessing}
      />
    </div>
  );
};

export default FoundryBatchExecution; 