import { extractPolicyNumber } from "./policy-parser.ts";
import { ocrDocument as extractText } from "./ocr-service.ts";
import { classifyDocument } from "./ai-classifier.ts";
import { generateThumbnail } from "./thumbnail-gen.ts";
import { moveToStorage } from "./file-manager.ts";
import { insertDrupalRecord as insertDocument, lookupClientByPolicy } from "./mysql-writer.ts";
import { logProcessedFile } from "./folder-scanner.ts";

export interface ProcessingResult {
  totalFiles: number;
  processed: number;
  failed: number;
  errors: string[];
}

export interface FileProcessingProgress {
  current: number;
  total: number;
  currentFile: string;
  status: 'processing' | 'completed' | 'error';
}

// Process specific files from a folder
export async function processSelectedFiles(
  folderPath: string,
  filenames: string[],
  onProgress?: (progress: FileProcessingProgress) => void
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    totalFiles: filenames.length,
    processed: 0,
    failed: 0,
    errors: [],
  };

  console.log(`📂 Processing ${filenames.length} selected files from: ${folderPath}`);

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    const filePath = `${folderPath}/${filename}`;

    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: filenames.length,
        currentFile: filename,
        status: 'processing',
      });
    }

    console.log(`\n📄 [${i + 1}/${filenames.length}] Processing: ${filename}`);

    try {
      // Check file exists
      await Deno.stat(filePath);

      // 1. OCR extraction
      console.log("  🔍 OCR extraction...");
      const ocrText = await extractText(filePath);

      // 2. Extract policy number
      console.log("  🔢 Extracting policy number...");
      const policyNumber = extractPolicyNumber(ocrText, filename);

      if (!policyNumber) {
        throw new Error("Could not extract policy number");
      }

      console.log(`     Policy: ${policyNumber}`);

      // 3. Classify document
      console.log("  🤖 Classifying document...");
      const classification = await classifyDocument(ocrText, filename);
      console.log(`     Type: ${classification.type} (${classification.confidence}%)`);

      // 4. Generate thumbnail
      console.log("  🖼️  Generating thumbnail...");
      const thumbnailPath = await generateThumbnail(filePath);
      console.log(`     Thumbnail: ${thumbnailPath}`);

      // 5. Look up client name from existing records
      console.log("  👤 Looking up client...");
      const existingClient = await lookupClientByPolicy(policyNumber);
      const clientName = existingClient || "Unknown";
      if (existingClient) {
        console.log(`     Client found: ${existingClient}`);
      } else {
        console.log("     No existing client match");
      }

      // 6. Copy file to Documents folder
      console.log("  📁 Copying to documents...");
      const newPath = await moveToStorage(filePath, filename);

      // 7. Insert into database
      console.log("  💾 Writing to database...");
      const fid = await insertDocument({
        filename,
        policyNumber,
        documentType: "AUTOMATED - Needs Review",
        suggestedType: classification.type,
        confidence: classification.confidence,
        client: clientName,
        thumbnailPath,
        filePath: newPath,
      });

      // 8. Log to processing log
      await logProcessedFile(folderPath, filename, fid, 'completed');

      result.processed++;
      console.log("  ✅ Success!");

    } catch (error: any) {
      result.failed++;
      const errorMsg = `${filename}: ${error.message}`;
      result.errors.push(errorMsg);
      console.error(`❌ Failed: ${errorMsg}`);

      // Log error to processing log
      await logProcessedFile(folderPath, filename, 0, 'error', error.message);
    }
  }

  console.log("\n📊 Processing Summary:");
  console.log(`   Total: ${result.totalFiles}`);
  console.log(`   Processed: ${result.processed}`);
  console.log(`   Failed: ${result.failed}`);

  return result;
}

export async function processCompanyFolder(customPath?: string): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    totalFiles: 0,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Determine folder path
  let folderPath: string;
  if (customPath) {
    folderPath = customPath;
  } else {
    // Default: today's folder
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    const folderName = `${month}-${day}-${year}`;
    folderPath = `/mnt/nas/Company/${folderName}`;
  }

  console.log(`📂 Processing folder: ${folderPath}`);

  try {
    // Check if folder exists
    await Deno.stat(folderPath);
  } catch {
    return {
      ...result,
      errors: [`Folder not found: ${folderPath}`]
    };
  }

  // Process all PDFs in folder
  for await (const entry of Deno.readDir(folderPath)) {
    if (!entry.name.toLowerCase().endsWith('.pdf')) continue;

    result.totalFiles++;
    const filePath = `${folderPath}/${entry.name}`;

    console.log(`\n📄 Processing: ${entry.name}`);

    try {
      // 1. OCR extraction
      console.log("  🔍 OCR extraction...");
      const ocrText = await extractText(filePath);

      // 2. Extract policy number
      console.log("  🔢 Extracting policy number...");
      const policyNumber = extractPolicyNumber(ocrText, entry.name);
      
      if (!policyNumber) {
        throw new Error("Could not extract policy number");
      }

      console.log(`     Policy: ${policyNumber}`);

      // 3. Classify document
      console.log("  🤖 Classifying document...");
      const classification = await classifyDocument(ocrText, entry.name);
      console.log(`     Type: ${classification.type} (${classification.confidence}%)`);

      // 4. Generate thumbnail
      console.log("  🖼️  Generating thumbnail...");
      const thumbnailPath = await generateThumbnail(filePath);
      console.log(`     Thumbnail: ${thumbnailPath}`);

      // 5. Look up client name from existing records
      console.log("  👤 Looking up client...");
      const existingClient = await lookupClientByPolicy(policyNumber);
      const clientName = existingClient || "Unknown";
      if (existingClient) {
        console.log(`     Client found: ${existingClient}`);
      } else {
        console.log("     No existing client match");
      }

      // 6. Copy file to Documents folder
      console.log("  📁 Copying to documents...");
      const newPath = await moveToStorage(filePath, entry.name);

      // 7. Insert into database
      console.log("  💾 Writing to database...");
      await insertDocument({
        filename: entry.name,
        policyNumber,
        documentType: "AUTOMATED - Needs Review",
        suggestedType: classification.type,
        confidence: classification.confidence,
        client: clientName,
        thumbnailPath,
        filePath: newPath,
      });

      result.processed++;
      console.log("  ✅ Success!");

    } catch (error: any) {
      result.failed++;
      const errorMsg = `${entry.name}: ${error.message}`;
      result.errors.push(errorMsg);
      console.error(`❌ Failed: ${errorMsg}`);
    }
  }

  console.log("\n📊 Processing Summary:");
  console.log(`   Total: ${result.totalFiles}`);
  console.log(`   Processed: ${result.processed}`);
  console.log(`   Failed: ${result.failed}`);

  return result;
}
