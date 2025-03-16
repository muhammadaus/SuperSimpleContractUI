"use client";

import React from 'react';
import { AppKitWallet } from '../../components/scaffold-eth/AppKitWallet';

export default function WalletConnectPage() {
  return (
    <div className="flex flex-col items-center flex-grow pt-10 w-full px-4 min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">WalletConnect</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Integration
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Connect your wallet using WalletConnect
        </p>
      </div>

      <div className="w-full max-w-md mt-8">
        <AppKitWallet />
      </div>

      <div className="w-full max-w-md mt-6 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          How It Works
        </h2>
        
        <ol className="list-decimal pl-5 space-y-2 text-gray-300">
          <li>Click the "Connect Wallet" button above</li>
          <li>Choose your preferred wallet from the modal</li>
          <li>Follow the wallet's instructions to connect</li>
          <li>Your wallet address will appear above when connected</li>
          <li>Use the wallet actions to interact with the blockchain</li>
        </ol>
      </div>
    </div>
  );
} 