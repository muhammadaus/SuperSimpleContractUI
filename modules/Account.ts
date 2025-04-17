import { useMutation, useQuery } from '@tanstack/react-query'
import { createWalletClient, http, custom, type Address, type Hash } from 'viem'
import { useCallback, useState } from 'react'

// Define client type that we'll use in our module
type Client = {
  chain: {
    id: number
    name: string
    blockExplorers: {
      default: {
        url: string
      }
    }
  }
}

// Define an account type that reflects a WebAuthn-backed account
type AccountType = {
  address: Address
  isWebAuthn: boolean
}

// Local storage key for WebAuthn account data
const WEBAUTHN_ACCOUNT_KEY = 'webauthn_account'

// Helper to check if the browser is compatible with WebAuthn
const isWebAuthnSupported = () => {
  return typeof window !== 'undefined' && 
         window.PublicKeyCredential !== undefined && 
         typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
}

// Helper to check if the ethereum provider supports WebAuthn
const isProviderWebAuthnSupported = async () => {
  if (typeof window === 'undefined' || !window.ethereum) return false
  
  try {
    const capabilities = await window.ethereum.request({ 
      method: 'wallet_getCapabilities' 
    }).catch(() => ({}))
    
    return !!(capabilities && (
      capabilities.webauthn || 
      capabilities.eip7702 || 
      capabilities.signWithCredential
    ))
  } catch (error) {
    console.warn('Failed to check WebAuthn support in provider:', error)
    return false
  }
}

// Create a namespace for account functions
export const Account = {
  // Hook to query the current account
  useQuery: () => {
    return useQuery({
      queryKey: ['account'],
      queryFn: async () => {
        // Try to load from local storage first
        const storedAccount = localStorage.getItem(WEBAUTHN_ACCOUNT_KEY)
        if (storedAccount) {
          try {
            const account = JSON.parse(storedAccount) as AccountType
            
            // Verify account still exists in wallet
            if (window.ethereum) {
              const accounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
              }) as string[]
              
              // If account is still connected, return it
              if (accounts.includes(account.address.toLowerCase())) {
                return account
              }
            }
          } catch (e) {
            console.error('Error parsing stored account:', e)
            // Continue to normal flow if parsing fails
          }
        }
        
        // If no valid stored account, check connected accounts
        if (window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_accounts' 
            }) as string[]
            
            if (accounts.length > 0) {
              // Check if this is a WebAuthn account
              const isWebAuthn = await isProviderWebAuthnSupported()
              
              const account: AccountType = {
                address: accounts[0] as Address,
                isWebAuthn
              }
              
              // Store for future use
              localStorage.setItem(WEBAUTHN_ACCOUNT_KEY, JSON.stringify(account))
              
              return account
            }
          } catch (e) {
            console.error('Error getting accounts:', e)
          }
        }
        
        // Return null if no account found
        return null
      }
    })
  },
  
  // Hook to create a new WebAuthn credential
  useCreate: ({ client }: { client: Client }) => {
    return useMutation({
      mutationFn: async (): Promise<Hash> => {
        if (!isWebAuthnSupported()) {
          throw new Error('WebAuthn is not supported in this browser')
        }
        
        if (!window.ethereum) {
          throw new Error('No Ethereum provider available')
        }
        
        try {
          // Request the creation of a new WebAuthn credential
          const result = await window.ethereum.request({
            method: 'webauthn_createCredential',
            params: [{
              chainId: client.chain.id,
              rp: {
                name: 'EIP-7702 WebAuthn Demo',
                id: window.location.hostname
              },
              user: {
                id: crypto.randomUUID(),
                name: 'EIP-7702 User',
                displayName: 'WebAuthn User'
              }
            }]
          })
          
          // This should contain the new address and transaction hash
          if (result && result.address && result.transactionHash) {
            // Store the new account
            const account: AccountType = {
              address: result.address as Address,
              isWebAuthn: true
            }
            localStorage.setItem(WEBAUTHN_ACCOUNT_KEY, JSON.stringify(account))
            
            // Return the transaction hash
            return result.transactionHash as Hash
          }
          
          throw new Error('Failed to create WebAuthn credential')
        } catch (error) {
          console.error('Error creating WebAuthn credential:', error)
          throw new Error(error instanceof Error ? error.message : 'Failed to create WebAuthn credential')
        }
      }
    })
  },
  
  // Hook to load an existing WebAuthn credential
  useLoad: ({ client }: { client: Client }) => {
    return useMutation({
      mutationFn: async (): Promise<void> => {
        if (!isWebAuthnSupported()) {
          throw new Error('WebAuthn is not supported in this browser')
        }
        
        if (!window.ethereum) {
          throw new Error('No Ethereum provider available')
        }
        
        try {
          // Request to get existing WebAuthn credentials
          const result = await window.ethereum.request({
            method: 'webauthn_getCredentials',
            params: [{
              chainId: client.chain.id
            }]
          })
          
          if (result && result.address) {
            // Store the account
            const account: AccountType = {
              address: result.address as Address,
              isWebAuthn: true
            }
            localStorage.setItem(WEBAUTHN_ACCOUNT_KEY, JSON.stringify(account))
            
            return
          }
          
          throw new Error('No WebAuthn credentials found')
        } catch (error) {
          console.error('Error loading WebAuthn credential:', error)
          throw new Error(error instanceof Error ? error.message : 'Failed to load WebAuthn credential')
        }
      }
    })
  }
}

// Add global type definitions for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      isMetaMask?: boolean
      isPorto?: boolean
      isPortoWallet?: boolean
      on?: (event: string, callback: (...args: any[]) => void) => void
      removeListener?: (event: string, callback: (...args: any[]) => void) => void
    }
  }
} 