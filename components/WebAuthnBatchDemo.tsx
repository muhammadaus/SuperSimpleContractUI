import React, { useState } from 'react'
import { Account } from '../modules/Account'
import { client } from '../config'
import { useBatchStore } from '../utils/batch/store'

// Mock executeBatch function since we don't have access to the actual implementation
const executeBatch = async () => {
  console.log('Executing batch operations...')
  
  // Simulate checking for WebAuthn capabilities
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      // Get current account
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[]
      
      if (accounts.length === 0) {
        throw new Error('No accounts available')
      }
      
      // Check if WebAuthn is supported
      try {
        const capabilities = await window.ethereum.request({
          method: 'wallet_getCapabilities'
        }).catch(() => ({}))
        
        const hasWebAuthn = capabilities && (
          capabilities.webauthn || 
          capabilities.eip7702 || 
          capabilities.signWithCredential
        )
        
        if (hasWebAuthn) {
          console.log('WebAuthn supported, attempting batch execution...')
          // In a real implementation, we would call WebAuthn methods here
          // For the demo, we'll just simulate success
          return Promise.resolve(true)
        } else {
          console.log('WebAuthn not supported, falling back...')
        }
      } catch (error) {
        console.warn('Failed to check wallet capabilities:', error)
      }
      
      // Simulate regular transaction execution
      console.log('Executing transactions sequentially...')
      return Promise.resolve(true)
    } catch (error) {
      console.error('Execution error:', error)
      throw error
    }
  } else {
    throw new Error('Browser environment or Ethereum provider not available')
  }
}

export function WebAuthnBatchDemo() {
  const { data: account } = Account.useQuery()
  const { data: hash, ...createMutation } = Account.useCreate({ client })
  const loadMutation = Account.useLoad({ client })
  const [executionStatus, setExecutionStatus] = useState<string | null>(null)
  
  // Get batch operations from store
  const { operations, addOperation, clearOperations, loading } = useBatchStore()

  // Handle batch execution
  const handleExecuteBatch = async () => {
    setExecutionStatus('Executing batch operations...')
    try {
      await executeBatch()
      setExecutionStatus('Batch execution completed successfully!')
    } catch (error) {
      console.error('Batch execution failed:', error)
      setExecutionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Add a sample operation to the batch
  const addSampleOperation = () => {
    // Example token transfer operation - replace with your actual contract address and data
    addOperation({
      to: '0x1234567890123456789012345678901234567890',
      data: '0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      value: '0'
    })
  }
  
  const isPending = createMutation.isPending || loadMutation.isPending || loading
  const error = createMutation.error || loadMutation.error

  return (
    <div className="p-6 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">WebAuthn + EIP-7702 Batch Demo</h2>
      
      {!account ? (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">1. Initialize WebAuthn Account</h3>
          <p className="mb-4">Create a new WebAuthn key or import an existing one:</p>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              disabled={isPending}
              onClick={() => createMutation.mutate()}
            >
              Create Passkey
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              disabled={isPending}
              onClick={() => loadMutation.mutate()}
            >
              Import Passkey
            </button>
          </div>
          {hash && (
            <p className="mt-2">
              Account created!{' '}
              <a
                href={`${client.chain.blockExplorers.default.url}/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                View on Explorer
              </a>
            </p>
          )}
          {error && <p className="mt-2 text-red-600">{error instanceof Error ? error.message : String(error)}</p>}
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">WebAuthn Account Connected</h3>
            <p><strong>Address:</strong> {account.address}</p>
            <p><strong>WebAuthn Supported:</strong> {account.isWebAuthn ? 'Yes' : 'No'}</p>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">2. Batch Operations</h3>
            <p className="mb-2">Current operations in batch: {operations.length}</p>
            
            <div className="flex gap-4 mb-4">
              <button 
                className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                onClick={addSampleOperation}
                disabled={isPending}
              >
                Add Sample Operation
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                onClick={clearOperations}
                disabled={isPending || operations.length === 0}
              >
                Clear Operations
              </button>
            </div>
            
            {operations.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Pending Operations:</h4>
                <ul className="space-y-2">
                  {operations.map((op, index) => (
                    <li key={index} className="p-2 bg-gray-200 rounded">
                      <p><strong>To:</strong> {op.to}</p>
                      <p><strong>Value:</strong> {op.value} ETH</p>
                      <p><strong>Data:</strong> {op.data.slice(0, 10)}...</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">3. Execute Batch with WebAuthn</h3>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              onClick={handleExecuteBatch}
              disabled={isPending || operations.length === 0}
            >
              Execute Batch
            </button>
            
            {executionStatus && (
              <p className={`mt-2 ${executionStatus.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {executionStatus}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
} 