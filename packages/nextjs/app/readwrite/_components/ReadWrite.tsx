"use client";

import { ContractUI } from "./contract/ContractUI";

export const ReadWrite = () => {
  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-8 py-8 lg:py-12 justify-center items-center">
      <ContractUI />
    </div>
  );
};
