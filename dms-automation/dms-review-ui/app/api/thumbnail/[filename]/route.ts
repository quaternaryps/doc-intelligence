import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const thumbnailPath = join(
      '/data/documents/drupal-files/Thumbnails',
      params.filename
    )
    
    const imageBuffer = await readFile(thumbnailPath)
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
    
  } catch (error) {
    return new NextResponse(null, { status: 404 })
  }
}
