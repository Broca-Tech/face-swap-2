import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId } = body;

  const AKOOL_API_KEY = process.env.AKOOL_API_KEY;

  if (!AKOOL_API_KEY) {
    return NextResponse.json({ error: 'AKOOL_API_KEY is missing' }, { status: 500 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const response = await axios.post(
      'https://openapi.akool.com/api/open/v3/faceswap/live/close',
      {
        _id: sessionId,
      },
      {
        headers: {
          'x-api-key': AKOOL_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("Close Session Response:", response.data);

    if (response.data.code !== 1000) {
      return NextResponse.json({
        error: 'Failed to close session',
        details: response.data,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Session closed successfully',
    });
  } catch (error: any) {
    console.error('Close Session Error:', error.response?.data || error.message);
    return NextResponse.json(
      { error: error.response?.data || error.message },
      { status: error.response?.status || 500 }
    );
  }
}
