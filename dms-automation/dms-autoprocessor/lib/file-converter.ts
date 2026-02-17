/**
 * File Converter for DMS Processing
 *
 * Converts .msg (Outlook email) and .txt files to PDF for universal viewing.
 * Also handles .heic image conversion to jpeg.
 */

const TEMP_DIR = "/tmp/dms-convert";

/**
 * Ensure temp directory exists
 */
async function ensureTempDir(): Promise<void> {
  try {
    await Deno.mkdir(TEMP_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

/**
 * Convert a text file to PDF using LibreOffice or simple text-to-pdf
 */
async function convertTextToPdf(inputPath: string, outputPath: string): Promise<boolean> {
  await ensureTempDir();

  try {
    // Read the text content
    const textContent = await Deno.readTextFile(inputPath);

    // Create a simple HTML wrapper for better PDF rendering
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      padding: 20px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
${escapeHtml(textContent)}
</body>
</html>`;

    // Write temporary HTML file
    const tempHtml = `${TEMP_DIR}/temp_${Date.now()}.html`;
    await Deno.writeTextFile(tempHtml, htmlContent);

    // Try to convert using wkhtmltopdf or LibreOffice
    let success = false;

    // Try wkhtmltopdf first
    try {
      const cmd = new Deno.Command("wkhtmltopdf", {
        args: ["--quiet", "--page-size", "Letter", tempHtml, outputPath],
      });
      const result = await cmd.output();
      success = result.code === 0;
    } catch {
      // wkhtmltopdf not available
    }

    // If wkhtmltopdf failed, try LibreOffice
    if (!success) {
      try {
        const cmd = new Deno.Command("libreoffice", {
          args: [
            "--headless",
            "--convert-to", "pdf",
            "--outdir", TEMP_DIR,
            tempHtml,
          ],
        });
        const result = await cmd.output();
        if (result.code === 0) {
          // Move the converted file to output path
          const convertedPath = tempHtml.replace(".html", ".pdf");
          await Deno.rename(convertedPath, outputPath);
          success = true;
        }
      } catch {
        // LibreOffice not available
      }
    }

    // If both failed, create a simple text-based PDF using ImageMagick
    if (!success) {
      try {
        const cmd = new Deno.Command("convert", {
          args: [
            "-size", "612x792",
            "xc:white",
            "-font", "Courier",
            "-pointsize", "10",
            "-fill", "black",
            "-annotate", "+36+36",
            textContent.substring(0, 3000), // Limit text length
            outputPath,
          ],
        });
        const result = await cmd.output();
        success = result.code === 0;
      } catch {
        // ImageMagick convert not available
      }
    }

    // Clean up temp file
    try {
      await Deno.remove(tempHtml);
    } catch {
      // Ignore cleanup errors
    }

    return success;
  } catch (error) {
    console.error("Text to PDF conversion error:", error);
    return false;
  }
}

/**
 * Convert an Outlook .msg file to PDF
 *
 * MSG files are complex OLE compound documents. We'll extract text content
 * and convert to PDF.
 */
async function convertMsgToPdf(inputPath: string, outputPath: string): Promise<boolean> {
  await ensureTempDir();

  try {
    // Try using msgconvert (from Email::Outlook::Message perl module) if available
    try {
      const tempEml = `${TEMP_DIR}/temp_${Date.now()}.eml`;

      const cmd = new Deno.Command("msgconvert", {
        args: ["--outfile", tempEml, inputPath],
      });
      const result = await cmd.output();

      if (result.code === 0) {
        // Read EML and convert to text, then to PDF
        const emlContent = await Deno.readTextFile(tempEml);
        const tempTxt = `${TEMP_DIR}/temp_${Date.now()}.txt`;
        await Deno.writeTextFile(tempTxt, emlContent);
        const success = await convertTextToPdf(tempTxt, outputPath);

        // Cleanup
        try {
          await Deno.remove(tempEml);
          await Deno.remove(tempTxt);
        } catch {
          // Ignore cleanup errors
        }

        return success;
      }
    } catch {
      // msgconvert not available
    }

    // Fallback: Try to extract text directly from MSG using strings command
    try {
      const cmd = new Deno.Command("strings", {
        args: ["-e", "l", inputPath], // Little-endian unicode strings
      });
      const result = await cmd.output();

      if (result.code === 0) {
        const extractedText = new TextDecoder().decode(result.stdout);

        // Filter out binary garbage and keep readable text
        const cleanedText = extractedText
          .split("\n")
          .filter(line => line.length > 3 && /[a-zA-Z]{3,}/.test(line))
          .join("\n");

        const tempTxt = `${TEMP_DIR}/temp_${Date.now()}.txt`;
        await Deno.writeTextFile(tempTxt, cleanedText || "Could not extract text from MSG file");

        const success = await convertTextToPdf(tempTxt, outputPath);

        try {
          await Deno.remove(tempTxt);
        } catch {
          // Ignore cleanup errors
        }

        return success;
      }
    } catch {
      // strings command failed
    }

    // Last resort: create a placeholder PDF
    const placeholderText = `MSG File: ${inputPath}\n\nThis file could not be automatically converted.\nPlease view the original .msg file in Outlook.`;
    const tempTxt = `${TEMP_DIR}/temp_${Date.now()}.txt`;
    await Deno.writeTextFile(tempTxt, placeholderText);
    const success = await convertTextToPdf(tempTxt, outputPath);

    try {
      await Deno.remove(tempTxt);
    } catch {
      // Ignore cleanup errors
    }

    return success;
  } catch (error) {
    console.error("MSG to PDF conversion error:", error);
    return false;
  }
}

/**
 * Convert HEIC image to JPEG using ImageMagick
 */
async function convertHeicToJpeg(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("convert", {
      args: [inputPath, outputPath],
    });
    const result = await cmd.output();
    return result.code === 0;
  } catch (error) {
    console.error("HEIC to JPEG conversion error:", error);
    return false;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface ConversionResult {
  success: boolean;
  outputPath: string;
  originalPath: string;
  convertedFrom: string;
  error?: string;
}

/**
 * Convert a file to a DMS-compatible format if needed
 *
 * Returns the path to use (either original or converted)
 */
export async function convertForDMS(
  inputPath: string,
  outputDir: string
): Promise<ConversionResult> {
  const filename = inputPath.split("/").pop() || "unknown";
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const baseName = filename.replace(/\.[^.]+$/, "");

  // Determine if conversion is needed
  const needsConversion = ["msg", "txt", "heic"].includes(extension);

  if (!needsConversion) {
    return {
      success: true,
      outputPath: inputPath,
      originalPath: inputPath,
      convertedFrom: extension,
    };
  }

  let outputPath: string;
  let success = false;

  switch (extension) {
    case "msg":
      outputPath = `${outputDir}/${baseName}.pdf`;
      success = await convertMsgToPdf(inputPath, outputPath);
      break;

    case "txt":
      outputPath = `${outputDir}/${baseName}.pdf`;
      success = await convertTextToPdf(inputPath, outputPath);
      break;

    case "heic":
      outputPath = `${outputDir}/${baseName}.jpg`;
      success = await convertHeicToJpeg(inputPath, outputPath);
      break;

    default:
      return {
        success: false,
        outputPath: inputPath,
        originalPath: inputPath,
        convertedFrom: extension,
        error: `Unknown conversion type: ${extension}`,
      };
  }

  return {
    success,
    outputPath: success ? outputPath : inputPath,
    originalPath: inputPath,
    convertedFrom: extension,
    error: success ? undefined : `Conversion from ${extension} failed`,
  };
}

/**
 * Check if required conversion tools are available
 */
export async function checkConversionTools(): Promise<{
  wkhtmltopdf: boolean;
  libreoffice: boolean;
  imagemagick: boolean;
  msgconvert: boolean;
}> {
  const results = {
    wkhtmltopdf: false,
    libreoffice: false,
    imagemagick: false,
    msgconvert: false,
  };

  // Check wkhtmltopdf
  try {
    const cmd = new Deno.Command("which", { args: ["wkhtmltopdf"] });
    const result = await cmd.output();
    results.wkhtmltopdf = result.code === 0;
  } catch {
    // Not available
  }

  // Check LibreOffice
  try {
    const cmd = new Deno.Command("which", { args: ["libreoffice"] });
    const result = await cmd.output();
    results.libreoffice = result.code === 0;
  } catch {
    // Not available
  }

  // Check ImageMagick
  try {
    const cmd = new Deno.Command("which", { args: ["convert"] });
    const result = await cmd.output();
    results.imagemagick = result.code === 0;
  } catch {
    // Not available
  }

  // Check msgconvert
  try {
    const cmd = new Deno.Command("which", { args: ["msgconvert"] });
    const result = await cmd.output();
    results.msgconvert = result.code === 0;
  } catch {
    // Not available
  }

  return results;
}
