import React, { useState } from "react";
import { Hash } from "viem";
import { notification } from "../../utils/scaffold-eth/notification";
import { getParsedError } from "../../utils/scaffold-eth/getParsedError";

/**
 * Runs Transaction passed in to returned function showing UI feedback.
 * @returns function that takes in transaction function as callback, shows UI feedback for transaction and returns a promise of the transaction hash
 */
export const useTransactor = () => {
  const [isPending, setIsPending] = useState(false);

  const transactor = async (tx: () => Promise<Hash | string>) => {
    if (isPending) {
      notification.info("Transaction already in progress");
      return;
    }

    let notificationId = null;
    try {
      setIsPending(true);
      notificationId = notification.loading("Awaiting for user confirmation");
      
      const result = await tx();
      
      notification.remove(notificationId);
      notification.success("Transaction completed successfully!");
      
      return result as Hash;
    } catch (error: any) {
      if (notificationId) {
        notification.remove(notificationId);
      }
      console.error("Transaction error:", error);
      const message = getParsedError(error);
      notification.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return transactor;
};
