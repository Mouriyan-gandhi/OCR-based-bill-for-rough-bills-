import { NextResponse } from "next/server";
import openai, { MODEL } from "@/lib/openai";

const EXTRACTION_PROMPT = `You are an expert document processor specializing in invoices, rough bills, and receipts — including handwritten ones.

Analyze the provided image carefully. Since rough bills and invoices do not all follow the same format, you must dynamically read whatever fields and column structures exist on the bill.

Extract ALL visible information into the following dynamic JSON structure.

{
  "core_fields": {
    "vendor_name": "Main business/vendor/shop name",
    "customer_name": "Customer/buyer name if visible",
    "date": "Transaction date in YYYY-MM-DD format if found",
    "invoice_number": "Invoice/bill record number if found",
    "subtotal": 0.00,
    "tax": 0.00,
    "discount": 0.00,
    "total": 0.00
  },
  "additional_fields": [
    { "label": "Vehicle No", "value": "MH12AB1234" },
    { "label": "Agent", "value": "Rahul" },
    { "label": "Phone", "value": "9876543210" },
    { "label": "Address", "value": "..." }
    // ... Any other key-value pairs you find on the header or footer
  ],
  "items_headers": ["Column 1", "Column 2", "Column 3"], // e.g. ["Description", "Size", "Pieces", "Weight", "Rate", "Amount"]
  "items": [
    // Create objects where keys are the exact items_headers strings. 
    // Example: { "Description": "Screws", "Pieces": 50, "Rate": 2.50, "Amount": 125.00 }
  ],
  "notes": "Any additional notes, amount in words, or terms",
  "confidence": {
    "overall": 0.85
  }
}

Rules:
1. Return ONLY valid JSON — no markdown.
2. Ensure the dynamically created keys in the "items" array exactly match the string values in "items_headers".
3. Use null for core_fields if not found. Do not invent data.
4. Normalize currency to numbers (remove ₹, $, Rs., etc).
5. For handwritten text, do your best to read it and mention lower overall confidence.`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Call GPT-4o Vision via GitHub Models
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    const rawText = response.choices[0]?.message?.content || "";

    // Parse the JSON response
    let extractedData;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        rawText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
      extractedData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      // If parsing fails, try a more aggressive cleanup
      try {
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        extractedData = JSON.parse(cleaned);
      } catch {
        return NextResponse.json({
          error: "Failed to parse extraction results",
          rawText: rawText,
        }, { status: 422 });
      }
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
      processingTime: Date.now(),
    });

  } catch (error) {
    console.error("Processing error:", error);
    return NextResponse.json({
      error: error.message || "Processing failed",
      details: error.toString(),
    }, { status: 500 });
  }
}
