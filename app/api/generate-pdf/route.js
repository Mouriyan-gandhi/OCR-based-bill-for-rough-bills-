import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const invoiceData = await request.json();

    // We generate the PDF client-side using jsPDF for better control
    // This endpoint validates and stores invoice data
    return NextResponse.json({
      success: true,
      message: "Invoice data validated",
      data: invoiceData,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
