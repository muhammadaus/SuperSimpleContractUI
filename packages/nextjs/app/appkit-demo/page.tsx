"use client";

import React from 'react';
import { AppKitWallet } from '../../components/scaffold-eth/AppKitWallet';

export default function AppKitDemoPage() {
  return (
    <div className="flex flex-col items-center flex-grow pt-10 w-full px-4 min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center">
        <h1>
          <span className="block text-2xl mb-2 text-gray-300">AppKit</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Demo
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Explore the features of WalletConnect AppKit
        </p>
      </div>

      {/* Connection Section */}
      <div className="w-full max-w-md mt-8">
        <AppKitWallet />
      </div>

      {/* Network Section */}
      <div className="w-full max-w-md mt-6 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Network Selection
        </h2>
        
        <p className="text-sm text-gray-300 mb-4">
          Switch between different networks using the AppKit network button.
        </p>
        
        <div className="flex justify-center">
          <appkit-network-button></appkit-network-button>
        </div>
      </div>

      {/* Account Section */}
      <div className="w-full max-w-md mt-6 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          Account Management
        </h2>
        
        <p className="text-sm text-gray-300 mb-4">
          Manage your connected account using the AppKit account button.
        </p>
        
        <div className="flex justify-center">
          <appkit-account-button></appkit-account-button>
        </div>
      </div>

      {/* Information Section */}
      <div className="w-full max-w-md mt-6 mb-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          How It Works
        </h2>
        
        <p className="text-sm text-gray-300 mb-4">
          AppKit provides a simple way to integrate WalletConnect into your application. It handles:
        </p>
        
        <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm">
          <li>Wallet connection and management</li>
          <li>Network switching</li>
          <li>Transaction signing</li>
          <li>Message signing</li>
          <li>Account management</li>
        </ul>
        
        <div className="mt-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-200 text-sm">
          <p className="font-semibold mb-1">Note:</p>
          <p>
            Make sure to set your WalletConnect Project ID in the environment variables.
            Get one at <a href="https://cloud.walletconnect.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">cloud.walletconnect.com</a>
          </p>
        </div>
      </div>
    </div>
  );
} 