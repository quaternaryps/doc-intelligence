/**
 * DMS Auto-processor Cron Service
 *
 * Runs nightly at 10 PM to process today's Company folder files.
 * Also supports manual triggering via RUN_ON_STARTUP env var.
 */

import {
  processBacklog,
  getDailyFolders,
  processFolder,
  writeProcessingLog,
  type BacklogProcessingLog,
} from "./lib/backlog-processor.ts";
import { closeDuplicateChecker } from "./lib/duplicate-checker.ts";

const SCHEDULE_HOUR = 22; // 10 PM
const SCHEDULE_MINUTE = 0;

/**
 * Get today's Company folder path
 */
function getTodayFolderPath(): string {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `/mnt/nas_company/${mm}-${dd}-${yyyy}`;
}

/**
 * Process today's Company folder
 */
async function processToday(): Promise<void> {
  const folderPath = getTodayFolderPath();
  const runId = `nightly-${new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)}`;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`NIGHTLY PROCESSING: ${new Date().toLocaleString()}`);
  console.log(`Folder: ${folderPath}`);
  console.log(`${"=".repeat(60)}`);

  try {
    // Check if folder exists
    await Deno.stat(folderPath);
  } catch {
    console.log(`No folder found for today: ${folderPath}`);
    console.log("Nothing to process. Will try again tomorrow.");
    return;
  }

  try {
    const result = await processFolder(folderPath);

    // Write log
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

    console.log(`\nNightly processing complete.`);
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Duplicates: ${result.duplicates}`);
    console.log(`  Queued for review: ${result.queued}`);
    console.log(`  Errors: ${result.errors}`);
  } catch (error) {
    console.error("Nightly processing failed:", error);
  }
}

/**
 * Schedule the next run
 */
function scheduleDaily(): void {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);

  // If it's past scheduled time today, schedule for tomorrow
  if (now > scheduledTime) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const msUntilRun = scheduledTime.getTime() - now.getTime();
  const hoursUntil = Math.round(msUntilRun / 1000 / 60 / 60 * 10) / 10;

  console.log(`Next run: ${scheduledTime.toLocaleString()} (in ${hoursUntil} hours)`);

  setTimeout(async () => {
    console.log(`\nStarting scheduled processing at ${new Date().toISOString()}`);

    try {
      await processToday();
    } catch (error) {
      console.error("Scheduled processing failed:", error);
    }

    // Schedule next run
    scheduleDaily();
  }, msUntilRun);
}

// Main
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║     DMS Auto-processor Cron Service                       ║");
console.log(`║     Scheduled: Daily at ${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, "0")}                              ║`);
console.log("╚════════════════════════════════════════════════════════════╝\n");

// Optional: Run on startup for testing
const runOnStartup = Deno.env.get("RUN_ON_STARTUP") === "true";
if (runOnStartup) {
  console.log("RUN_ON_STARTUP=true: Running initial processing...\n");
  await processToday();
}

// Start scheduler
scheduleDaily();

// Keep process alive
console.log("Cron service started and waiting...\n");
await new Promise(() => {});
