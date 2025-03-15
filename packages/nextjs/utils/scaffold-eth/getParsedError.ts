import { BaseError as BaseViemError, ContractFunctionRevertedError } from "viem";

/**
 * Parses an error object and returns a user-friendly error message.
 * @param error The error object to parse
 * @returns A user-friendly error message
 */
export const getParsedError = (error: any): string => {
  let parsedError = "";

  try {
    // Handle string error
    if (typeof error === "string") {
      parsedError = error;
    }
    // Handle object error with message
    else if (error?.message) {
      parsedError = error.message;
    }
    // Handle nested error objects
    else if (error?.error?.message) {
      parsedError = error.error.message;
    }
    // Handle nested reason
    else if (error?.data?.message) {
      parsedError = error.data.message;
    }
    // Handle nested reason
    else if (error?.reason) {
      parsedError = error.reason;
    }
    // Handle nested error
    else if (error?.error) {
      parsedError = getParsedError(error.error);
    }
    // Handle unknown error
    else {
      parsedError = "An unknown error occurred";
    }

    // Clean up common error messages
    if (parsedError.includes("execution reverted")) {
      parsedError = parsedError.replace("execution reverted:", "").trim();
    }

    // Limit length
    if (parsedError.length > 120) {
      parsedError = parsedError.substring(0, 120) + "...";
    }
  } catch (e) {
    console.error("Error parsing error:", e);
    parsedError = "An unknown error occurred";
  }

  return parsedError;
};
