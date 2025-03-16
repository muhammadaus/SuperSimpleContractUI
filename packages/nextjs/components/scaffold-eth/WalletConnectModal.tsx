"use client";

import React, { useState, useEffect } from 'react';
import { connectWithWalletConnect } from '../../utils/scaffold-eth/walletUtils';
import { getActiveSessions, disconnectSession } from '../../utils/scaffold-eth/walletConnectUtils';
import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (address: string) => void;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [uri, setUri] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  // Fetch active sessions
  useEffect(() => {
    if (isOpen) {
      fetchActiveSessions();
    }
  }, [isOpen]);

  const fetchActiveSessions = async () => {
    try {
      const sessions = await getActiveSessions();
      setActiveSessions(Object.values(sessions || {}));
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

  const handleConnect = async () => {
    if (!uri) {
      setError('Please enter a WalletConnect URI');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await connectWithWalletConnect(uri);
      // The actual connection will be handled by the session_proposal event
      // We'll close the modal and let the event handler take care of the rest
      onClose();
    } catch (error) {
      console.error('Error connecting with WalletConnect:', error);
      setError((error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (topic: string) => {
    try {
      await disconnectSession(topic);
      await fetchActiveSessions();
    } catch (error) {
      console.error('Error disconnecting session:', error);
      setError((error as Error).message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">WalletConnect</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 p-4 rounded-lg mb-4">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-sm text-gray-300 mt-2">{error}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            WalletConnect URI
          </label>
          <input
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="wc:..."
            className="w-full p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Paste the WalletConnect URI from your dapp
          </p>
        </div>

        <button
          onClick={handleConnect}
          disabled={!uri || isConnecting}
          className={`w-full p-3 rounded-xl shadow-lg transition-all duration-200 relative
            ${!uri || isConnecting
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            } font-medium`}
        >
          <span className={`${isConnecting ? 'opacity-0' : 'opacity-100'}`}>
            Connect
          </span>
          
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </button>

        {activeSessions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Active Sessions</h3>
            <div className="space-y-2">
              {activeSessions.map((session: any) => (
                <div key={session.topic} className="p-3 rounded-lg bg-gray-700/50 border border-gray-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-white">{session.peer.metadata?.name || 'Unknown App'}</p>
                      <p className="text-xs text-gray-400">{session.peer.metadata?.url || 'No URL'}</p>
                    </div>
                    <button
                      onClick={() => handleDisconnect(session.topic)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 