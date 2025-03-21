#!/bin/bash
set -e

echo "Starting Vercel build process"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Skip lockfile updates
export YARN_ENABLE_IMMUTABLE_INSTALLS=false
export YARN_IMMUTABLE_NO_UPDATE=true

# Navigate to the nextjs package
cd packages/nextjs

# Create a .npmrc file to ensure non-interactive builds
cat > .npmrc << EOL
legacy-peer-deps=true
shamefully-hoist=true
EOL

# Install dependencies using npm (not yarn)
echo "Installing dependencies..."
npm install --no-package-lock

# Build the Next.js app
echo "Building Next.js application..."
npm run build

echo "Build completed successfully!" 