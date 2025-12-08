import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, sourceImageUrl } = body;

  const AKOOL_API_KEY = process.env.AKOOL_API_KEY;

  if (!AKOOL_API_KEY) {
    return NextResponse.json({ error: 'AKOOL_API_KEY is missing' }, { status: 500 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  if (!sourceImageUrl) {
    return NextResponse.json({ error: 'sourceImageUrl is required' }, { status: 400 });
  }

  try {
    // Step 1: Detect face landmarks in the new image
    console.log("Detecting face landmarks for:", sourceImageUrl);

    const detectResponse = await axios.post(
      'https://sg3.akool.com/detect',
      {
        single_face: true,
        image_url: sourceImageUrl,
      },
      {
        headers: {
          'x-api-key': AKOOL_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("Face Detection Response:", JSON.stringify(detectResponse.data, null, 2));

    if (detectResponse.data.error_code !== 0) {
      return NextResponse.json({
        error: 'Face detection failed',
        details: detectResponse.data,
      }, { status: 400 });
    }

    if (!detectResponse.data.landmarks_str) {
      return NextResponse.json({
        error: 'No face detected in the image',
        details: detectResponse.data,
      }, { status: 400 });
    }

    const opts = detectResponse.data.landmarks_str;

    // Step 2: Update the session with the new face
    const payload = {
      _id: sessionId,
      sourceImage: [
        {
          path: sourceImageUrl,
          opts: opts,
        }
      ],
    };

    console.log("Sending update payload to Akool:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://openapi.akool.com/api/open/v3/faceswap/live/update',
      payload,
      {
        headers: {
          'x-api-key': AKOOL_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("Akool Update Response:", JSON.stringify(response.data, null, 2));

    if (response.data.code !== 1000) {
      return NextResponse.json({
        error: 'Failed to update face swap session',
        details: response.data,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Face updated successfully',
    });
  } catch (error: any) {
    console.error('Akool API Error:', JSON.stringify(error.response?.data, null, 2) || error.message);
    console.error('Full error:', error);
    return NextResponse.json(
      {
        error: 'API request failed',
        details: error.response?.data || error.message,
        status: error.response?.status,
      },
      { status: error.response?.status || 500 }
    );
  }
}
