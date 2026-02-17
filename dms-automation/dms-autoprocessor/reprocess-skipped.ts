/**
 * Re-process files that were incorrectly flagged as duplicates
 * by the metadata similarity check.
 *
 * Reads reprocess-duplicates.json and processes each file,
 * only checking for exact filename matches (not metadata similarity).
 */

import { parseFilename } from "./lib/filename-parser.ts";
import { convertForDMS } from "./lib/file-converter.ts";
import { generateThumbnail } from "./lib/thumbnail-gen.ts";
import { moveToStorage } from "./lib/file-manager.ts";
import { insertDrupalRecord, lookupClientByPolicy } from "./lib/mysql-writer.ts";
import { closeDuplicateChecker } from "./lib/duplicate-checker.ts";
import { writeProcessingLog, type BacklogProcessingLog, type FolderProcessingResult, type ProcessedFile } from "./lib/backlog-processor.ts";

const DMS_DOCUMENTS_PATH = "/data/documents/drupal-files/Documents";

interface ReprocessManifest {
  folders: Array<{
    path: string;
    files: string[];
  }>;
}

/**
 * Simple duplicate check — only exact filename match in filesystem or database.
 * No metadata similarity (which was causing false positives).
 */
async function isExactDuplicate(filename: string): Promise<boolean> {
  // Check filesystem
  const targetPath = `${DMS_DOCUMENTS_PATH}/${filename}`;
  try {
    await Deno.stat(targetPath);
    return true; // File physically exists
  } catch {
    // Not found - check case-insensitive
    try {
      for await (const entry of Deno.readDir(DMS_DOCUMENTS_PATH)) {
        if (entry.name.toLowerCase() === filename.toLowerCase()) {
          return true;
        }
      }
    } catch {
      // Directory read error
    }
  }
  return false;
}

async function processFile(folderPath: string, filename: string): Promise<ProcessedFile> {
  const sourcePath = `${folderPath}/${filename}`;
  const parsed = parseFilename(filename);
  const result: ProcessedFile = {
    filename,
    sourcePath,
    status: "error",
    parsed,
  };

  try {
    // Check if source file still exists on NAS
    try {
      await Deno.stat(sourcePath);
    } catch {
      result.status = "error";
      result.error = "Source file no longer exists on NAS";
      return result;
    }

    // Only check exact filename duplicate (not metadata similarity)
    if (await isExactDuplicate(filename)) {
      result.status = "duplicate";
      result.error = "Exact filename already exists in DMS";
      return result;
    }

    // Parse filename
    if (!parsed.parseSuccess) {
      result.status = "queued";
      result.error = parsed.parseError;

      const thumbnailPath = await generateThumbnail(sourcePath);
      const storagePath = await moveToStorage(sourcePath, filename);

      result.fid = await insertDrupalRecord({
        filename,
        policyNumber: "UNKNOWN",
        documentType: "AUTOMATED - Needs Review",
        suggestedType: parsed.documentTypeLabel || "Unknown",
        confidence: 0,
        client: "Unknown",
        thumbnailPath,
        filePath: storagePath,
      });
      return result;
    }

    // Convert if needed
    const conversion = await convertForDMS(sourcePath, "/tmp/dms-convert");
    const fileToProcess = conversion.success ? conversion.outputPath : sourcePath;

    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(fileToProcess);

    // Look up client
    const clientName = await lookupClientByPolicy(parsed.policyNumber!) || "Unknown";

    // Copy to storage
    const finalFilename = conversion?.success && conversion.convertedFrom !== parsed.extension
      ? filename.replace(/\.[^.]+$/, "." + conversion.outputPath.split(".").pop()!)
      : filename;

    const storagePath = await moveToStorage(fileToProcess, finalFilename);

    // Insert into database
    result.fid = await insertDrupalRecord({
      filename: finalFilename,
      policyNumber: parsed.policyNumber!,
      documentType: parsed.documentTypeLabel || "Unknown",
      suggestedType: parsed.documentTypeLabel || "Unknown",
      confidence: 100,
      client: clientName,
      thumbnailPath,
      filePath: storagePath,
    });

    result.status = "success";
    console.log(`     SUCCESS: FID ${result.fid}`);

    // Cleanup converted file
    if (conversion?.success && conversion.outputPath !== sourcePath) {
      try {
        await Deno.remove(conversion.outputPath);
      } catch { /* ignore */ }
    }
  } catch (error: any) {
    result.status = "error";
    result.error = error.message || String(error);
    console.error(`     ERROR: ${result.error}`);
  }

  return result;
}

// Main
console.log("=" .repeat(60));
console.log("RE-PROCESSING METADATA-SIMILAR 'DUPLICATES'");
console.log("These files were incorrectly skipped by the similarity check.");
console.log("Only exact filename matches will be treated as duplicates.");
console.log("=".repeat(60));

// Read manifest
const manifestText = await Deno.readTextFile("/app/reprocess-duplicates.json");
const manifest: ReprocessManifest = JSON.parse(manifestText);

const totalFiles = manifest.folders.reduce((sum, f) => sum + f.files.length, 0);
console.log(`\nFolders: ${manifest.folders.length}`);
console.log(`Files to re-process: ${totalFiles}\n`);

const allResults: FolderProcessingResult[] = [];
let globalProcessed = 0;
let globalDuplicates = 0;
let globalQueued = 0;
let globalErrors = 0;

for (let i = 0; i < manifest.folders.length; i++) {
  const folder = manifest.folders[i];
  const folderDate = folder.path.match(/(\d{2}-\d{2}-\d{4})/)?.[1] || "unknown";

  console.log(`[${i + 1}/${manifest.folders.length}] ${folderDate} (${folder.files.length} files)`);

  const folderResult: FolderProcessingResult = {
    folderPath: folder.path,
    folderDate,
    startTime: new Date(),
    totalFiles: folder.files.length,
    processed: 0,
    duplicates: 0,
    queued: 0,
    errors: 0,
    files: [],
  };

  for (let j = 0; j < folder.files.length; j++) {
    const filename = folder.files[j];
    console.log(`  [${j + 1}/${folder.files.length}] ${filename}`);

    const fileResult = await processFile(folder.path, filename);
    folderResult.files.push(fileResult);

    switch (fileResult.status) {
      case "success": folderResult.processed++; break;
      case "duplicate": folderResult.duplicates++; break;
      case "queued": folderResult.queued++; break;
      case "error": folderResult.errors++; break;
    }
  }

  folderResult.endTime = new Date();
  allResults.push(folderResult);

  globalProcessed += folderResult.processed;
  globalDuplicates += folderResult.duplicates;
  globalQueued += folderResult.queued;
  globalErrors += folderResult.errors;
}

// Write log
const runId = `reprocess-${new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)}`;
const log: BacklogProcessingLog = {
  runId,
  startTime: allResults[0]?.startTime || new Date(),
  endTime: new Date(),
  folders: allResults,
  summary: {
    totalFolders: allResults.length,
    totalFiles: totalFiles,
    processed: globalProcessed,
    duplicates: globalDuplicates,
    queued: globalQueued,
    errors: globalErrors,
  },
};

await writeProcessingLog(log);
await closeDuplicateChecker();

console.log(`\n${"=".repeat(60)}`);
console.log("RE-PROCESSING COMPLETE");
console.log(`${"=".repeat(60)}`);
console.log(`  Total Files: ${totalFiles}`);
console.log(`  Processed: ${globalProcessed}`);
console.log(`  True Duplicates: ${globalDuplicates}`);
console.log(`  Queued for Review: ${globalQueued}`);
console.log(`  Errors: ${globalErrors}`);
