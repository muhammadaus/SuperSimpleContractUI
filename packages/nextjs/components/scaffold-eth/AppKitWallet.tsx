"use client";

import React from 'react';
import { 
  useAppKitAccount, 
  useAppKitNetwork, 
  useAppKitState,
  useDisconnect,
  useAppKit
} from '@reown/appkit/react';

export const AppKitWallet: React.FC = () => {
  // AppKit hooks
  const { isConnected, address, caipAddress } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const state = useAppKitState();

  return (
    <div className="w-full max-w-md p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
      <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
        Wallet Integration
      </h2>

      {/* Connection Status */}
      <div className="p-4 rounded-lg bg-gray-700/50 mb-4">
        <div className="flex items-center mb-2">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-white">
            {isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        
        {address && (
          <div className="mt-2">
            <p className="text-sm text-gray-300">Address:</p>
            <p className="text-xs font-mono text-gray-300 break-all">{address}</p>
          </div>
        )}
        
        {caipAddress && (
          <div className="mt-2">
            <p className="text-sm text-gray-300">CAIP Address:</p>
            <p className="text-xs font-mono text-gray-300 break-all">{caipAddress}</p>
          </div>
        )}
        
        {chainId && (
          <div className="mt-2">
            <p className="text-sm text-gray-300">Chain ID: {chainId}</p>
          </div>
        )}
      </div>

      {/* Wallet Actions */}
      <div className="space-y-2">
        {!isConnected ? (
          <button
            onClick={() => open()}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="flex justify-center">
              <appkit-button></appkit-button>
            </div>
            
            <button
              onClick={() => disconnect()}
              className="w-full mt-2 p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}; 