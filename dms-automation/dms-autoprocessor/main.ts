import { Hono } from "https://deno.land/x/hono@v4.0.0/mod.ts";
import { cors } from "https://deno.land/x/hono@v4.0.0/middleware.ts";
import { processCompanyFolder, processSelectedFiles } from "./lib/file-processor.ts";
import { getProcessingStats } from "./lib/stats.ts";
import { processFolder, getDailyFolders, writeProcessingLog, type BacklogProcessingLog } from "./lib/backlog-processor.ts";
import { closeDuplicateChecker } from "./lib/duplicate-checker.ts";
import {
  listCompanyFolders,
  listScannerFolders,
  validatePath,
  getUnifiedFolderTree,
  listFolderFiles,
  ensureProcessingLogTable,
  getProcessingMetrics,
} from "./lib/folder-scanner.ts";

const app = new Hono();

// Enable CORS for frontend
app.use("/*", cors());

// Initialize database table on startup
ensureProcessingLogTable().catch(console.error);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "dms-autoprocessor"
  });
});

// List available folders for browse
app.get("/folders/company", async (c) => {
  const daysBack = parseInt(c.req.query("days") || "14");
  const folders = await listCompanyFolders(daysBack);
  return c.json({ folders });
});

app.get("/folders/scanner", async (c) => {
  const folders = await listScannerFolders();
  return c.json({ folders });
});

// Manual trigger for processing
app.post("/process", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const customPath = body.path;
    
    console.log("⚡ Manual processing triggered");
    
    if (customPath) {
      if (!validatePath(customPath)) {
        return c.json({ success: false, error: "Invalid path" }, 400);
      }
      console.log(`📂 Processing custom path: ${customPath}`);
    }
    
    const result = await processCompanyFolder(customPath);
    
    return c.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("❌ Processing error:", error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Get processing statistics
app.get("/stats", async (c) => {
  const stats = await getProcessingStats();
  return c.json(stats);
});

// NEW: Unified folder tree (Scanner + Company)
app.get("/folders/tree", async (c) => {
  const daysBack = parseInt(c.req.query("days") || "30");
  const tree = await getUnifiedFolderTree(daysBack);
  return c.json({ tree });
});

// NEW: List files in a specific folder
app.get("/folders/files", async (c) => {
  const folderPath = c.req.query("path");
  const maxAgeDays = parseInt(c.req.query("maxAge") || "30");

  if (!folderPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  if (!validatePath(folderPath)) {
    return c.json({ error: "Invalid path" }, 400);
  }

  try {
    const files = await listFolderFiles(folderPath, maxAgeDays);
    return c.json({ files, folderPath });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// NEW: Process selected files
app.post("/process/selected", async (c) => {
  try {
    const body = await c.req.json();
    const { folderPath, filenames } = body;

    if (!folderPath || !Array.isArray(filenames) || filenames.length === 0) {
      return c.json({ error: "folderPath and filenames array are required" }, 400);
    }

    if (!validatePath(folderPath)) {
      return c.json({ error: "Invalid path" }, 400);
    }

    console.log(`⚡ Processing ${filenames.length} selected files from: ${folderPath}`);

    const result = await processSelectedFiles(folderPath, filenames);

    return c.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("❌ Processing error:", error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// NEW: Get processing metrics
app.get("/metrics", async (c) => {
  const daysBack = parseInt(c.req.query("days") || "30");
  const metrics = await getProcessingMetrics(daysBack);
  return c.json({ metrics });
});

// NEW: Process a Company folder using the backlog processor (filename-first parsing)
app.post("/process/company-folder", async (c) => {
  try {
    const body = await c.req.json();
    const { folderPath } = body;

    if (!folderPath) {
      return c.json({ error: "folderPath is required" }, 400);
    }

    if (!validatePath(folderPath)) {
      return c.json({ error: "Invalid path" }, 400);
    }

    console.log(`Processing Company folder: ${folderPath}`);

    const result = await processFolder(folderPath);

    // Write log
    const runId = `manual-${new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)}`;
    const log: BacklogProcessingLog = {
      runId,
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

    return c.json({
      success: true,
      runId,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Company folder processing error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// NEW: List available Company daily folders
app.get("/folders/company-daily", async (c) => {
  const year = c.req.query("year") || "2026";
  try {
    const folders = await getDailyFolders(year as "2026" | "2025");
    return c.json({
      year,
      count: folders.length,
      folders: folders.map(f => {
        const match = f.match(/(\d{2}-\d{2}-\d{4})/);
        return { path: f, date: match ? match[1] : "unknown" };
      }),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`🚀 DMS Auto-processor API running on port ${port}`);
console.log(`📊 Health: http://localhost:${port}/health`);
console.log(`📁 Folders: GET http://localhost:${port}/folders/company`);
console.log(`⚡ Manual trigger: POST http://localhost:${port}/process`);
console.log(`📈 Stats: http://localhost:${port}/stats`);

Deno.serve({ port }, app.fetch);
