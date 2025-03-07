"use client";

import { useEffect, useState } from "react";
import { Address, formatEther } from "viem";
// import { useDisplayUsdMode } from "~~/hooks/scaffold-eth/useDisplayUsdMode";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useWatchBalance } from "~~/hooks/scaffold-eth/useWatchBalance";
// import { useGlobalState } from "~~/services/store/store";

type BalanceProps = {
  address?: Address;
  className?: string;
  usdMode?: boolean;
};

/**
 * Display (ETH & USD) balance of an ETH address.
 */
// export const Balance = ({ address, className = "", usdMode }: BalanceProps) => {
//   const { targetNetwork } = useTargetNetwork();
//   const publicClient = usePublicClient({ chainId: targetNetwork.id });
//   const [manualBalance, setManualBalance] = useState<bigint | null>(null);
//   const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
//   const isNativeCurrencyPriceFetching = useGlobalState(state => state.nativeCurrency.isFetching);

//   const {
//     data: balance,
//     isError,
//     isLoading,
//   } = useWatchBalance({
//     address,
//     chainId: targetNetwork.id,
//   });

//   // Fallback to manual balance fetch if watching fails
//   useEffect(() => {
//     const fetchBalance = async () => {
//       if (isError && address && publicClient) {
//         try {
//           const fetchedBalance = await publicClient.getBalance({ address });
//           setManualBalance(fetchedBalance);
//         } catch (e) {
//           console.error("Error fetching balance:", e);
//         }
//       }
//     };
//     fetchBalance();
//   }, [isError, address, publicClient]);

//   const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({ defaultUsdMode: usdMode });

//   if (!address || (isLoading && !manualBalance) || (balance === null && manualBalance === null) || 
//       (isNativeCurrencyPriceFetching && nativeCurrencyPrice === 0)) {
//     return (
//       <div className="animate-pulse flex space-x-4">
//         <div className="rounded-md bg-slate-300 h-6 w-6"></div>
//         <div className="flex items-center space-y-6">
//           <div className="h-2 w-28 bg-slate-300 rounded"></div>
//         </div>
//       </div>
//     );
//   }

//   const finalBalance = balance?.value || manualBalance || 0n;
//   const formattedBalance = Number(formatEther(finalBalance));

//   return (
//     <button
//       className={`btn btn-sm btn-ghost flex flex-col font-normal items-center hover:bg-transparent ${className}`}
//       onClick={toggleDisplayUsdMode}
//     >
//     </button>
//   );
// };
