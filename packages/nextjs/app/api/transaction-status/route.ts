import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for transaction status (in production, use a database)
const transactionStatusStore: Record<string, { 
  status: 'pending' | 'completed' | 'failed'; 
  transactionHash?: string; 
  error?: string;
  walletInfo?: {
    name?: string;
    agent?: string;
  };
  timestamp: number;
}> = {};

// GET handler for transaction status
export async function GET(request: NextRequest) {
  // Set CORS headers
  const response = NextResponse.json(
    getTransactionStatus(request)
  );
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

// POST handler for updating transaction status
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, status, transactionHash, error, walletInfo } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 });
  }

  // Update transaction status
  transactionStatusStore[sessionId] = {
    status: status as 'pending' | 'completed' | 'failed',
    transactionHash,
    error,
    walletInfo,
    timestamp: Date.now(),
  };

  const response = NextResponse.json({ success: true });
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

// Helper function to get transaction status
function getTransactionStatus(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return { error: 'Session ID is required' };
  }

  // Check if session exists
  if (!transactionStatusStore[sessionId]) {
    return { status: 'pending' };
  }

  // Check if session has expired (30 minutes)
  const now = Date.now();
  if (now - transactionStatusStore[sessionId].timestamp > 30 * 60 * 1000) {
    delete transactionStatusStore[sessionId];
    return { status: 'expired' };
  }

  return {
    status: transactionStatusStore[sessionId].status,
    transactionHash: transactionStatusStore[sessionId].transactionHash,
    error: transactionStatusStore[sessionId].error,
    walletInfo: transactionStatusStore[sessionId].walletInfo,
  };
} 