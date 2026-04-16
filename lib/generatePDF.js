import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateInvoicePDF(data) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const primary = [15, 23, 42];       // slate-900
  const accent = [16, 185, 129];      // emerald-500
  const lightGray = [241, 245, 249];  // slate-100
  const darkText = [30, 41, 59];      // slate-800
  const mutedText = [100, 116, 139];  // slate-500

  const core = data.core_fields || {};
  
  // ── Header Band ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Accent stripe
  doc.setFillColor(...accent);
  doc.rect(0, 45, pageWidth, 3, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 20, 28);

  // Invoice number & date on right
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${core.invoice_number || "N/A"}`, pageWidth - 20, 20, { align: "right" });
  doc.text(`Date: ${core.date || "N/A"}`, pageWidth - 20, 28, { align: "right" });

  let y = 60;

  // ── Vendor & Customer Info ──
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("FROM", 20, y);
  doc.text("TO", pageWidth / 2 + 10, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text(core.vendor_name || "Vendor", 20, y);
  doc.text(core.customer_name || "Customer", pageWidth / 2 + 10, y);
  y += 10;

  // ── Additional Fields (Dynamic) ──
  if (data.additional_fields && data.additional_fields.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    
    let leftY = y;
    let rightY = y;
    
    data.additional_fields.forEach((field, i) => {
      // Split evenly into two columns
      if (i % 2 === 0) {
        doc.setFont("helvetica", "bold");
        doc.text(`${field.label}:`, 20, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(field.value.toString(), 20 + doc.getTextWidth(`${field.label}: `), leftY, { maxWidth: pageWidth / 2 - 30 });
        leftY += 6;
      } else {
        doc.setFont("helvetica", "bold");
        doc.text(`${field.label}:`, pageWidth / 2 + 10, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(field.value.toString(), pageWidth / 2 + 10 + doc.getTextWidth(`${field.label}: `), rightY, { maxWidth: pageWidth / 2 - 30 });
        rightY += 6;
      }
    });
    
    y = Math.max(leftY, rightY) + 6;
  }

  y += 4;

  // ── Items Table ──
  const items = data.items || [];
  const headers = data.items_headers || ["Description"];
  
  const tableHead = [["#", ...headers]];
  const tableBody = items.map((item, index) => [
    index + 1,
    ...headers.map(header => {
      const val = item[header];
      // Try to format as currency if the header suggests it's money/rate
      const isNumber = typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)) && val.trim() !== '' && /amount|price|rate|total|value/i.test(header));
      return isNumber ? formatCurrency(val) : (val || "—");
    })
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: darkText,
    },
    alternateRowStyles: {
      fillColor: lightGray,
    },
    margin: { left: 20, right: 20 },
    tableWidth: pageWidth - 40,
  });

  y = doc.lastAutoTable.finalY + 15;

  // ── Totals Section ──
  const totalsX = pageWidth - 90;
  const valuesX = pageWidth - 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedText);

  if (core.subtotal) {
    doc.text("Subtotal", totalsX, y);
    doc.setTextColor(...darkText);
    doc.text(formatCurrency(core.subtotal), valuesX, y, { align: "right" });
    y += 8;
  }

  if (core.discount) {
    doc.setTextColor(...mutedText);
    doc.text("Discount", totalsX, y);
    doc.setTextColor(...darkText);
    doc.text(`-${formatCurrency(core.discount)}`, valuesX, y, { align: "right" });
    y += 8;
  }

  if (core.tax) {
    doc.setTextColor(...mutedText);
    doc.text("Tax", totalsX, y);
    doc.setTextColor(...darkText);
    doc.text(formatCurrency(core.tax), valuesX, y, { align: "right" });
    y += 8;
  }

  // Divider
  doc.setDrawColor(...accent);
  doc.setLineWidth(1.5);
  doc.line(totalsX, y, valuesX, y);
  y += 8;

  // Total
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primary);
  doc.text("TOTAL", totalsX, y);
  doc.text(formatCurrency(core.total), valuesX, y, { align: "right" });
  y += 12;

  // Notes
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...mutedText);
    doc.text("Notes:", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.text(data.notes, 20, y, { maxWidth: pageWidth - 40 });
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(...lightGray);
  doc.rect(0, footerY - 5, pageWidth, 20, "F");
  doc.setFontSize(7);
  doc.setTextColor(...mutedText);
  doc.text(
    "Generated by InvoiceAI • Extracted dynamically from receipt analysis",
    pageWidth / 2,
    footerY + 2,
    { align: "center" }
  );

  return doc;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  // Manual Indian comma formatting (jsPDF Helvetica doesn't support ₹ glyph)
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  // Indian grouping: last 3 digits, then groups of 2
  let formatted = "";
  const digits = intPart.replace("-", "");
  if (digits.length <= 3) {
    formatted = digits;
  } else {
    formatted = digits.slice(-3);
    let remaining = digits.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + "," + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      formatted = remaining + "," + formatted;
    }
  }
  const sign = num < 0 ? "-" : "";
  return `${sign}Rs. ${formatted}.${decPart}`;
}
