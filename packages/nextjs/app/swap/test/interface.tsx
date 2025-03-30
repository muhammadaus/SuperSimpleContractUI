"use client";

import React from 'react';

export default function TestComponent() {
  // Function with a JSX return
  const renderContent = () => {
    return (
      <div className="container">
        <h2>Test Component</h2>
        <p>This is a test component to verify correct JSX syntax</p>
      </div>
    );
  };

  // Main component return
  return (
    <div className="wrapper">
      {renderContent()}
    </div>
  );
} 