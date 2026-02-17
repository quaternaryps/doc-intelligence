import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const LOGS_PATH = '/data/documents/drupal-files/Documents'

async function getConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'docman-mariadb',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'drupaluser',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'drupal',
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')
  let conn = null

  try {
    conn = await getConnection()

    // 1. Total documents in DMS by source
    const [totalDocs] = await conn.execute(
      `SELECT COUNT(*) AS total FROM file_managed WHERE status = 1`
    ) as any[]

    // 2. Documents added by automation (AI suggestions present)
    const [automatedDocs] = await conn.execute(
      `SELECT COUNT(DISTINCT fm.fid) AS total
       FROM file_managed fm
       INNER JOIN field_data_field_ai_suggestion ai ON ai.entity_id = fm.fid
       WHERE fm.status = 1`
    ) as any[]

    // 3. Documents approved through review UI
    const [approvedDocs] = await conn.execute(
      `SELECT COUNT(*) AS total FROM dms_approval_log`
    ) as any[]

    // 4. Daily volume for the past N days
    const [dailyVolume] = await conn.execute(
      `SELECT DATE(FROM_UNIXTIME(fm.timestamp)) AS date, COUNT(*) AS count
       FROM file_managed fm
       WHERE fm.status = 1
         AND fm.timestamp >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ? DAY))
       GROUP BY DATE(FROM_UNIXTIME(fm.timestamp))
       ORDER BY date ASC`,
      [days]
    ) as any[]

    // 5. Document type distribution
    const [docTypes] = await conn.execute(
      `SELECT ft.field_type_value AS docType, COUNT(*) AS count
       FROM field_data_field_type ft
       INNER JOIN file_managed fm ON fm.fid = ft.entity_id AND ft.entity_type = 'file'
       WHERE fm.status = 1 AND ft.field_type_value IS NOT NULL AND ft.field_type_value != ''
       GROUP BY ft.field_type_value
       ORDER BY count DESC
       LIMIT 20`
    ) as any[]

    // 6. Recent approvals (last 20)
    const [recentApprovals] = await conn.execute(
      `SELECT fid, filename, policy_number, client_name, document_type, approved_at
       FROM dms_approval_log
       ORDER BY approved_at DESC
       LIMIT 20`
    ) as any[]

    // 7. Read backlog processing logs summary
    let backlogRuns: any[] = []
    try {
      const files = await readdir(LOGS_PATH)
      const logFiles = files
        .filter(f => f.startsWith('backlog-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 10) // Last 10 runs

      for (const file of logFiles) {
        try {
          const content = await readFile(join(LOGS_PATH, file), 'utf-8')
          const log = JSON.parse(content)
          backlogRuns.push({
            runId: log.runId,
            startTime: log.startTime,
            endTime: log.endTime,
            foldersProcessed: log.summary?.totalFolders || 0,
            totalFiles: log.summary?.totalFiles || 0,
            processed: log.summary?.processed || 0,
            duplicates: log.summary?.duplicates || 0,
            queued: log.summary?.queued || 0,
            errors: log.summary?.errors || 0,
          })
        } catch {
          // Skip unreadable log files
        }
      }
    } catch {
      // No logs directory or no logs yet
    }

    // 8. Needs-review count (documents with "AUTOMATED - Needs Review" type)
    const [needsReview] = await conn.execute(
      `SELECT COUNT(*) AS total
       FROM field_data_field_type ft
       INNER JOIN file_managed fm ON fm.fid = ft.entity_id AND ft.entity_type = 'file'
       WHERE fm.status = 1 AND ft.field_type_value = 'AUTOMATED - Needs Review'`
    ) as any[]

    await conn.end()

    return NextResponse.json({
      overview: {
        totalDocuments: totalDocs[0]?.total || 0,
        automatedDocuments: automatedDocs[0]?.total || 0,
        approvedDocuments: approvedDocs[0]?.total || 0,
        needsReview: needsReview[0]?.total || 0,
      },
      dailyVolume: dailyVolume.map((row: any) => ({
        date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
        count: row.count,
      })),
      documentTypes: docTypes.map((row: any) => ({
        type: row.docType,
        count: row.count,
      })),
      recentApprovals: recentApprovals.map((row: any) => ({
        fid: row.fid,
        filename: row.filename,
        policyNumber: row.policy_number,
        client: row.client_name,
        documentType: row.document_type,
        approvedAt: row.approved_at,
      })),
      backlogRuns,
      days,
    })
  } catch (error: any) {
    console.error('Governance API error:', error)
    if (conn) await conn.end()
    return NextResponse.json({ error: 'Failed to load governance data: ' + error.message }, { status: 500 })
  }
}
