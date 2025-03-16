import "@/styles/globals.css";
import type { Metadata } from "next";
import { AppKitProvider } from "@/components/scaffold-eth/AppKitProvider";

export const metadata: Metadata = {
  title: "Pure Contracts",
  description: "Interact with EVM Smart Contracts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppKitProvider>
          {children}
        </AppKitProvider>
      </body>
    </html>
  );
}
