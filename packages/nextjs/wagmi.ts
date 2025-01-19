import { createConfig } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'

// Create wagmi config using wallet's provider directly
export const config = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      options: {
        shimDisconnect: true,
      },
    }),
  ],
}) 