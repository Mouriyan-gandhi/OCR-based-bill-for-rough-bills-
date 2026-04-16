import { NextResponse } from "next/server";
import openai, { MODEL } from "@/lib/openai";

const EXTRACTION_PROMPT = `You are an expert document processor specializing in invoices, bills, and receipts — including handwritten ones.

Analyze the provided image carefully and extract ALL visible information into the following JSON structure. Be thorough — capture every line item, every number, every detail.

{
  "vendor_name": "Business/vendor name",
  "vendor_address": "Full address if visible",
  "vendor_phone": "Phone number if visible",
  "vendor_email": "Email if visible",
  "vendor_gst": "GST/Tax ID if visible",
  "customer_name": "Customer/buyer name if visible",
  "customer_address": "Customer address if visible",
  "date": "Transaction date in YYYY-MM-DD format",
  "invoice_number": "Invoice/bill number",
  "items": [
    {
      "name": "Item description",
      "quantity": 1,
      "unit": "pcs/kg/ltr etc",
      "price": 0.00,
      "amount": 0.00
    }
  ],
  "subtotal": 0.00,
  "discount": 0.00,
  "tax_details": [
    {
      "type": "CGST/SGST/IGST/VAT/GST",
      "rate": "percentage",
      "amount": 0.00
    }
  ],
  "tax": 0.00,
  "total": 0.00,
  "amount_in_words": "Total in words if visible",
  "payment_method": "Cash/Card/UPI/Bank Transfer if visible",
  "notes": "Any additional notes or terms",
  "confidence": {
    "vendor_name": 0.95,
    "date": 0.90,
    "invoice_number": 0.85,
    "items": 0.80,
    "total": 0.90,
    "overall": 0.85
  }
}

Rules:
1. Return ONLY valid JSON — no markdown, no explanation.
2. For handwritten text, do your best to read it and note lower confidence.
3. If a field is not visible, use null.
4. Calculate subtotal/total if not explicitly shown but items are listed.
5. Normalize currency to numbers (remove ₹, $, Rs. etc).
6. Confidence scores: 0.0 (no idea) to 1.0 (perfectly clear).
7. Parse dates to YYYY-MM-DD from any format.
8. If multiple languages are present, extract in English where possible.`;

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
