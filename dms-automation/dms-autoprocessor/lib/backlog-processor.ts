/**
 * Backlog Processor for Company Folder Documents
 *
 * Processes historical files from the NAS Company folder and imports them
 * into the Document Management System.
 */

import { parseFilename, ParsedFilename } from "./filename-parser.ts";
import { checkDuplicate, DuplicateCheckResult, closeDuplicateChecker } from "./duplicate-checker.ts";
import { convertForDMS, ConversionResult, checkConversionTools } from "./file-converter.ts";
import { generateThumbnail } from "./thumbnail-gen.ts";
import { moveToStorage } from "./file-manager.ts";
import { insertDrupalRecord, lookupClientByPolicy } from "./mysql-writer.ts";

const NAS_COMPANY_PATH = "/mnt/nas_company";
const LOGS_PATH = "/data/documents/drupal-files/Documents";

export interface ProcessedFile {
  filename: string;
  sourcePath: string;
  status: "success" | "duplicate" | "queued" | "error";
  parsed: ParsedFilename;
  duplicateCheck?: DuplicateCheckResult;
  conversion?: ConversionResult;
  fid?: number;
  error?: string;
}

export interface FolderProcessingResult {
  folderPath: string;
  folderDate: string;
  startTime: Date;
  endTime?: Date;
  totalFiles: number;
  processed: number;
  duplicates: number;
  queued: number;
  errors: number;
  files: ProcessedFile[];
}

export interface BacklogProcessingLog {
  runId: string;
  startTime: Date;
  endTime?: Date;
  folders: FolderProcessingResult[];
  summary: {
    totalFolders: number;
    totalFiles: number;
    processed: number;
    duplicates: number;
    queued: number;
    errors: number;
  };
}

/**
 * Get list of daily folders to process
 */
export async function getDailyFolders(year: "2026" | "2025"): Promise<string[]> {
  const folders: string[] = [];

  if (year === "2026") {
    // Current 2026 folders directly under nas_company
    for await (const entry of Deno.readDir(NAS_COMPANY_PATH)) {
      if (entry.isDirectory && /^\d{2}-\d{2}-2026$/.test(entry.name)) {
        folders.push(`${NAS_COMPANY_PATH}/${entry.name}`);
      }
    }
  } else if (year === "2025") {
    // 2025 Archive folders
    const archivePath = `${NAS_COMPANY_PATH}/2025 Archive`;
    try {
      for await (const entry of Deno.readDir(archivePath)) {
        if (entry.isDirectory && /^\d{2}-\d{2}-2025$/.test(entry.name)) {
          folders.push(`${archivePath}/${entry.name}`);
        }
      }
    } catch (error) {
      console.error("Error reading 2025 Archive:", error);
    }
  }

  // Sort folders chronologically
  folders.sort((a, b) => {
    const dateA = extractFolderDate(a);
    const dateB = extractFolderDate(b);
    return dateA.localeCompare(dateB);
  });

  return folders;
}

/**
 * Extract date from folder path for sorting
 */
function extractFolderDate(folderPath: string): string {
  const match = folderPath.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (match) {
    // Convert MM-DD-YYYY to YYYY-MM-DD for proper sorting
    return `${match[3]}-${match[1]}-${match[2]}`;
  }
  return "";
}

/**
 * Get list of files in a folder
 */
export async function getFilesInFolder(folderPath: string): Promise<string[]> {
  const files: string[] = [];
  const validExtensions = ["pdf", "jpg", "jpeg", "png", "heic", "txt", "msg"];

  try {
    for await (const entry of Deno.readDir(folderPath)) {
      if (!entry.isFile) continue;

      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (ext && validExtensions.includes(ext)) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error);
  }

  return files;
}

/**
 * Process a single file
 */
async function processFile(
  folderPath: string,
  filename: string
): Promise<ProcessedFile> {
  const sourcePath = `${folderPath}/${filename}`;
  const result: ProcessedFile = {
    filename,
    sourcePath,
    status: "error",
    parsed: parseFilename(filename),
  };

  try {
    // Step 1: Parse filename
    console.log(`     Parsing: ${filename}`);

    if (!result.parsed.parseSuccess) {
      // Can't identify policy number - send to review queue
      result.status = "queued";
      result.error = result.parsed.parseError;

      // Still insert into DMS but mark for review
      const thumbnailPath = await generateThumbnail(sourcePath);
      const storagePath = await moveToStorage(sourcePath, filename);

      result.fid = await insertDrupalRecord({
        filename,
        policyNumber: "UNKNOWN",
        documentType: "AUTOMATED - Needs Review",
        suggestedType: result.parsed.documentTypeLabel || "Unknown",
        confidence: 0,
        client: "Unknown",
        thumbnailPath,
        filePath: storagePath,
      });

      return result;
    }

    // Step 2: Check for duplicates
    console.log(`     Checking duplicates...`);
    result.duplicateCheck = await checkDuplicate(
      filename,
      result.parsed.policyNumber || undefined,
      result.parsed.documentType || undefined,
      result.parsed.dateCode || undefined
    );

    if (result.duplicateCheck.isDuplicate) {
      result.status = "duplicate";
      console.log(`     DUPLICATE: ${result.duplicateCheck.message}`);
      return result;
    }

    // Step 3: Convert file if needed (msg, txt, heic)
    console.log(`     Converting if needed...`);
    result.conversion = await convertForDMS(sourcePath, "/tmp/dms-convert");

    const fileToProcess = result.conversion.success
      ? result.conversion.outputPath
      : sourcePath;

    // Step 4: Generate thumbnail
    console.log(`     Generating thumbnail...`);
    const thumbnailPath = await generateThumbnail(fileToProcess);

    // Step 5: Look up client by policy number
    console.log(`     Looking up client...`);
    const clientName = await lookupClientByPolicy(result.parsed.policyNumber!) || "Unknown";

    // Step 6: Copy to DMS storage
    console.log(`     Copying to storage...`);
    const finalFilename = result.conversion?.success && result.conversion.convertedFrom !== result.parsed.extension
      ? filename.replace(/\.[^.]+$/, result.conversion.outputPath.split(".").pop()!)
      : filename;

    const storagePath = await moveToStorage(fileToProcess, finalFilename);

    // Step 7: Insert into database
    console.log(`     Inserting into database...`);
    result.fid = await insertDrupalRecord({
      filename: finalFilename,
      policyNumber: result.parsed.policyNumber!,
      documentType: result.parsed.documentTypeLabel || "Unknown",
      suggestedType: result.parsed.documentTypeLabel || "Unknown",
      confidence: 100, // High confidence since parsed from filename
      client: clientName,
      thumbnailPath,
      filePath: storagePath,
    });

    result.status = "success";
    console.log(`     SUCCESS: FID ${result.fid}`);

    // Cleanup converted file if different from source
    if (result.conversion?.success && result.conversion.outputPath !== sourcePath) {
      try {
        await Deno.remove(result.conversion.outputPath);
      } catch {
        // Ignore cleanup errors
      }
    }

  } catch (error: any) {
    result.status = "error";
    result.error = error.message || String(error);
    console.error(`     ERROR: ${result.error}`);
  }

  return result;
}

/**
 * Process a single folder
 */
export async function processFolder(folderPath: string): Promise<FolderProcessingResult> {
  const folderDate = folderPath.match(/(\d{2}-\d{2}-\d{4})/)?.[1] || "unknown";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing folder: ${folderPath}`);
  console.log(`${"=".repeat(60)}`);

  const result: FolderProcessingResult = {
    folderPath,
    folderDate,
    startTime: new Date(),
    totalFiles: 0,
    processed: 0,
    duplicates: 0,
    queued: 0,
    errors: 0,
    files: [],
  };

  const files = await getFilesInFolder(folderPath);
  result.totalFiles = files.length;

  console.log(`Found ${files.length} files to process\n`);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    console.log(`[${i + 1}/${files.length}] ${filename}`);

    const fileResult = await processFile(folderPath, filename);
    result.files.push(fileResult);

    switch (fileResult.status) {
      case "success":
        result.processed++;
        break;
      case "duplicate":
        result.duplicates++;
        break;
      case "queued":
        result.queued++;
        break;
      case "error":
        result.errors++;
        break;
    }
  }

  result.endTime = new Date();

  console.log(`\nFolder Summary: ${folderDate}`);
  console.log(`  Total: ${result.totalFiles}`);
  console.log(`  Processed: ${result.processed}`);
  console.log(`  Duplicates: ${result.duplicates}`);
  console.log(`  Queued for Review: ${result.queued}`);
  console.log(`  Errors: ${result.errors}`);

  return result;
}

/**
 * Write processing log to file
 */
export async function writeProcessingLog(log: BacklogProcessingLog): Promise<string> {
  const logFilename = `backlog-${log.runId}.json`;
  const logPath = `${LOGS_PATH}/${logFilename}`;

  // Ensure logs directory exists
  try {
    await Deno.mkdir(LOGS_PATH, { recursive: true });
  } catch {
    // Directory may exist
  }

  await Deno.writeTextFile(logPath, JSON.stringify(log, null, 2));

  // Also write a summary CSV for easy viewing
  const csvPath = `${LOGS_PATH}/backlog-${log.runId}.csv`;
  const csvLines = [
    "Folder,Filename,Status,PolicyNumber,DocType,Date,FID,Error",
  ];

  for (const folder of log.folders) {
    for (const file of folder.files) {
      csvLines.push([
        folder.folderDate,
        file.filename,
        file.status,
        file.parsed.policyNumber || "",
        file.parsed.documentType || "",
        file.parsed.dateFormatted || "",
        file.fid?.toString() || "",
        (file.error || "").replace(/,/g, ";"),
      ].join(","));
    }
  }

  await Deno.writeTextFile(csvPath, csvLines.join("\n"));

  return logPath;
}

/**
 * Process multiple folders and generate log
 */
export async function processBacklog(
  folders: string[],
  onProgress?: (current: number, total: number, folder: string) => void
): Promise<BacklogProcessingLog> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

  const log: BacklogProcessingLog = {
    runId,
    startTime: new Date(),
    folders: [],
    summary: {
      totalFolders: folders.length,
      totalFiles: 0,
      processed: 0,
      duplicates: 0,
      queued: 0,
      errors: 0,
    },
  };

  // Check conversion tools availability
  console.log("Checking conversion tools...");
  const tools = await checkConversionTools();
  console.log("  wkhtmltopdf:", tools.wkhtmltopdf ? "Available" : "Not found");
  console.log("  LibreOffice:", tools.libreoffice ? "Available" : "Not found");
  console.log("  ImageMagick:", tools.imagemagick ? "Available" : "Not found");
  console.log("  msgconvert:", tools.msgconvert ? "Available" : "Not found");

  for (let i = 0; i < folders.length; i++) {
    const folderPath = folders[i];

    if (onProgress) {
      onProgress(i + 1, folders.length, folderPath);
    }

    const folderResult = await processFolder(folderPath);
    log.folders.push(folderResult);

    // Update summary
    log.summary.totalFiles += folderResult.totalFiles;
    log.summary.processed += folderResult.processed;
    log.summary.duplicates += folderResult.duplicates;
    log.summary.queued += folderResult.queued;
    log.summary.errors += folderResult.errors;

    // Write incremental log after each folder
    await writeProcessingLog(log);
  }

  log.endTime = new Date();

  // Write final log
  const logPath = await writeProcessingLog(log);

  // Cleanup
  await closeDuplicateChecker();

  console.log(`\n${"=".repeat(60)}`);
  console.log("BACKLOG PROCESSING COMPLETE");
  console.log(`${"=".repeat(60)}`);
  console.log(`Log saved to: ${logPath}`);
  console.log(`\nFinal Summary:`);
  console.log(`  Total Folders: ${log.summary.totalFolders}`);
  console.log(`  Total Files: ${log.summary.totalFiles}`);
  console.log(`  Processed: ${log.summary.processed}`);
  console.log(`  Duplicates: ${log.summary.duplicates}`);
  console.log(`  Queued for Review: ${log.summary.queued}`);
  console.log(`  Errors: ${log.summary.errors}`);

  return log;
}

/**
 * Test run with a single folder
 */
export async function testProcessing(folderPath?: string): Promise<FolderProcessingResult> {
  // Default to first 2026 folder
  const testFolder = folderPath || `${NAS_COMPANY_PATH}/01-02-2026`;

  console.log("=== TEST RUN ===");
  console.log(`Testing with folder: ${testFolder}\n`);

  const result = await processFolder(testFolder);

  // Write test log
  const log: BacklogProcessingLog = {
    runId: `test-${Date.now()}`,
    startTime: result.startTime,
    endTime: result.endTime,
    folders: [result],
    summary: {
      totalFolders: 1,
      totalFiles: result.totalFiles,
      processed: result.processed,
      duplicates: result.duplicates,
      queued: result.queued,
      errors: result.errors,
    },
  };

  await writeProcessingLog(log);
  await closeDuplicateChecker();

  return result;
}
