"use client";

import { useEffect } from "react";
import { initializePorto } from "@/utils/porto";

/**
 * Component for initializing Porto wallet
 * This should be included near the root of the app
 */
export const PortoInitializer: React.FC = () => {
  useEffect(() => {
    // Initialize Porto when component mounts
    const init = async () => {
      try {
        await initializePorto();
      } catch (error) {
        console.error("Failed to initialize Porto:", error);
      }
    };
    
    init();
  }, []);
  
  // This component doesn't render anything
  return null;
}; 