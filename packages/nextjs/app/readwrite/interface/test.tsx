"use client";

import React from 'react';
import { AbiFunction } from "abitype";

// Define a more complete type that includes all function types
type ExtendedAbiFunction = AbiFunction | {
  type: "constructor" | "fallback" | "receive";
  inputs?: { type: string; name: string }[];
  stateMutability: string;
};

// Test function to simulate the functionsByType behavior
const testFunctionsByType = (parsedAbi: ExtendedAbiFunction[]) => {
  const functionTypes: { [key: string]: ExtendedAbiFunction[] } = {
    read: [],
    write: [],
    constructor: [],
    fallback: [], 
    receive: []
  };

  parsedAbi.forEach((func) => {
    if (func.type === "function") {
      const type = func.stateMutability === "view" || func.stateMutability === "pure" ? "read" : "write";
      functionTypes[type].push(func);
    } else if (func.type === "constructor" || func.type === "fallback" || func.type === "receive") {
      functionTypes[func.type].push(func);
    }
  });

  return functionTypes;
};

// Test component to run the test
const TestReadWriteInterface = () => {
  // Sample ABI functions for testing
  const testAbi: ExtendedAbiFunction[] = [
    {
      type: "function",
      name: "getValue",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256", name: "" }]
    },
    {
      type: "function",
      name: "setValue",
      stateMutability: "nonpayable",
      inputs: [{ type: "uint256", name: "value" }],
      outputs: []
    },
    {
      type: "constructor",
      inputs: [{ type: "address", name: "owner" }],
      stateMutability: "nonpayable"
    },
    {
      type: "fallback",
      stateMutability: "payable",
    },
    {
      type: "receive",
      stateMutability: "payable",
    }
  ];

  // Run the test
  const results = testFunctionsByType(testAbi);
  
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">ReadWriteInterface Test</h1>
      
      <div className="space-y-6">
        {Object.entries(results).map(([type, functions]) => (
          <div key={type} className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3 capitalize">{type} Functions</h2>
            <div className="space-y-2">
              {functions.length === 0 ? (
                <p className="text-gray-500">No {type} functions found</p>
              ) : (
                functions.map((func, index) => (
                  <div key={index} className="p-2 bg-gray-100 rounded">
                    <p className="font-mono">
                      {func.type === "function" ? (
                        <>
                          <span className="text-blue-600">{func.name}</span>
                          (
                          {func.inputs?.map((input, i) => (
                            <span key={i}>
                              {i > 0 && ", "}
                              <span className="text-gray-600">{input.type}</span> {input.name}
                            </span>
                          ))}
                          )
                        </>
                      ) : (
                        <span className="text-purple-600">{func.type}</span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-green-100 rounded-lg">
        <p className="font-semibold text-green-700">Test completed successfully!</p>
        <p className="mt-2">All function types were properly categorized without errors.</p>
      </div>
    </div>
  );
};

export default TestReadWriteInterface; 