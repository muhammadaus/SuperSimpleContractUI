import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for transaction data (in production, use a database)
const transactionStore: Record<string, any> = {};

// GET handler for transaction data
export async function GET(request: NextRequest) {
  // Set CORS headers
  const response = NextResponse.json(
    getTransactionData(request)
  );
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

// POST handler for storing transaction data
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, chainId, to, data, value, gas } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  if (!chainId || !to) {
    return NextResponse.json({ error: 'Transaction data is incomplete' }, { status: 400 });
  }

  // Store transaction data
  transactionStore[sessionId] = {
    chainId,
    to,
    data,
    value: value || '0',
    gas: gas || undefined,
    timestamp: Date.now()
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

// Helper function to get transaction data
function getTransactionData(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return { error: 'Session ID is required' };
  }

  // Check if transaction data exists for this session
  if (!transactionStore[sessionId]) {
    return { error: 'No transaction data found for this session' };
  }

  return transactionStore[sessionId];
} 