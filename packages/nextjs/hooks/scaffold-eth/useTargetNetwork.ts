import { useMemo } from "react";
import { Chain } from "viem";
import { getTargetNetwork } from "../../utils/scaffold-eth/networks";

type TargetNetwork = Chain & {
  color?: string;
  name: string;
};

export function useTargetNetwork(): { targetNetwork: TargetNetwork } {
  const targetNetwork = useMemo(() => getTargetNetwork(), []);
  return {
    targetNetwork,
  };
}


