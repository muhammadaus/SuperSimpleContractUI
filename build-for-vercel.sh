#!/bin/bash
set -e

echo "Starting Vercel build process"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Navigate to the nextjs package
cd packages/nextjs

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the Next.js app
echo "Building Next.js application..."
npm run build

echo "Build completed successfully!" 