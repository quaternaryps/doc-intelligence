// AI document classification using Azure OpenAI or similar

interface Classification {
  documentType: string;
  confidence: number;
  client?: string;
  notes?: string;
}

const DOCUMENT_TYPES = [
  "ACE Offer",
  "ADDRESS CHANGE",
  "AGENCY LETTER",
  "Ace Review",
  "Appraisal",
  "Appraisal request",
  "Appraisal invoice",
  "AUTHORIZATION",
  "AUTO DECLARATION",
  "BI Demand",
  "BI Evaluation",
  "BI offer letter",
  "BUSINESS LICENSE",
  "Bill of Sale",
  "CERT OF LIABILITY",
  "CERTIFICATE OF COMPLETION",
  "CERTIFICATE OF LIABILITY REQUEST",
  "CHARGE BACK",
  "CLAIM FILE",
  "COURT LETTER",
  "Cancelation Request",
  "Cancellation notice",
  "Cancellation request",
  "Change Request",
  "Check Image",
  "Claim Payment Request - Appraisal",
  "Claim Payment Request - BI",
  "Claim Payment Request - Investigation Fee",
  "Claim Payment Request - Property Damage",
  "Claim payment request-Legal Fees",
  "Claimant estimate",
  "Claimant's Documents",
  "Correspondence",
  "Endorsement",
  "Letter of Guarantee",
  "MVR",
  "Test",
];

export async function classifyDocument(
  ocrText: string,
  filename: string
): Promise<Classification> {
  const azureEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT");
  const azureKey = Deno.env.get("AZURE_OPENAI_KEY");
  
  // Fallback: Rule-based classification
  if (!azureEndpoint || !azureKey) {
    return ruleBasedClassification(ocrText, filename);
  }
  
  try {
    const prompt = `You are a document classifier for an insurance company.

Given the following document text and filename, classify the document type and extract the client name if present.

Available document types:
${DOCUMENT_TYPES.join(", ")}

Filename: ${filename}

Document text (first 500 chars):
${ocrText.substring(0, 500)}

Respond ONLY with valid JSON in this exact format:
{
  "documentType": "one of the available types",
  "confidence": 85,
  "client": "extracted client name or null",
  "notes": "brief reasoning"
}`;

    const response = await fetch(
      `${azureEndpoint}/openai/deployments/gpt-4/chat/completions?api-version=2023-05-15`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": azureKey,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a document classification assistant." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`AI classification failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    const content = result.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const classification = JSON.parse(jsonMatch[0]);
      return {
        documentType: classification.documentType || "Unknown",
        confidence: classification.confidence || 50,
        client: classification.client,
        notes: classification.notes,
      };
    }
    
    throw new Error("Could not parse AI response");
    
  } catch (error) {
    console.error("AI classification error:", error);
    return ruleBasedClassification(ocrText, filename);
  }
}

function ruleBasedClassification(ocrText: string, filename: string): Classification {
  const text = `${filename} ${ocrText}`.toLowerCase();
  
  // Simple keyword matching
  const rules = [
    { keywords: ["endo", "endorsement"], type: "Endorsement", confidence: 80 },
    { keywords: ["mvr", "motor vehicle"], type: "MVR", confidence: 85 },
    { keywords: ["appraisal", "estimate"], type: "Appraisal", confidence: 75 },
    { keywords: ["claim file", "claim"], type: "CLAIM FILE", confidence: 70 },
    { keywords: ["certificate", "cert of"], type: "CERT OF LIABILITY", confidence: 75 },
    { keywords: ["letter of guarantee", "log"], type: "Letter of Guarantee", confidence: 80 },
    { keywords: ["correspondence", "letter"], type: "Correspondence", confidence: 60 },
    { keywords: ["cancel"], type: "Cancellation notice", confidence: 70 },
    { keywords: ["payment", "check"], type: "Claim Payment Request", confidence: 65 },
  ];
  
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return {
          documentType: rule.type,
          confidence: rule.confidence,
          notes: `Matched keyword: ${keyword}`,
        };
      }
    }
  }
  
  return {
    documentType: "Correspondence",
    confidence: 40,
    notes: "No clear match, defaulting to Correspondence",
  };
}
