import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const body = await request.json();
  const { sourceImageUrl, faceLandmarks } = body;

  const AKOOL_API_KEY = process.env.AKOOL_API_KEY;

  // Default source image if not provided
  // Note: Image must be accessible from AKOOL's servers (some CDNs like imgur may block)
  const imageUrl = sourceImageUrl || "https://d21ksh0k4smeql.cloudfront.net/crop_1695201165222-7514-0-1695201165485-8149.png";

  if (!AKOOL_API_KEY) {
    return NextResponse.json({ error: 'AKOOL_API_KEY is missing' }, { status: 500 });
  }

  try {
    // Step 1: If no face landmarks provided, detect them first
    let opts = faceLandmarks;

    if (!opts) {
      console.log("Detecting face landmarks for:", imageUrl);

      const detectResponse = await axios.post(
        'https://sg3.akool.com/detect',
        {
          single_face: true,
          image_url: imageUrl,
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

      // landmarks_str is a string like "262,175:363,175:313,215:312,279"
      if (!detectResponse.data.landmarks_str) {
        return NextResponse.json({
          error: 'No face detected in the image',
          details: detectResponse.data,
        }, { status: 400 });
      }

      // Use the landmarks string directly
      opts = detectResponse.data.landmarks_str;
    }

    // Step 2: Create the face swap session
    // IMPORTANT: We DON'T send our own channel/uid. AKOOL creates the Agora channel
    // and returns credentials for us to join.
    const payload = {
      sourceImage: [
        {
          path: imageUrl,
          opts: opts, // Face landmarks in format "x1,y1:x2,y2:x3,y3:x4,y4"
        }
      ],
    };

    console.log("Sending payload to Akool:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://openapi.akool.com/api/open/v3/faceswap/live/create',
      payload,
      {
        headers: {
          'x-api-key': AKOOL_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("Akool Create Response:", JSON.stringify(response.data, null, 2));

    // The response contains Agora credentials we need to use:
    // - channel_id: The Agora channel to join
    // - front_user_id: The user ID to use when joining
    // - front_rtc_token: The Agora token for authentication
    // - app_id: The Agora App ID (may be empty, use your own if so)
    // - _id: Session ID for status polling and closing
    // - faceswap_status: 1=queued, 2=ready for connection, 3=success, 4=failed

    if (response.data.code !== 1000) {
      return NextResponse.json({
        error: 'Failed to create face swap session',
        details: response.data,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sessionId: response.data.data._id,
      status: response.data.data.faceswap_status,
      agora: {
        channelId: response.data.data.channel_id,
        userId: response.data.data.front_user_id,
        token: response.data.data.front_rtc_token,
        appId: response.data.data.app_id || process.env.NEXT_PUBLIC_AGORA_APP_ID,
        algorithmUserId: response.data.data.algorithm_user_id,
      },
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
