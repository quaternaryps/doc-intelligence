export async function moveToStorage(
  sourcePath: string,
  filename: string
): Promise<string> {
  const destDir = "/data/documents/drupal-files/Documents";
  const destPath = `${destDir}/${filename}`;
  
  // Check if file already exists (avoid duplicates)
  try {
    await Deno.stat(destPath);
    // File exists, append timestamp
    const timestamp = Date.now();
    const parts = filename.split(".");
    const ext = parts.pop();
    const base = parts.join(".");
    const newFilename = `${base}_${timestamp}.${ext}`;
    const newDestPath = `${destDir}/${newFilename}`;
    
    await Deno.copyFile(sourcePath, newDestPath);
    return `public://Documents/${newFilename}`;
  } catch {
    // File doesn't exist, copy normally
    await Deno.copyFile(sourcePath, destPath);
    return `public://Documents/${filename}`;
  }
}
