import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const LOGS_PATH = '/data/documents/drupal-files/Documents'

export async function GET(request: NextRequest) {
  const logId = request.nextUrl.searchParams.get('id')

  try {
    if (logId) {
      // Return specific log file
      const logPath = join(LOGS_PATH, `backlog-${logId}.json`)
      const content = await readFile(logPath, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    }

    // Return list of available logs
    const files = await readdir(LOGS_PATH)
    const logs = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const match = f.match(/backlog-(.+)\.json/)
        return match ? match[1] : null
      })
      .filter(Boolean)
      .sort()
      .reverse() // Most recent first

    return NextResponse.json({ logs })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ logs: [], message: 'No logs found yet' })
    }
    console.error('Backlog logs error:', error)
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 })
  }
}
