import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// In-memory storage for transaction sessions
const sessions: Record<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionHash?: string;
  error?: string;
  createdAt: number;
  processedAt?: number;
}> = {};

export async function GET(request: NextRequest) {
  // Get the session ID from the query parameters
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  
  if (!sessionId) {
    const response = NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    setCorsHeaders(response);
    return response;
  }
  
  // Return the session status
  if (sessions[sessionId]) {
    const response = NextResponse.json({
      status: sessions[sessionId].status,
      transactionHash: sessions[sessionId].transactionHash,
      error: sessions[sessionId].error
    });
    setCorsHeaders(response);
    return response;
  }
  
  const response = NextResponse.json({ status: 'not_found' }, { status: 404 });
  setCorsHeaders(response);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, chainId, to, value, data } = body;

    if (!sessionId) {
      const response = NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      setCorsHeaders(response);
      return response;
    }

    if (!chainId || !to) {
      const response = NextResponse.json({ error: 'chainId and to are required' }, { status: 400 });
      setCorsHeaders(response);
      return response;
    }

    console.log(`Processing mock transaction for session ${sessionId}:`, { chainId, to, value, data });

    // Generate a mock transaction hash
    const mockTxHash = `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`;

    // Update transaction status to completed (in a real scenario, this would be done after confirmation)
    const statusApiUrl = new URL('/api/transaction-status', request.nextUrl.origin);
    
    // First set to pending
    await fetch(statusApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        status: 'pending',
      }),
    });

    // Simulate transaction processing time (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then set to completed with the transaction hash
    await fetch(statusApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        status: 'completed',
        transactionHash: mockTxHash,
      }),
    });

    const response = NextResponse.json({ 
      success: true, 
      message: 'Transaction submitted',
      transactionHash: mockTxHash
    });
    setCorsHeaders(response);
    return response;
  } catch (error) {
    console.error('Error processing mock transaction:', error);
    const response = NextResponse.json({ 
      error: 'Failed to process transaction',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
    setCorsHeaders(response);
    return response;
  }
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  setCorsHeaders(response);
  return response;
}

// Helper function to set CORS headers
function setCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
} 