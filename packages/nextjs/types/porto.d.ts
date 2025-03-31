declare module 'porto' {
  export interface PortoAccount {
    address: string;
    capabilities?: Record<string, any>;
  }

  export interface PortoWalletConnectResponse {
    accounts: PortoAccount[];
  }

  export interface PortoProvider {
    request(args: {
      method: string;
      params?: any[];
    }): Promise<any>;
  }

  export interface Porto {
    provider: PortoProvider;
  }

  export const Porto: {
    create(): Porto;
  };
} 