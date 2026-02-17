// Azure Document Intelligence OCR
// Requires: AZURE_OCR_ENDPOINT and AZURE_OCR_KEY environment variables

export async function ocrDocument(pdfPath: string): Promise<string> {
  const azureEndpoint = Deno.env.get("AZURE_OCR_ENDPOINT");
  const azureKey = Deno.env.get("AZURE_OCR_KEY");
  
  // Fallback: Simple text extraction if Azure not configured
  if (!azureEndpoint || !azureKey) {
    console.warn("⚠️  Azure OCR not configured, using fallback extraction");
    return fallbackTextExtraction(pdfPath);
  }
  
  try {
    // Read PDF file
    const fileData = await Deno.readFile(pdfPath);
    
    // Call Azure Document Intelligence
    const response = await fetch(
      `${azureEndpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "Ocp-Apim-Subscription-Key": azureKey,
        },
        body: fileData,
      }
    );
    
    if (!response.ok) {
      throw new Error(`Azure OCR failed: ${response.statusText}`);
    }
    
    // Get operation location
    const operationLocation = response.headers.get("Operation-Location");
    if (!operationLocation) {
      throw new Error("No operation location returned");
    }
    
    // Poll for results
    let result;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
        },
      });
      
      result = await resultResponse.json();
      
      if (result.status === "succeeded") {
        break;
      }
      if (result.status === "failed") {
        throw new Error("OCR processing failed");
      }
    }
    
    // Extract text
    const pages = result.analyzeResult.pages || [];
    const extractedText = pages
      .map((page: any) => 
        page.lines?.map((line: any) => line.content).join("\n") || ""
      )
      .join("\n\n");
    
    return extractedText;
    
  } catch (error) {
    console.error("Azure OCR error:", error);
    return fallbackTextExtraction(pdfPath);
  }
}

async function fallbackTextExtraction(pdfPath: string): Promise<string> {
  // Simple fallback: Use pdftotext if available
  try {
    const command = new Deno.Command("pdftotext", {
      args: ["-layout", pdfPath, "-"],
      stdout: "piped",
    });
    
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout);
  } catch {
    // Ultimate fallback: Return filename for policy extraction
    const filename = pdfPath.split("/").pop() || "";
    return `Filename: ${filename}\n[OCR not available]`;
  }
}
