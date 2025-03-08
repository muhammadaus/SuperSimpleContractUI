import { useMemo } from "react";
// import { useChainId, useConfig } from "wagmi";
// import { switchNetwork } from "wagmi/actions";
import { getTargetNetwork } from "~~/utils/scaffold-eth";

type NetworkOptionsProps = {
  hidden?: boolean;
};

export const NetworkOptions = ({ hidden = false }: NetworkOptionsProps) => {
  // const chainId = useChainId();
  // const config = useConfig();
  const targetNetwork = useMemo(() => getTargetNetwork(), []);

  // Don't show options if we're already on target network
  // if (chainId === targetNetwork.id) {
  //   return null;
  // }

  const handleNetworkSwitch = async () => {
    // await switchNetwork(config, { chainId: targetNetwork.id });
  };

  return (
    <>
      <li className={hidden ? "hidden" : ""}>
        <button
          className="menu-item"
          type="button"
          onClick={handleNetworkSwitch}
        >
          <span className="text-sm">{targetNetwork.name}</span>
        </button>
      </li>
    </>
  );
};
