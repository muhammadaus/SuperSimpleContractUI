// Script to check if all mock files are properly set up
const fs = require('fs');
const path = require('path');

const mockDirs = [
  'mocks/hooks/scaffold-eth',
  'mocks/utils/scaffold-eth/common',
  'mocks/utils/scaffold-eth/contract',
  'mocks/utils/scaffold-eth/networks',
  'mocks/utils/scaffold-eth/notification',
  'mocks/utils/scaffold-eth/contractsData',
  'mocks/components/scaffold-eth',
];

const mockFiles = [
  'mocks/react-copy-to-clipboard.tsx',
  'mocks/scaffold.config.ts',
  'mocks/index.ts',
  'mocks/hooks/scaffold-eth/index.ts',
  'mocks/hooks/scaffold-eth/useTargetNetwork.ts',
  'mocks/utils/scaffold-eth/common/index.ts',
  'mocks/components/scaffold-eth/index.tsx',
  'mocks/usehooks-ts.ts',
  'mocks/appkit.tsx',
];

console.log('Checking mock directory structure...');

// Check directories
let allGood = true;
for (const dir of mockDirs) {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing directory: ${dir}`);
    allGood = false;
  } else {
    console.log(`✅ Found directory: ${dir}`);
  }
}

// Check files
for (const file of mockFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${file}`);
    allGood = false;
  } else {
    console.log(`✅ Found file: ${file}`);
  }
}

if (allGood) {
  console.log('✅ All mock files are properly set up!');
  process.exit(0);
} else {
  console.error('❌ Some mock files are missing. Please check the errors above.');
  process.exit(1);
} 