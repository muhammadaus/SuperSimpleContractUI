import React, { useState, useEffect } from "react";
import Head from "next/head";
import { executeBatch, useBatchStore } from "../utils/batch";
import { Address } from "../components/scaffold-eth";
// import { importPorto } from "../utils/porto";
// import { Hooks } from 'porto/wagmi';
import type { BaseError } from 'viem';

// Simple spinner component
const Spinner = () => (
  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
);

// Porto/WebAuthn InitializeAccount component - Commented out for now
/*
function InitializeAccount({
  onAccountCreated,
  onError,
}: {
  onAccountCreated: (address: string) => void;
  onError: (error: Error) => void;
}) {
  const label = `exp-webauthn-${Math.floor(Date.now() / 1000)}`;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleConnect = async (createNew = false) => {
    setIsPending(true);
    setError(null);
    
    try {
      // Import Porto
      const Porto = await importPorto();
      if (!Porto) {
        throw new Error('Porto wallet not available');
      }
      
      // Initialize Porto
      const porto = Porto.create();
      
      // Connect to Porto wallet with WebAuthn capability request
      console.info(`${createNew ? 'Creating new account' : 'Connecting'} with Porto wallet...`);
      const { accounts } = await porto.provider.request({ 
        method: 'wallet_connect',
        params: [{
          capabilities: {
            webauthn: true,
            atomicBatch: true
          },
          ...(createNew ? { createAccount: { label } } : {})
        }]
      });
      
      if (!accounts || accounts.length === 0 || !accounts[0]?.address) {
        throw new Error('No accounts returned from Porto wallet');
      }
      
      // Log the capabilities to help with debugging
      console.info('Porto account capabilities:', accounts[0]?.capabilities);
      
      const userAddress = accounts[0].address;
      console.info(`Connected to Porto wallet with address: ${userAddress}`);
      
      // Check if the account has WebAuthn capability
      if (accounts[0]?.capabilities?.webauthn) {
        onAccountCreated(userAddress);
      } else {
        throw new Error('WebAuthn capability not available for this account');
      }
    } catch (err) {
      console.error('Error connecting with Porto:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <button 
          className="btn btn-secondary"
          disabled={isPending}
          onClick={() => handleConnect(true)}
        >
          {isPending ? (
            <>
              <Spinner /> Creating Account...
            </>
          ) : (
            "Register New Account"
          )}
        </button>
        <button 
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => handleConnect(false)}
        >
          {isPending ? (
            <>
              <Spinner /> Connecting...
            </>
          ) : (
            "Sign In with Porto"
          )}
        </button>
      </div>
      
      {error && (
        <div className="text-error mt-2">
          {(error as BaseError).shortMessage || error.message}
        </div>
      )}
    </div>
  );
}
*/

export default function WebAuthnPage() {
  const [webAuthnStatus, setWebAuthnStatus] = useState<"uninitialized" | "initializing" | "initialized" | "error">("uninitialized");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isCreatingCredential, setIsCreatingCredential] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { operations, addOperation, clearOperations, isLoading, setLoading } = useBatchStore();
  const [balance, setBalance] = useState<{ formatted: string; symbol: string } | null>(null);
  const [providerReady, setProviderReady] = useState<boolean>(false);
  // const [portoAvailable, setPortoAvailable] = useState<boolean | null>(null);

  // Check if browser supports WebAuthn
  const [browserSupportsWebAuthn, setBrowserSupportsWebAuthn] = useState<boolean | null>(null);

  // Check if Porto wallet is available - Commented out
  /*
  useEffect(() => {
    const checkPorto = async () => {
      try {
        const isAvailable = await importPorto().then(porto => !!porto);
        setPortoAvailable(isAvailable);
        console.log(`Porto wallet is ${isAvailable ? 'available' : 'not available'}`);
      } catch (error) {
        console.error("Error checking Porto availability:", error);
        setPortoAvailable(false);
      }
    };
    
    checkPorto();
  }, []);
  */

  useEffect(() => {
    // Check browser WebAuthn support
    if (typeof window !== 'undefined') {
      const hasWebAuthnSupport = 
        window.PublicKeyCredential !== undefined && 
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
      
      setBrowserSupportsWebAuthn(hasWebAuthnSupport);
      
      if (!hasWebAuthnSupport) {
        console.warn("This browser doesn't support WebAuthn");
      }
    }
  }, []);

  // Check ethereum provider
  useEffect(() => {
    const checkProvider = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Get connected accounts
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          }) as string[];
          
          if (accounts && accounts.length > 0) {
            setAccountAddress(accounts[0]);
            
            // Check for WebAuthn capabilities
            try {
              const capabilities = await window.ethereum.request({
                method: 'wallet_getCapabilities'
              }).catch(() => ({}));
              
              console.log("Wallet capabilities:", capabilities);
              
              const hasWebAuthnSupport = capabilities && (
                capabilities.webauthn || 
                capabilities.eip7702 || 
                capabilities.signWithCredential
              );
              
              if (hasWebAuthnSupport) {
                console.log("Wallet supports WebAuthn, checking for existing credentials");
                
                try {
                  // Check for existing WebAuthn credentials
                  const result = await window.ethereum.request({
                    method: 'webauthn_getCredentials',
                    params: [{}]
                  });
                  
                  if (result && result.address) {
                    console.log(`Found existing WebAuthn credential for address: ${result.address}`);
                    setWebAuthnStatus("initialized");
                  } else {
                    console.log('No existing WebAuthn credentials found');
                    setWebAuthnStatus("uninitialized");
                  }
                } catch (credError) {
                  console.warn('Failed to get WebAuthn credentials:', credError);
                  setWebAuthnStatus("uninitialized");
                }
              } else {
                console.warn("Wallet does not support WebAuthn");
                setWebAuthnStatus("error");
                setErrorMessage("Your wallet does not support WebAuthn capabilities");
              }
            } catch (error) {
              console.error("Error checking wallet capabilities:", error);
              setWebAuthnStatus("error");
              setErrorMessage("Failed to check wallet WebAuthn support");
            }
          } else {
            setProviderReady(true);
          }
          
          // Get chain ID
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chainIdHex, 16));
          
        } catch (error) {
          console.error("Error initializing provider:", error);
          setErrorMessage("Failed to initialize Ethereum provider");
        }
      } else {
        console.warn("No Ethereum provider detected");
        setErrorMessage("No Ethereum provider detected. Please install a Web3 wallet.");
      }
    };
    
    checkProvider();
  }, []);

  // Get chain ID effect
  useEffect(() => {
    const getChainId = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chainIdHex, 16));
        } catch (error) {
          console.error("Error getting chain ID:", error);
        }
      }
    };

    getChainId();

    // Setup chain changed listener
    if (typeof window !== "undefined" && window.ethereum && window.ethereum.on) {
      const handleChainChanged = (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
      };

      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  // Handle account created through Porto wallet - Commented out
  /*
  const handlePortoAccountCreated = async (address: string) => {
    setAccountAddress(address);
    setWebAuthnStatus("initialized");
    console.info(`Successfully connected with Porto wallet at address: ${address}`);
    
    // Get balance
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const balanceHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        
        const balanceInWei = parseInt(balanceHex, 16);
        const formatted = (balanceInWei / 1e18).toFixed(4);
        setBalance({ formatted, symbol: 'ETH' });
      }
    } catch (error) {
      console.error("Error getting balance:", error);
    }
  };

  // Handle Porto initialization error
  const handlePortoError = (error: Error) => {
    console.error("Porto initialization error:", error);
    setErrorMessage(error.message);
  };
  */

  // Connect to wallet
  const connectWallet = async () => {
    setIsConnecting(true);
    setErrorMessage("");
    
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("No Ethereum provider detected");
      }
      
      // Request accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }
      
      const userAddress = accounts[0];
      setAccountAddress(userAddress);
      console.info(`Connected to wallet with address: ${userAddress}`);
      
      // Check for WebAuthn capability now that we have permission
      try {
        const capabilities = await window.ethereum.request({
          method: 'wallet_getCapabilities'
        }).catch(() => ({}));
        
        console.log("Wallet capabilities after connection:", capabilities);
        
        const hasWebAuthnSupport = capabilities && (
          capabilities.webauthn || 
          capabilities.eip7702 || 
          capabilities.signWithCredential
        );
        
        if (hasWebAuthnSupport) {
          // Check for existing WebAuthn credentials
          try {
            const result = await window.ethereum.request({
              method: 'webauthn_getCredentials',
              params: [{}]
            });
            
            if (result && result.address) {
              console.log(`Found existing WebAuthn credential for address: ${result.address}`);
              setWebAuthnStatus("initialized");
            } else {
              console.log('No existing WebAuthn credentials found');
              setWebAuthnStatus("uninitialized");
            }
          } catch (credError) {
            console.warn('Failed to get WebAuthn credentials:', credError);
            setWebAuthnStatus("uninitialized");
          }
        } else {
          setWebAuthnStatus("error");
          setErrorMessage("Your wallet does not support WebAuthn capabilities");
        }
      } catch (error) {
        console.error("Error checking wallet capabilities:", error);
        setWebAuthnStatus("error");
        setErrorMessage("Failed to check wallet WebAuthn support");
      }
      
      // Get balance
      try {
        const balanceHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [userAddress, 'latest']
        });
        
        const balanceInWei = parseInt(balanceHex, 16);
        const formatted = (balanceInWei / 1e18).toFixed(4);
        setBalance({ formatted, symbol: 'ETH' });
      } catch (error) {
        console.error("Error getting balance:", error);
      }
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to initialize WebAuthn
  const initializeWebAuthn = async () => {
    setIsCreatingCredential(true);
    setWebAuthnStatus("initializing");
    setErrorMessage("");

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("Browser environment with Ethereum provider required");
      }
      
      if (!accountAddress) {
        throw new Error("Please connect your wallet first");
      }
      
      // Try to create a new WebAuthn credential
      console.info('Creating WebAuthn credential...');
      const result = await window.ethereum.request({
        method: 'webauthn_createCredential',
        params: [{
          rp: {
            name: 'WebAuthn EIP-7702 Demo',
            id: window.location.hostname
          },
          user: {
            id: `user-${Date.now()}`, // Generate a simple user ID
            name: 'EIP-7702 User',
            displayName: 'WebAuthn User'
          }
        }]
      });
      
      if (result && result.address) {
        console.info(`Created new WebAuthn credential for address: ${result.address}`);
        setWebAuthnStatus("initialized");
      } else {
        throw new Error('Failed to create WebAuthn credential');
      }
    } catch (error) {
      console.error("Error initializing WebAuthn:", error);
      setWebAuthnStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsCreatingCredential(false);
    }
  };

  // Function to add a sample operation
  const addSampleOperation = () => {
    if (!accountAddress) return;

    // Example ETH transfer operation
    addOperation({
      type: 'transfer',
      interfaceType: 'readwrite',
      to: "0x1234567890123456789012345678901234567890",
      data: "0x",
      value: "0.001",
      description: "Send 0.001 ETH"
    });
  };

  // Function to execute batch
  const handleExecuteBatch = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      await executeBatch();
    } catch (error) {
      console.error("Error executing batch:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>WebAuthn Demo</title>
        <meta name="description" content="Use WebAuthn to sign and execute batch transactions with EIP-7702" />
      </Head>

      <div className="flex flex-col items-center gap-8 p-4 py-8">
        <h1 className="text-4xl font-semibold text-center">WebAuthn + EIP-7702 Demo</h1>

        {/* Browser Compatibility Alert */}
        {browserSupportsWebAuthn === false && (
          <div className="alert alert-warning w-full max-w-3xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold">Browser Not Compatible</h3>
              <div className="text-sm">Your browser doesn't support WebAuthn. Please use a modern browser like Chrome, Edge, or Safari.</div>
            </div>
          </div>
        )}

        {/* Connection Method Selection */}
        <div className="w-full max-w-3xl p-8 bg-base-200 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Account Status</h2>
          
          {accountAddress ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2">
                <span className="font-semibold">Connected Account:</span>
                <Address address={accountAddress as `0x${string}`} />
              </p>
              {balance && (
                <p><span className="font-semibold">Balance:</span> {balance.formatted} {balance.symbol}</p>
              )}
              <p>
                <span className="font-semibold">WebAuthn Status:</span>
                {webAuthnStatus === "initialized" ? (
                  <span className="text-success ml-2">● Initialized</span>
                ) : webAuthnStatus === "initializing" ? (
                  <span className="text-warning ml-2">● Initializing...</span>
                ) : webAuthnStatus === "error" ? (
                  <span className="text-error ml-2">● Error</span>
                ) : (
                  <span className="text-warning ml-2">● Not Initialized</span>
                )}
              </p>
              
              {webAuthnStatus === "uninitialized" && browserSupportsWebAuthn && (
                <button 
                  className="btn btn-primary mt-4"
                  disabled={isCreatingCredential}
                  onClick={initializeWebAuthn}
                >
                  {isCreatingCredential ? (
                    <>
                      <Spinner /> Initializing WebAuthn...
                    </>
                  ) : (
                    "Initialize WebAuthn"
                  )}
                </button>
              )}

              {errorMessage && (
                <div className="text-error mt-2">{errorMessage}</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <p className="mb-2">Connect your wallet to use WebAuthn:</p>
              
              {/* Porto wallet integration - Commented out 
              {portoAvailable ? (
                <div className="bg-gray-800/40 p-4 rounded-lg">
                  <h3 className="text-xl font-bold mb-3 text-blue-400">Option 1: Connect with Porto Wallet</h3>
                  <p className="mb-3">Porto wallet has built-in support for WebAuthn authentication.</p>
                  <InitializeAccount 
                    onAccountCreated={handlePortoAccountCreated} 
                    onError={handlePortoError} 
                  />
                </div>
              ) : (
                <div className="bg-gray-800/40 p-4 rounded-lg opacity-70">
                  <h3 className="text-xl font-bold mb-3">Option 1: Connect with Porto Wallet</h3>
                  <p className="mb-3 text-yellow-400">Porto wallet not detected. Install Porto for built-in WebAuthn support.</p>
                </div>
              )}
              */}
              
              <div className="bg-gray-800/40 p-4 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-blue-400">Connect WebAuthn-Compatible Wallet</h3>
                <p className="mb-3">Connect any wallet that supports the WebAuthn and EIP-7702 standards.</p>
                <button 
                  className="btn btn-primary"
                  disabled={isConnecting}
                  onClick={connectWallet}
                >
                  {isConnecting ? (
                    <>
                      <Spinner /> Connecting...
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              </div>
              
              {errorMessage && (
                <div className="text-error mt-2">{errorMessage}</div>
              )}
            </div>
          )}
        </div>

        {/* Batch Operations Section */}
        {webAuthnStatus === "initialized" && (
          <div className="w-full max-w-3xl p-8 bg-base-200 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Batch Operations</h2>
            
            <p className="mb-4">Current operations in batch: {operations.length}</p>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <button 
                className="btn btn-secondary"
                onClick={addSampleOperation}
              >
                Add Sample Transaction
              </button>
              <button 
                className="btn btn-warning"
                onClick={clearOperations}
                disabled={operations.length === 0}
              >
                Clear All
              </button>
            </div>

            {operations.length > 0 && (
              <>
                <div className="overflow-x-auto mb-6">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>To</th>
                        <th>Value (ETH)</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((op, index) => (
                        <tr key={index}>
                          <td className="font-mono text-xs">
                            {op.to.slice(0, 8)}...{op.to.slice(-6)}
                          </td>
                          <td>{op.value}</td>
                          <td>{op.description || 'Transaction'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleExecuteBatch}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner /> Executing Batch...
                    </>
                  ) : (
                    "Execute Batch with WebAuthn"
                  )}
                </button>

                {errorMessage && (
                  <div className="text-error mt-4">{errorMessage}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Explanation Section */}
        <div className="w-full max-w-3xl p-8 bg-base-200 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          
          <div className="prose">
            <p>
              This demo showcases how WebAuthn can be used with EIP-7702 to enable secure batch transactions
              with passwordless authentication.
            </p>
            
            <ol className="list-decimal pl-6">
              <li>
                <strong>Connect Your Wallet:</strong> Connect any WebAuthn-compatible wallet (supports EIP-7702).
              </li>
              <li>
                <strong>Initialize WebAuthn:</strong> Create a WebAuthn credential for secure authentication.
              </li>
              <li>
                <strong>Add Operations:</strong> Build a batch of operations that will be executed in a single transaction.
              </li>
              <li>
                <strong>Execute Batch:</strong> Sign the batch with your WebAuthn credential and execute it as a single transaction.
              </li>
            </ol>
            
            <p className="mt-4">
              <strong>Note:</strong> You need a compatible wallet that supports both WebAuthn and EIP-7702.
              Compatible wallets include Ambire Wallet, Taho, or Magic.link.
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 