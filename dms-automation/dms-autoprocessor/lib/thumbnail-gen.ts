export async function generateThumbnail(
  pdfPath: string,
  filename: string
): Promise<string> {
  // Generate unique thumbnail name based on timestamp
  const timestamp = Date.now();
  const thumbnailName = `auto-${timestamp}.png`;
  const thumbnailPath = `/data/documents/drupal-files/Thumbnails/${thumbnailName}`;
  
  try {
    // Use ImageMagick to convert first page of PDF to PNG
    const command = new Deno.Command("convert", {
      args: [
        "-density", "150",
        `${pdfPath}[0]`, // First page only
        "-quality", "85",
        "-resize", "800x",
        thumbnailPath,
      ],
    });
    
    const { success, stderr } = await command.output();
    
    if (!success) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Thumbnail generation failed: ${error}`);
    }
    
    // Verify file was created
    await Deno.stat(thumbnailPath);
    
    console.log(`     Thumbnail: ${thumbnailName}`);
    return thumbnailName;
    
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    // Return fallback thumbnail
    return "deadbeef.png";
  }
}
