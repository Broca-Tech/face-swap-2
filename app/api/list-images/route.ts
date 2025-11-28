import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET() {
  try {
    // Fetch images from face-swap folder
    const result = await cloudinary.search
      .expression('folder:face-swap AND resource_type:image')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    const images = result.resources.map((resource: any) => ({
      publicId: resource.public_id,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      createdAt: resource.created_at,
    }));

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('List images error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images', details: error.message },
      { status: 500 }
    );
  }
}
