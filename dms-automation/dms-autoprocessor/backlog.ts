/**
 * Backlog Processing CLI Entry Point
 *
 * Usage:
 *   deno run --allow-all backlog.ts test              # Test with single folder
 *   deno run --allow-all backlog.ts test /path/folder # Test with specific folder
 *   deno run --allow-all backlog.ts 2026              # Process all 2026 folders
 *   deno run --allow-all backlog.ts 2025              # Process all 2025 Archive folders
 *   deno run --allow-all backlog.ts all               # Process everything
 */

import {
  testProcessing,
  processBacklog,
  getDailyFolders,
} from "./lib/backlog-processor.ts";

async function main() {
  const args = Deno.args;
  const command = args[0] || "help";

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     DMS Backlog Processor - Company Folder Import          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  switch (command) {
    case "test": {
      const folderPath = args[1];
      console.log("Running TEST mode...\n");
      await testProcessing(folderPath);
      break;
    }

    case "2026": {
      console.log("Processing all 2026 folders...\n");
      const folders = await getDailyFolders("2026");
      console.log(`Found ${folders.length} folders to process\n`);
      await processBacklog(folders);
      break;
    }

    case "2025": {
      console.log("Processing all 2025 Archive folders...\n");
      const folders = await getDailyFolders("2025");
      console.log(`Found ${folders.length} folders to process\n`);
      await processBacklog(folders);
      break;
    }

    case "all": {
      console.log("Processing ALL folders (2026 first, then 2025)...\n");
      const folders2026 = await getDailyFolders("2026");
      const folders2025 = await getDailyFolders("2025");
      const allFolders = [...folders2026, ...folders2025];
      console.log(`Found ${allFolders.length} total folders to process`);
      console.log(`  - 2026: ${folders2026.length} folders`);
      console.log(`  - 2025: ${folders2025.length} folders\n`);
      await processBacklog(allFolders);
      break;
    }

    case "list": {
      console.log("Listing available folders...\n");
      const folders2026 = await getDailyFolders("2026");
      const folders2025 = await getDailyFolders("2025");

      console.log("2026 Folders:");
      folders2026.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

      console.log("\n2025 Archive Folders:");
      folders2025.slice(0, 10).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      if (folders2025.length > 10) {
        console.log(`  ... and ${folders2025.length - 10} more`);
      }
      break;
    }

    case "help":
    default:
      console.log("Usage:");
      console.log("  deno run --allow-all backlog.ts <command> [options]");
      console.log("");
      console.log("Commands:");
      console.log("  test [folder]  - Test with a single folder (default: 01-02-2026)");
      console.log("  2026           - Process all 2026 daily folders");
      console.log("  2025           - Process all 2025 Archive folders");
      console.log("  all            - Process everything (2026 first, then 2025)");
      console.log("  list           - List available folders");
      console.log("  help           - Show this help message");
      break;
  }
}

main().catch(console.error);
