import { useChainId, useConfig } from "wagmi";
import { switchNetwork } from "wagmi/actions";
import { getTargetNetwork } from "~~/utils/scaffold-eth";

const targetNetwork = getTargetNetwork();

export const NetworkDropdown = () => {
  const chainId = useChainId();
  const config = useConfig();

  const isTargetNetwork = chainId === targetNetwork.id;

  const handleNetworkSwitch = async () => {
    if (!isTargetNetwork) {
      await switchNetwork(config, { chainId: targetNetwork.id });
    }
  };

  return (
    <div className="flex items-center">
      {!isTargetNetwork && (
        <button
          className="btn btn-sm btn-error"
          onClick={handleNetworkSwitch}
        >
          Wrong network! Click to switch to {targetNetwork.name}
        </button>
      )}
    </div>
  );
}; 