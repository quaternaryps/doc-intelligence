import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'docman-mariadb',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'drupaluser',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'drupal',
  })
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.length < 2) {
    return NextResponse.json({ clients: [] })
  }

  let conn = null

  try {
    conn = await getConnection()

    // Search existing client names and count associated documents
    const [rows] = await conn.execute(
      `SELECT
         field_client_value AS name,
         COUNT(*) AS count
       FROM field_data_field_client
       WHERE field_client_value LIKE ?
         AND field_client_value != ''
         AND field_client_value != 'Unknown'
       GROUP BY field_client_value
       ORDER BY count DESC, field_client_value
       LIMIT 20`,
      [`%${q}%`]
    ) as any[]

    await conn.end()
    return NextResponse.json({ clients: rows })

  } catch (error) {
    console.error('Client autocomplete error:', error)
    if (conn) await conn.end()
    return NextResponse.json({ clients: [] })
  }
}
