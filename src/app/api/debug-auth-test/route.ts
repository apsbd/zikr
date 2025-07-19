import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Debug auth test endpoint is working',
    timestamp: new Date().toISOString(),
    headers: {
      authorization: request.headers.get('authorization') || 'none'
    }
  });
}