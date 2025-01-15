import React, { useState } from "react";
import Link from "next/link";
import { WrenchScrewdriverIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Site footer
 */
export const Footer = () => {
  const [copied, setCopied] = useState(false);
  const donationAddress = "0x4841324A5B3AB1a2BBD2ecD1fBd5346867A1f2F1";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(donationAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0 bg-gray-900/50 backdrop-blur-sm border-t border-gray-800">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex gap-4 items-center">
            <Link
              href="https://github.com/muhammadaus/PureContracts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <WrenchScrewdriverIcon className="h-6 w-6" />
              <span>GitHub</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <button
              onClick={handleCopy}
              className="group flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-all"
            >
              <span className="text-sm">Donate: {shortenAddress(donationAddress)}</span>
              {copied ? (
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4 text-gray-400 group-hover:text-white" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span>Queries:</span>
            <a
              href="mailto:dev@cipherlogic.xyz"
              className="hover:text-white transition-colors"
            >
              dev@cipherlogic.xyz
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
