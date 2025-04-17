import React from 'react'
import { QueryProvider } from '../providers/QueryProvider'
import { WebAuthnBatchDemo } from '../components/WebAuthnBatchDemo'

export default function WebAuthnDemoPage() {
  return (
    <QueryProvider>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">WebAuthn + EIP-7702 Integration</h1>
        <p className="mb-6">
          This demo shows how to use WebAuthn credentials with EIP-7702 for batch transactions.
          WebAuthn allows for passwordless authentication using biometrics or security keys,
          while EIP-7702 enables EOAs to execute multiple transactions in a single atomic operation.
        </p>
        
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-8">
          <p className="text-yellow-700">
            <strong>Note:</strong> This demo requires a browser and wallet that support both WebAuthn
            and EIP-7702. Not all wallets currently support these features.
          </p>
        </div>
        
        <WebAuthnBatchDemo />
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>WebAuthn Initialization:</strong> Create or import a passkey that will be used
              to authenticate and sign your transactions.
            </li>
            <li>
              <strong>Batch Operations:</strong> Add operations to a batch that you want to execute
              as a single transaction.
            </li>
            <li>
              <strong>WebAuthn Authentication:</strong> When executing the batch, your browser will
              prompt you to verify your identity using your device's biometrics or security key.
            </li>
            <li>
              <strong>EIP-7702 Execution:</strong> The batch is executed as a single transaction,
              reducing gas costs and improving user experience.
            </li>
          </ol>
        </div>
      </div>
    </QueryProvider>
  )
} 