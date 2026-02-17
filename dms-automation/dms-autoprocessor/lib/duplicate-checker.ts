/**
 * Duplicate Checker for DMS Files
 *
 * Checks if a file already exists in the DMS storage before inserting
 * to prevent duplicate entries.
 */

import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const DMS_DOCUMENTS_PATH = "/data/documents/drupal-files/Documents";

let mysqlClient: Client | null = null;

async function getMysqlClient(): Promise<Client> {
  if (mysqlClient) return mysqlClient;

  mysqlClient = await new Client().connect({
    hostname: Deno.env.get("MYSQL_HOST") || "docman-mariadb",
    port: parseInt(Deno.env.get("MYSQL_PORT") || "3306"),
    username: Deno.env.get("MYSQL_USER") || "drupaluser",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
    db: Deno.env.get("MYSQL_DATABASE") || "drupal",
  });

  return mysqlClient;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existsInFilesystem: boolean;
  existsInDatabase: boolean;
  existingFid?: number;
  existingPath?: string;
  message: string;
}

/**
 * Check if a file exists in the DMS filesystem
 */
async function checkFilesystem(filename: string): Promise<{ exists: boolean; path?: string }> {
  const targetPath = `${DMS_DOCUMENTS_PATH}/${filename}`;

  try {
    await Deno.stat(targetPath);
    return { exists: true, path: targetPath };
  } catch {
    // File doesn't exist - also check case-insensitive
    try {
      for await (const entry of Deno.readDir(DMS_DOCUMENTS_PATH)) {
        if (entry.name.toLowerCase() === filename.toLowerCase()) {
          return { exists: true, path: `${DMS_DOCUMENTS_PATH}/${entry.name}` };
        }
      }
    } catch {
      // Directory read failed
    }
    return { exists: false };
  }
}

/**
 * Check if a file exists in the DMS database by filename
 */
async function checkDatabase(filename: string): Promise<{ exists: boolean; fid?: number }> {
  try {
    const client = await getMysqlClient();

    const result = await client.execute(
      `SELECT fid FROM file_managed
       WHERE filename = ? OR filename = ?
       LIMIT 1`,
      [filename, filename.toLowerCase()]
    );

    const rows = result.rows;
    if (rows && rows.length > 0) {
      return { exists: true, fid: (rows[0] as any).fid };
    }

    return { exists: false };
  } catch (error) {
    console.error("Database check error:", error);
    return { exists: false };
  }
}

/**
 * Check if a file with the same policy number, doc type, and date already exists
 */
async function checkByMetadata(
  policyNumber: string,
  documentType: string,
  dateCode: string
): Promise<{ exists: boolean; fid?: number; filename?: string }> {
  try {
    const client = await getMysqlClient();

    // Build a pattern to match similar filenames
    const pattern = `%${policyNumber.toLowerCase()}%${documentType.toLowerCase()}%${dateCode}%`;

    const result = await client.execute(
      `SELECT fm.fid, fm.filename
       FROM file_managed fm
       WHERE LOWER(fm.filename) LIKE ?
       LIMIT 1`,
      [pattern]
    );

    const rows = result.rows;
    if (rows && rows.length > 0) {
      const row = rows[0] as any;
      return { exists: true, fid: row.fid, filename: row.filename };
    }

    return { exists: false };
  } catch (error) {
    console.error("Metadata check error:", error);
    return { exists: false };
  }
}

/**
 * Full duplicate check - checks both filesystem and database
 */
export async function checkDuplicate(
  filename: string,
  policyNumber?: string,
  documentType?: string,
  dateCode?: string
): Promise<DuplicateCheckResult> {
  // Check filesystem first (fastest)
  const fsCheck = await checkFilesystem(filename);

  if (fsCheck.exists) {
    return {
      isDuplicate: true,
      existsInFilesystem: true,
      existsInDatabase: false, // We found it in FS, no need to check DB
      existingPath: fsCheck.path,
      message: `File already exists in filesystem: ${fsCheck.path}`,
    };
  }

  // Check database by exact filename
  const dbCheck = await checkDatabase(filename);

  if (dbCheck.exists) {
    return {
      isDuplicate: true,
      existsInFilesystem: false,
      existsInDatabase: true,
      existingFid: dbCheck.fid,
      message: `File already exists in database with FID: ${dbCheck.fid}`,
    };
  }

  // Note: Metadata similarity check (LIKE pattern) was removed because it produced
  // too many false positives. Files like endo vs endo2 (series variants) are different
  // documents and should not be flagged. Filesystem + exact filename checks are sufficient.

  return {
    isDuplicate: false,
    existsInFilesystem: false,
    existsInDatabase: false,
    message: "No duplicate found",
  };
}

/**
 * Batch check multiple files for duplicates
 */
export async function checkDuplicates(
  files: Array<{
    filename: string;
    policyNumber?: string;
    documentType?: string;
    dateCode?: string;
  }>
): Promise<Map<string, DuplicateCheckResult>> {
  const results = new Map<string, DuplicateCheckResult>();

  for (const file of files) {
    const result = await checkDuplicate(
      file.filename,
      file.policyNumber,
      file.documentType,
      file.dateCode
    );
    results.set(file.filename, result);
  }

  return results;
}

/**
 * Close the MySQL connection
 */
export async function closeDuplicateChecker(): Promise<void> {
  if (mysqlClient) {
    await mysqlClient.close();
    mysqlClient = null;
  }
}
