import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ConnectWallet() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main app
    router.push('/');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="mb-4">
          This page is no longer needed. The app now uses AppKit for wallet connections.
        </p>
        <div className="flex gap-2 justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
} 