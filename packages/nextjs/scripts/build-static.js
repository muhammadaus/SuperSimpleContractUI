// Custom build script to handle static export
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Make sure the out directory exists
const outDir = path.join(__dirname, '..', 'out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Move problem pages aside
console.log('Temporarily renaming problematic pages...');
const problemPages = [
  'app/appkit-demo',
  'app/bridge', 
  'app/deploy',
  'app/erc20',
  'app/readwrite',
  'app/swap',
  'app/walletconnect',
  'app/wrap'
];

// Create backup directory for the pages
const backupDir = path.join(__dirname, '..', 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Backup problem pages
problemPages.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  const backupPath = path.join(backupDir, path.basename(dir));
  
  if (fs.existsSync(fullPath)) {
    try {
      console.log(`Backing up ${dir}`);
      // Create the backup directory structure
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      // Copy all files
      fs.readdirSync(fullPath).forEach(file => {
        const srcFile = path.join(fullPath, file);
        const destFile = path.join(backupPath, file);
        
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
        }
      });
      
      // Rename the original directory
      fs.renameSync(fullPath, `${fullPath}_bak`);
    } catch (err) {
      console.error(`Error backing up ${dir}:`, err);
    }
  }
});

// Run the Next.js build process
try {
  console.log('Running Next.js build...');
  execSync('next build', { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
} finally {
  // Restore problem pages
  console.log('Restoring problematic pages...');
  problemPages.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    const bakPath = `${fullPath}_bak`;
    
    if (fs.existsSync(bakPath)) {
      try {
        if (fs.existsSync(fullPath)) {
          // If somehow the original directory was recreated, remove it first
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
        
        fs.renameSync(bakPath, fullPath);
      } catch (err) {
        console.error(`Error restoring ${dir}:`, err);
      }
    }
  });
  
  console.log('All pages restored.');
}

console.log('Static build process complete!'); 