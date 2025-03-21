#!/bin/bash
set -e

echo "Starting Vercel build process"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Skip yarn and use npm directly
echo "Disabling yarn for this build..."
mv .yarnrc.yml .yarnrc.yml.bak 2>/dev/null || true

# Create a root .npmrc file
cat > .npmrc << EOL
legacy-peer-deps=true
shamefully-hoist=true
EOL

# Navigate to the nextjs package
cd packages/nextjs

# Create a .npmrc file for the nextjs package
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