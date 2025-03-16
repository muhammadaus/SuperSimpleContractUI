# WalletConnect Integration

This project integrates WalletConnect using the AppKit library from Reown. AppKit provides a simple way to connect your dApp to various wallets using WalletConnect.

## Setup

1. **Get a WalletConnect Project ID**:
   - Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
   - Create an account and a new project
   - Copy the Project ID

2. **Set Up Environment Variables**:
   - Create a `.env.local` file based on `.env.local.example`
   - Add your WalletConnect Project ID:
     ```
     NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
     ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

## Usage

### Basic Connection Button

The simplest way to use AppKit is to add the connection button to your page:

```tsx
<appkit-button></appkit-button>
```

This will render a button that, when clicked, opens a modal with wallet connection options.

### Network Selection

You can allow users to switch networks using the network button:

```tsx
<appkit-network-button></appkit-network-button>
```

### Account Management

Users can manage their connected account using the account button:

```tsx
<appkit-account-button></appkit-account-button>
```

## Demo Pages

This project includes two demo pages to showcase WalletConnect integration:

1. **Basic WalletConnect Page**: `/walletconnect`
   - Shows a simple implementation with just the connection button

2. **AppKit Demo Page**: `/appkit-demo`
   - Demonstrates all AppKit features including network selection and account management

## How It Works

AppKit is initialized in the `AppKitProvider` component, which is included in the root layout. This ensures that AppKit is available throughout the application.

The initialization happens in `appKitUtils.ts`, where we configure AppKit with:
- Your WalletConnect Project ID
- Application metadata (name, description, etc.)
- Supported networks
- Theme settings

## Customization

You can customize the appearance of AppKit by modifying the theme variables in `appKitUtils.ts`:

```typescript
themeVariables: {
  '--w3m-accent': '#3b82f6', // Blue color to match your UI
  '--w3m-accent-color': '#ffffff',
  '--w3m-background-color': '#1f2937',
  '--w3m-container-border-radius': '12px',
},
```

## Resources

- [AppKit Documentation](https://docs.reown.com/appkit)
- [WalletConnect Documentation](https://docs.walletconnect.com/) 