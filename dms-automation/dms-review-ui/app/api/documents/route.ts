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
  const searchParams = request.nextUrl.searchParams
  const filter = searchParams.get('filter') || 'automated'
  
  let conn = null
  
  try {
    conn = await getConnection()
    
    let whereClause = ''
    if (filter === 'automated') {
      whereClause = "WHERE t.field_type_value LIKE 'AUTOMATED%'"
    } else if (filter === 'errors') {
      whereClause = "WHERE t.field_type_value LIKE '%ERROR%' OR p.field_policy_value IS NULL"
    }
    
    const [rows] = await conn.execute(`
      SELECT 
        fm.fid,
        fm.filename,
        fm.timestamp,
        p.field_policy_value as policyNumber,
        t.field_type_value as documentType,
        c.field_client_value as client,
        ai.field_ai_suggestion_value as suggestedType,
        ai.field_ai_suggestion_confidence as confidence,
        ai.field_ai_thumbnail_path as thumbnailPath
      FROM file_managed fm
      LEFT JOIN field_data_field_policy p ON fm.fid = p.entity_id
      LEFT JOIN field_data_field_type t ON fm.fid = t.entity_id
      LEFT JOIN field_data_field_client c ON fm.fid = c.entity_id
      LEFT JOIN field_data_field_ai_suggestion ai ON fm.fid = ai.entity_id
      ${whereClause}
      ORDER BY fm.timestamp DESC
      LIMIT 200
    `)
    
    const documents = (rows as any[]).map(row => ({
      fid: row.fid,
      filename: row.filename,
      policyNumber: row.policyNumber || 'UNKNOWN',
      documentType: row.documentType || 'AUTOMATED',
      suggestedType: row.suggestedType || '',
      confidence: row.confidence || 0,
      client: row.client || 'Unknown',
      timestamp: new Date(row.timestamp * 1000).toISOString(),
      thumbnailPath: row.thumbnailPath || 'deadbeef.png',
    }))
    
    await conn.end()
    
    return NextResponse.json({ documents })
    
  } catch (error) {
    console.error('Database error:', error)
    if (conn) await conn.end()
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}
