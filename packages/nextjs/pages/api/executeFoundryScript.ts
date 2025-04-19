import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import util from 'util';

const execPromise = util.promisify(exec);

// Temp directory for script execution
const TEMP_DIR = path.join(process.cwd(), 'temp', 'foundry-scripts');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract data from request
    const { script, privateKey, rpcUrl } = req.body;

    // Validate inputs
    if (!script || !privateKey || !rpcUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log("Executing Foundry script with RPC URL:", rpcUrl);
    
    // Clean script of emoji characters that might cause Solidity errors
    const cleanedScript = script
      .replace(/🚀/g, '---')
      .replace(/✅/g, '---')
      .replace(/⚠️/g, '---');

    // Create unique ID for this execution
    const executionId = uuidv4();
    const executionDir = path.join(TEMP_DIR, executionId);
    console.log("Execution directory:", executionDir);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      console.log("Created temp directory:", TEMP_DIR);
    }

    // Create a clean execution directory
    fs.mkdirSync(executionDir, { recursive: true });
    console.log("Created execution directory:", executionDir);
    
    // Create required structure for a manual Foundry project
    // Instead of using forge init, we'll set up the directory structure manually
    fs.mkdirSync(path.join(executionDir, 'script'), { recursive: true });
    fs.mkdirSync(path.join(executionDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(executionDir, 'test'), { recursive: true });
    fs.mkdirSync(path.join(executionDir, 'lib'), { recursive: true });
    fs.mkdirSync(path.join(executionDir, 'out'), { recursive: true });

    // Write script to file
    const scriptPath = path.join(executionDir, 'script', 'BatchExecution.s.sol');
    fs.writeFileSync(scriptPath, cleanedScript);
    console.log("Wrote script to:", scriptPath);

    // Create foundry.toml
    const foundryConfig = `[profile.default]
src = 'src'
out = 'out'
libs = ['lib']
evm_version = "paris"

# Add standard remappings
remappings = [
  '@openzeppelin/=lib/openzeppelin-contracts/',
  'forge-std/=lib/forge-std/src/'
]`;
    fs.writeFileSync(path.join(executionDir, 'foundry.toml'), foundryConfig);

    // Create .env file
    const envContent = `PRIVATE_KEY=${privateKey}\nRPC_URL=${rpcUrl}`;
    fs.writeFileSync(path.join(executionDir, '.env'), envContent);

    // Find forge binary path
    let forgePath = '';
    try {
      const { stdout: forgePathOutput } = await execPromise('which forge');
      forgePath = forgePathOutput.trim();
      console.log("Found forge at:", forgePath);
    } catch (error) {
      // Use default path if 'which' fails
      forgePath = '/Users/muhammadaushijri/.foundry/bin/forge';
      console.log("Using default forge path:", forgePath);
    }

    // Create a shell script that handles auto-accepting prompts
    const shellScriptContent = `#!/bin/bash
echo "Running Foundry script with auto-confirmation"

# Make sure private key does not have 0x prefix
CLEAN_PRIVATE_KEY="${privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey}"

# Add the 0x prefix for use with vm.envUint in the Solidity script
export PRIVATE_KEY="0x$CLEAN_PRIVATE_KEY"
export RPC_URL="${rpcUrl}"

# Check if we have what we need
if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: PRIVATE_KEY not set or empty"
  exit 1
fi

if [ -z "$RPC_URL" ]; then
  echo "Error: RPC_URL not set or empty"
  exit 1
fi

echo "Using RPC URL: $RPC_URL"
echo "Private key format (with 0x prefix): $PRIVATE_KEY"

# Run with full path to forge to avoid PATH issues
# Auto-answer 'y' to any prompts about transactions to EOAs
echo 'y' | ${forgePath} script script/BatchExecution.s.sol --rpc-url "$RPC_URL" --broadcast -vvvv

# Exit with the script's exit code
exit $?`;

    const shellScriptPath = path.join(executionDir, 'run_script.sh');
    fs.writeFileSync(shellScriptPath, shellScriptContent);
    fs.chmodSync(shellScriptPath, '755'); // Make executable
    console.log("Created shell script at:", shellScriptPath);

    // Install dependencies directly without initializing
    try {
      console.log("Installing forge-std dependency...");
      await execPromise('git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std', { cwd: executionDir });
      
      console.log("Installing OpenZeppelin contracts dependency...");
      await execPromise('git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts', { cwd: executionDir });
      
      console.log("Executing the script...");
      // Execute the script using the shell script
      const { stdout, stderr } = await execPromise(
        './run_script.sh',
        { cwd: executionDir }
      );

      console.log("Script execution completed");
      
      // Don't immediately clean up for debugging purposes
      console.log("Temporary files will be kept for debugging at:", executionDir);

      // Check for success or failure in the output
      // More comprehensive success detection based on actual Foundry output patterns
      const success = 
        stdout.includes('All operations completed successfully') || 
        stdout.includes('operations completed successfully') ||
        stdout.includes('ONCHAIN EXECUTION COMPLETE') ||
        (stdout.includes('Script ran successfully') && stdout.includes('Sender address:')) ||
        (stdout.includes('Script ran successfully') && !stderr);
      
      console.log('Foundry execution status:', success ? 'SUCCESS' : 'FAILED');
      console.log('Output contains "Script ran successfully":', stdout.includes('Script ran successfully'));
      console.log('Output contains "Sender address:":', stdout.includes('Sender address:'));
      
      return res.status(200).json({
        success,
        output: stdout,
        error: stderr || null,
        executionDir // Include execution directory for debugging
      });
    } catch (execError: any) {
      console.error('Execution error:', execError);
      
      // Don't clean up on failure to allow for debugging
      console.log("Keeping temporary files for debugging at:", executionDir);
      
      // Check if the error output still contains any success indicators
      const errorOutput = execError.stdout || '';
      const errorSuccess = 
        errorOutput.includes('Script ran successfully') && 
        errorOutput.includes('Sender address:');
      
      // Return the error output, but check if we actually succeeded despite the error
      return res.status(200).json({
        success: errorSuccess,
        output: execError.stdout || '',
        error: execError.stderr || execError.message,
        executionDir // Include execution directory for debugging
      });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
} 