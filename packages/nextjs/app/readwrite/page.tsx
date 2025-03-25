import React from 'react';
import ClientOnly from '../components/ClientOnly';
import dynamic from 'next/dynamic';
import { getMetadata } from "../../utils/scaffold-eth/getMetadata";

// Note: The AppKit initialization has been moved to the ReadWrite component
// to ensure it only happens once and in a controlled manner

export const metadata = getMetadata({
  title: "ReadWrite Contracts",
  description: "Interact with your deployed contracts in an easy way",
});

// Use dynamic import with SSR disabled to prevent server-side rendering issues
const ReadWriteComponent = dynamic(
  () => import('./_components/ReadWrite'),
  { ssr: false }
);

export default function ReadWritePage() {
  return (
    <ClientOnly fallback={<div className="container mx-auto p-4">Loading contract interface...</div>}>
      <ReadWriteComponent />
    </ClientOnly>
  );
}
