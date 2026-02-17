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
    return NextResponse.json({ policies: [] })
  }

  let conn = null

  try {
    conn = await getConnection()

    // Search existing policy numbers and join with client names
    // This does a self-referential lookup: find the client associated with each policy
    const [rows] = await conn.execute(
      `SELECT DISTINCT
         p.field_policy_value AS policy,
         COALESCE(c.field_client_value, 'Unknown') AS client
       FROM field_data_field_policy p
       LEFT JOIN field_data_field_client c
         ON c.entity_id = p.entity_id
         AND c.entity_type = p.entity_type
       WHERE p.field_policy_value LIKE ?
         AND p.field_policy_value != ''
         AND c.field_client_value IS NOT NULL
         AND c.field_client_value != ''
         AND c.field_client_value != 'Unknown'
       ORDER BY p.field_policy_value
       LIMIT 20`,
      [`%${q}%`]
    ) as any[]

    // If no results with known clients, try without client filter
    if (rows.length === 0) {
      const [fallbackRows] = await conn.execute(
        `SELECT DISTINCT
           p.field_policy_value AS policy,
           COALESCE(c.field_client_value, 'Unknown') AS client
         FROM field_data_field_policy p
         LEFT JOIN field_data_field_client c
           ON c.entity_id = p.entity_id
           AND c.entity_type = p.entity_type
         WHERE p.field_policy_value LIKE ?
           AND p.field_policy_value != ''
         ORDER BY p.field_policy_value
         LIMIT 20`,
        [`%${q}%`]
      ) as any[]

      await conn.end()
      return NextResponse.json({ policies: fallbackRows })
    }

    await conn.end()
    return NextResponse.json({ policies: rows })

  } catch (error) {
    console.error('Policy autocomplete error:', error)
    if (conn) await conn.end()
    return NextResponse.json({ policies: [] })
  }
}
