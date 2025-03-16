import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for connection status (in production, use a database)
const connectionStore: Record<string, { 
  status: 'pending' | 'connected' | 'disconnected';
  walletAddress?: string;
  walletInfo?: {
    name?: string;
    agent?: string;
  };
  timestamp: number;
}> = {};

// GET handler for connection status
export async function GET(request: NextRequest) {
  // Set CORS headers
  const response = NextResponse.json(
    getConnectionStatus(request)
  );
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

// POST handler for updating connection status
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, status, walletAddress, walletInfo } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 });
  }

  // Update connection status
  connectionStore[sessionId] = {
    status: status as 'pending' | 'connected' | 'disconnected',
    walletAddress,
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

// Helper function to get connection status
function getConnectionStatus(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return { error: 'Session ID is required' };
  }

  // Check if session exists
  if (!connectionStore[sessionId]) {
    return { status: 'pending' };
  }

  // Check if session has expired (30 minutes)
  const now = Date.now();
  if (now - connectionStore[sessionId].timestamp > 30 * 60 * 1000) {
    delete connectionStore[sessionId];
    return { status: 'expired' };
  }

  return {
    status: connectionStore[sessionId].status,
    walletAddress: connectionStore[sessionId].walletAddress,
    walletInfo: connectionStore[sessionId].walletInfo,
  };
} 