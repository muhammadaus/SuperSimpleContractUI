import { NextRequest, NextResponse } from 'next/server';
import { executeBatchWithFoundry } from '../../../utils/foundry';

export async function POST(req: NextRequest) {
  try {
    // Get the operations from the request body
    const { operations, privateKey } = await req.json();
    
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No operations provided' },
        { status: 400 }
      );
    }
    
    // Execute the batch with Foundry
    const result = await executeBatchWithFoundry(operations, {
      privateKey,
      showTransactionData: true,
      onStatusUpdate: (message) => console.log(`Foundry status: ${message}`)
    });
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Foundry execution failed' 
        },
        { status: 500 }
      );
    }
    
    // Return the success response
    return NextResponse.json({
      success: true,
      data: {
        output: result.output,
        transactionHashes: extractTransactionHashes(result.output)
      }
    });
  } catch (error) {
    console.error('Error executing Foundry batch:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper function to extract transaction hashes from Foundry output
function extractTransactionHashes(output: string): string[] {
  const hashes: string[] = [];
  
  // Regular expression to find transaction hashes in the output
  const hashRegex = /(?:tx:|hash:)\s*(0x[a-fA-F0-9]{64})/g;
  let match;
  
  while ((match = hashRegex.exec(output)) !== null) {
    hashes.push(match[1]);
  }
  
  return hashes;
} 