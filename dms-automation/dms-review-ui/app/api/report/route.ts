import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

async function getConnection() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'docman-mariadb',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'drupaluser',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'drupal',
  })
  return connection
}

export async function GET(request: NextRequest) {
  let conn = null

  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    conn = await getConnection()

    // Daily summary counts
    const [summary] = await conn.execute(
      `SELECT
         DATE(approved_at) as date,
         COUNT(*) as total_approved
       FROM dms_approval_log
       WHERE approved_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(approved_at)
       ORDER BY date DESC`,
      [days]
    ) as any[]

    // Detailed records grouped by date
    const [details] = await conn.execute(
      `SELECT
         DATE(approved_at) as date,
         TIME(approved_at) as time,
         fid,
         filename,
         policy_number,
         client_name,
         document_type
       FROM dms_approval_log
       WHERE approved_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY approved_at DESC`,
      [days]
    ) as any[]

    // Group details by date
    const grouped: Record<string, any[]> = {}
    for (const row of details) {
      const dateKey = row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push({
        time: row.time,
        fid: row.fid,
        filename: row.filename,
        policyNumber: row.policy_number,
        client: row.client_name,
        documentType: row.document_type,
      })
    }

    await conn.end()

    return NextResponse.json({
      days,
      summary,
      reportByDate: grouped,
    })

  } catch (error) {
    console.error('Report error:', error)
    if (conn) await conn.end()
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
