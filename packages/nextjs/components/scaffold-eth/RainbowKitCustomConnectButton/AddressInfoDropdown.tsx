import { useEffect, useState } from "react";
import { Address } from "viem";
// import { useChainId, useConfig } from "wagmi";
import { getBlockExplorerAddressLink, getTargetNetwork } from "~~/utils/scaffold-eth";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

const targetNetwork = getTargetNetwork();

type AddressInfoDropdownProps = {
  address: Address;
  displayName: string;
  ensAvatar?: string;
};

export const AddressInfoDropdown = ({ address, displayName, ensAvatar }: AddressInfoDropdownProps) => {
  const [addressCopied, setAddressCopied] = useState(false);
  // const chainId = useChainId();
  // const config = useConfig();

  // Determine if we're on the correct network
  // const isTargetNetwork = chainId === targetNetwork.id;

  // Copy address to clipboard
  const copyAddress = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(address);
      setAddressCopied(true);
    }
  };

  useEffect(() => {
    if (addressCopied) {
      setTimeout(() => {
        setAddressCopied(false);
      }, 800);
    }
  }, [addressCopied]);

  return (
    <div>
      <div className="flex items-center gap-2">
        {ensAvatar ? (
          <img className="rounded-full" src={ensAvatar} width={40} height={40} alt={`${address} avatar`} />
        ) : null}
        <span className="font-medium">{displayName}</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={copyAddress}
        >
          {addressCopied ? <ClipboardDocumentCheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
        </button>
        {isTargetNetwork && (
          <a
            // href={getBlockExplorerAddressLink(config.chains[0], address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            View on Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
};
