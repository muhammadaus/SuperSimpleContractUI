import React from "react";
import Link from "next/link";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

/**
 * Site footer
 */
export const Footer = () => {
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
