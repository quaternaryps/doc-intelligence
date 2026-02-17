import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

export interface FolderInfo {
  path: string;
  name: string;
  fileCount: number;
  lastModified: Date;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modifiedDate: Date;
  isProcessed: boolean;
}

export interface FolderTreeNode {
  type: 'root' | 'folder';
  name: string;
  path: string;
  children?: FolderTreeNode[];
  fileCount?: number;
  lastModified?: Date;
}

async function getMysqlClient(): Promise<Client> {
  return await new Client().connect({
    hostname: Deno.env.get("MYSQL_HOST") || "docman-mariadb",
    port: parseInt(Deno.env.get("MYSQL_PORT") || "3306"),
    username: Deno.env.get("MYSQL_USER") || "drupaluser",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
    db: Deno.env.get("MYSQL_DATABASE") || "drupal",
  });
}

// Ensure processing log table exists
export async function ensureProcessingLogTable(): Promise<void> {
  const client = await getMysqlClient();
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS dms_processing_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_path VARCHAR(500) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'completed',
        fid INT NULL,
        error_message TEXT NULL,
        UNIQUE KEY unique_source (source_path, filename)
      )
    `);
  } finally {
    await client.close();
  }
}

// Check if file was already processed
async function getProcessedFiles(folderPath: string): Promise<Set<string>> {
  const client = await getMysqlClient();
  try {
    const results = await client.query(
      `SELECT filename FROM dms_processing_log WHERE source_path = ? AND status = 'completed'`,
      [folderPath]
    );
    return new Set(results.map((r: any) => r.filename));
  } finally {
    await client.close();
  }
}

// Log a processed file
export async function logProcessedFile(
  sourcePath: string,
  filename: string,
  fid: number,
  status: 'completed' | 'error' = 'completed',
  errorMessage?: string
): Promise<void> {
  const client = await getMysqlClient();
  try {
    await client.execute(
      `INSERT INTO dms_processing_log (source_path, filename, fid, status, error_message)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         fid = VALUES(fid),
         status = VALUES(status),
         error_message = VALUES(error_message),
         processed_at = CURRENT_TIMESTAMP`,
      [sourcePath, filename, fid, status, errorMessage || null]
    );
  } finally {
    await client.close();
  }
}

// Get processing metrics
export async function getProcessingMetrics(daysBack: number = 30) {
  const client = await getMysqlClient();
  try {
    const results = await client.query(`
      SELECT
        DATE(processed_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
      FROM dms_processing_log
      WHERE processed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(processed_at)
      ORDER BY date DESC
    `, [daysBack]);
    return results;
  } finally {
    await client.close();
  }
}

export async function listCompanyFolders(daysBack: number = 14): Promise<FolderInfo[]> {
  const basePath = "/mnt/nas_company";
  const folders: FolderInfo[] = [];
  
  try {
    const today = new Date();
    const cutoffDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    for await (const entry of Deno.readDir(basePath)) {
      if (!entry.isDirectory) continue;
      
      // Parse folder name (MM-DD-YYYY)
      const match = entry.name.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!match) continue;
      
      const [_, month, day, year] = match;
      const folderDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Filter by date range
      if (folderDate < cutoffDate || folderDate > today) continue;
      
      const folderPath = `${basePath}/${entry.name}`;
      
      // Count PDF files
      let fileCount = 0;
      try {
        for await (const file of Deno.readDir(folderPath)) {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            fileCount++;
          }
        }
      } catch {
        fileCount = 0;
      }
      
      const stat = await Deno.stat(folderPath);
      
      folders.push({
        path: folderPath,
        name: entry.name,
        fileCount,
        lastModified: stat.mtime || new Date(),
      });
    }
    
    // Sort by date (newest first)
    folders.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    
    return folders;
  } catch (error) {
    console.error("Error listing folders:", error);
    return [];
  }
}

export async function listScannerFolders(): Promise<FolderInfo[]> {
  const basePath = "/mnt/nas_share";
  const folders: FolderInfo[] = [];
  
  try {
    for await (const entry of Deno.readDir(basePath)) {
      if (!entry.isDirectory) continue;
      
      const folderPath = `${basePath}/${entry.name}`;
      
      // Count PDF files
      let fileCount = 0;
      try {
        for await (const file of Deno.readDir(folderPath)) {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            fileCount++;
          }
        }
      } catch {
        fileCount = 0;
      }
      
      const stat = await Deno.stat(folderPath);
      
      folders.push({
        path: folderPath,
        name: entry.name,
        fileCount,
        lastModified: stat.mtime || new Date(),
      });
    }
    
    return folders;
  } catch (error) {
    console.error("Error listing scanner folders:", error);
    return [];
  }
}

export function validatePath(path: string): boolean {
  const allowedBases = ["/mnt/nas_company", "/mnt/nas_share"];
  return allowedBases.some(base => path.startsWith(base));
}

// Get unified folder tree (Scanner + Company)
export async function getUnifiedFolderTree(daysBack: number = 30): Promise<FolderTreeNode[]> {
  const tree: FolderTreeNode[] = [];

  // Scanner folders
  const scannerFolders = await listScannerFolders();
  tree.push({
    type: 'root',
    name: 'Scanner',
    path: '/mnt/nas/Scanner',
    children: scannerFolders.map(f => ({
      type: 'folder' as const,
      name: f.name,
      path: f.path,
      fileCount: f.fileCount,
      lastModified: f.lastModified,
    })),
  });

  // Company folders (expanded date range)
  const companyFolders = await listCompanyFolders(daysBack);
  tree.push({
    type: 'root',
    name: 'Company',
    path: '/mnt/nas_company',
    children: companyFolders.map(f => ({
      type: 'folder' as const,
      name: f.name,
      path: f.path,
      fileCount: f.fileCount,
      lastModified: f.lastModified,
    })),
  });

  return tree;
}

// List files in a folder with processed status
export async function listFolderFiles(
  folderPath: string,
  maxAgeDays: number = 30
): Promise<FileInfo[]> {
  if (!validatePath(folderPath)) {
    throw new Error("Invalid path");
  }

  const files: FileInfo[] = [];
  const processedFiles = await getProcessedFiles(folderPath);
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  try {
    for await (const entry of Deno.readDir(folderPath)) {
      // Only PDF and image files
      const ext = entry.name.toLowerCase();
      if (!ext.endsWith('.pdf') && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg') && !ext.endsWith('.png')) {
        continue;
      }

      const filePath = `${folderPath}/${entry.name}`;

      try {
        const stat = await Deno.stat(filePath);
        const modifiedDate = stat.mtime || new Date();

        // Filter by date (1 month window)
        if (modifiedDate < cutoffDate) {
          continue;
        }

        files.push({
          path: filePath,
          name: entry.name,
          size: stat.size,
          modifiedDate,
          isProcessed: processedFiles.has(entry.name),
        });
      } catch {
        // Skip files we can't stat
      }
    }

    // Sort by date (newest first)
    files.sort((a, b) => b.modifiedDate.getTime() - a.modifiedDate.getTime());

    return files;
  } catch (error) {
    console.error(`Error listing files in ${folderPath}:`, error);
    return [];
  }
}
