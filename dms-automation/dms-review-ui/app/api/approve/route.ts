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

async function ensureApprovalLogTable(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS dms_approval_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fid INT NOT NULL,
      filename VARCHAR(512),
      policy_number VARCHAR(255),
      client_name VARCHAR(255),
      document_type VARCHAR(255),
      approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_approved_at (approved_at),
      INDEX idx_policy (policy_number),
      INDEX idx_fid (fid)
    )
  `)
}

export async function POST(request: NextRequest) {
  let conn = null

  try {
    const body = await request.json()
    const { fid, policyNumber, client, documentType } = body

    if (!fid || !policyNumber || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    conn = await getConnection()

    // Ensure audit log table exists
    await ensureApprovalLogTable(conn)

    // Get the filename for the audit log
    const [rows] = await conn.execute(
      `SELECT filename FROM file_managed WHERE fid = ?`,
      [fid]
    ) as any[]
    const filename = rows.length > 0 ? rows[0].filename : 'unknown'

    // Update document fields
    await conn.execute(
      `UPDATE field_data_field_policy
       SET field_policy_value = ?
       WHERE entity_id = ?`,
      [policyNumber, fid]
    )

    await conn.execute(
      `UPDATE field_data_field_type
       SET field_type_value = ?
       WHERE entity_id = ?`,
      [documentType, fid]
    )

    await conn.execute(
      `UPDATE field_data_field_client
       SET field_client_value = ?
       WHERE entity_id = ?`,
      [client, fid]
    )

    // Write audit log entry
    await conn.execute(
      `INSERT INTO dms_approval_log (fid, filename, policy_number, client_name, document_type)
       VALUES (?, ?, ?, ?, ?)`,
      [fid, filename, policyNumber, client || '', documentType]
    )

    await conn.end()

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Approval error:', error)
    if (conn) await conn.end()
    return NextResponse.json(
      { error: 'Failed to approve document' },
      { status: 500 }
    )
  }
}
