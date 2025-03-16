# PureContracts Next.js App

This is the Next.js frontend for the PureContracts application.

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   cd packages/nextjs
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file in the `packages/nextjs` directory with the following content:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

## WalletConnect Project ID

This application uses WalletConnect for wallet connections. You need to obtain a project ID from WalletConnect:

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Sign up or log in
3. Create a new project
4. Copy the project ID
5. Add it to your `.env.local` file as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

## AppKit Integration

This application uses AppKit for wallet connections. AppKit is a library that provides a simple way to integrate WalletConnect into your application.

The main components for wallet connection are:
- `AppKitProvider.tsx`: Provides the AppKit context to the application
- `AppKitWallet.tsx`: A component that displays the wallet connection status and provides buttons to connect/disconnect
- `appKitUtils.ts`: Utility functions for initializing AppKit

## Running the Application

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Features

- Connect to wallets using WalletConnect
- Switch networks
- View wallet balance
- Wrap and unwrap tokens (ETH/WETH, stETH/wstETH)
- Sign messages
- Send transactions

## Troubleshooting

### WalletConnect Issues

If you encounter issues with WalletConnect, check the following:

1. Make sure you have set up the WalletConnect project ID correctly
2. Check that your project ID is valid and active in the WalletConnect Cloud dashboard
3. Ensure that your application's domain is allowed in the WalletConnect Cloud dashboard

### Balance Fetching Issues

If you encounter issues with balance fetching, it might be due to:

1. The wallet not being properly connected
2. The network not being supported
3. RPC endpoint issues

Try switching networks or reconnecting your wallet.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 