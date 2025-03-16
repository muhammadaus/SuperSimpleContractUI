'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { createWalletClient, custom, Address } from 'viem';
import { useTargetNetwork } from '../../../../hooks/scaffold-eth/useTargetNetwork';
import { connectWallet, getWalletMetadata, switchNetwork } from '../../../../utils/scaffold-eth/walletUtils';

// Add window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function QRActionPage() {
  const router = useRouter();
  const params = useParams<{ action: string; sessionId: string }>();
  const searchParams = useSearchParams();
  const { targetNetwork } = useTargetNetwork();
  
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ name?: string; agent?: string }>({});
  
  const action = params?.action || '';
  const sessionId = params?.sessionId || '';
  const chainId = searchParams?.get('chainId') || '';
  
  // Connect wallet on page load
  useEffect(() => {
    const handleWalletConnection = async () => {
      try {
        // Check if wallet is available
        if (!window.ethereum) {
          setStatus('error');
          setError('No Ethereum wallet detected. Please install MetaMask or another wallet. If you are on mobile, please open this link in your wallet\'s browser.');
          return;
        }
        
        // Get wallet metadata
        const metadata = getWalletMetadata();
        if (metadata) {
          setWalletInfo({
            name: metadata.name,
            agent: metadata.agent
          });
          console.log('Detected wallet:', metadata.name, metadata.agent);
        }
        
        // Connect wallet
        const walletAddress = await connectWallet();
        if (!walletAddress) {
          setStatus('error');
          setError('Failed to connect wallet. Please try again.');
          return;
        }
        
        setAddress(walletAddress);
        setIsConnected(true);
        
        // Switch network if needed
        if (chainId) {
          const chainIdNumber = parseInt(chainId);
          if (!isNaN(chainIdNumber)) {
            const switched = await switchNetwork(chainIdNumber);
            if (!switched) {
              console.warn(`Could not switch to network with chainId ${chainId}`);
            }
          }
        }
        
        // Continue with the action handling
        await handleAction(walletAddress);
      } catch (err) {
        console.error("Error connecting wallet:", err);
        setStatus('error');
        setError(`Failed to connect wallet: ${(err as Error).message}`);
      }
    };
    
    handleWalletConnection();
  }, [chainId, action, sessionId]);
  
  const handleAction = async (walletAddress: string) => {
    try {
      if (!walletAddress) {
        setStatus('error');
        setError('Please connect your wallet first');
        return;
      }
      
      if (action === 'connect') {
        // Update connection status
        const response = await fetch('/api/connection-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            status: 'connected',
            walletAddress,
            walletInfo: walletInfo
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update connection status');
        }
        
        setStatus('connected');
      } else if (action === 'transaction') {
        // Get transaction data
        const txDataResponse = await fetch(`/api/transaction-data?sessionId=${sessionId}`);
        
        if (!txDataResponse.ok) {
          throw new Error('Failed to get transaction data');
        }
        
        const txData = await txDataResponse.json();
        console.log('Transaction data:', txData);
        
        // Process transaction with the connected wallet
        try {
          // Create a wallet client
          const walletClient = createWalletClient({
            account: walletAddress as Address,
            transport: custom(window.ethereum),
            chain: targetNetwork
          });
          
          // Send the transaction
          const hash = await walletClient.sendTransaction({
            to: txData.to as Address,
            data: txData.data,
            value: txData.value ? BigInt(txData.value) : undefined,
            chain: targetNetwork
          });
          
          console.log('Transaction sent:', hash);
          
          // Update transaction status to completed
          const statusResponse = await fetch('/api/transaction-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId,
              status: 'completed',
              transactionHash: hash,
              walletInfo: walletInfo
            }),
          });
          
          if (!statusResponse.ok) {
            throw new Error('Failed to update transaction status');
          }
          
          setStatus('connected');
        } catch (txError) {
          console.error('Transaction error:', txError);
          throw new Error(`Transaction failed: ${(txError as Error).message}`);
        }
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
    } catch (err) {
      console.error('Error handling QR action:', err);
      setStatus('error');
      setError((err as Error).message);
      
      // Update transaction status to failed if it's a transaction
      if (action === 'transaction') {
        fetch('/api/transaction-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            status: 'failed',
            error: (err as Error).message,
            walletInfo: walletInfo
          }),
        }).catch(console.error);
      }
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-md p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {action === 'connect' ? 'Wallet Connection' : 'Transaction Request'}
        </h1>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-gray-300">Processing your request...</p>
          </div>
        )}
        
        {status === 'connected' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Success!</h2>
            <p className="text-gray-300 text-center">
              {action === 'connect' 
                ? 'Your wallet has been connected successfully. You can close this page and return to the application.'
                : 'Your transaction has been submitted successfully. You can close this page and return to the application.'}
            </p>
            {address && (
              <div className="mt-4 text-center">
                <p className="text-gray-400 text-sm">
                  Connected address: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
                {walletInfo.name && (
                  <p className="text-gray-500 text-xs mt-1">
                    Wallet: {walletInfo.name}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-gray-300 text-center">{error || 'An unknown error occurred'}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 