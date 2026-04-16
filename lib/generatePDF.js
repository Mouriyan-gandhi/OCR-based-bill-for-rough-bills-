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
  doc.text(`#${data.invoice_number || "N/A"}`, pageWidth - 20, 20, { align: "right" });
  doc.text(`Date: ${data.date || "N/A"}`, pageWidth - 20, 28, { align: "right" });

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
  doc.text(data.vendor_name || "Vendor", 20, y);
  doc.text(data.customer_name || "Customer", pageWidth / 2 + 10, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedText);

  if (data.vendor_address) {
    doc.text(data.vendor_address, 20, y, { maxWidth: 80 });
  }
  if (data.customer_address) {
    doc.text(data.customer_address, pageWidth / 2 + 10, y, { maxWidth: 80 });
  }
  y += 8;

  if (data.vendor_phone) {
    doc.text(`Phone: ${data.vendor_phone}`, 20, y);
    y += 5;
  }
  if (data.vendor_gst) {
    doc.text(`GST: ${data.vendor_gst}`, 20, y);
    y += 5;
  }

  y += 10;

  // ── Items Table ──
  const items = data.items || [];
  const tableBody = items.map((item, index) => [
    index + 1,
    item.name || "—",
    item.quantity ?? "—",
    item.unit || "pcs",
    formatCurrency(item.price),
    formatCurrency(item.amount || (item.quantity * item.price)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Unit", "Price", "Amount"]],
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
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 30 },
      5: { halign: "right", cellWidth: 30 },
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

  // Subtotal
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(...darkText);
  doc.text(formatCurrency(data.subtotal), valuesX, y, { align: "right" });
  y += 8;

  // Discount
  if (data.discount) {
    doc.setTextColor(...mutedText);
    doc.text("Discount", totalsX, y);
    doc.setTextColor(...darkText);
    doc.text(`-${formatCurrency(data.discount)}`, valuesX, y, { align: "right" });
    y += 8;
  }

  // Tax details
  if (data.tax_details && data.tax_details.length > 0) {
    data.tax_details.forEach((tax) => {
      if (tax && tax.type) {
        doc.setTextColor(...mutedText);
        doc.text(`${tax.type} (${tax.rate || ""}%)`, totalsX, y);
        doc.setTextColor(...darkText);
        doc.text(formatCurrency(tax.amount), valuesX, y, { align: "right" });
        y += 8;
      }
    });
  } else if (data.tax) {
    doc.setTextColor(...mutedText);
    doc.text("Tax", totalsX, y);
    doc.setTextColor(...darkText);
    doc.text(formatCurrency(data.tax), valuesX, y, { align: "right" });
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
  doc.text(formatCurrency(data.total), valuesX, y, { align: "right" });
  y += 8;

  // Amount in words
  if (data.amount_in_words) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...mutedText);
    doc.text(`Amount in words: ${data.amount_in_words}`, 20, y + 5);
    y += 12;
  }

  // Payment method
  if (data.payment_method) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text(`Payment Method: ${data.payment_method}`, 20, y + 5);
    y += 10;
  }

  // Notes
  if (data.notes) {
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text("Notes:", 20, y);
    y += 5;
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
    "Generated by InvoiceAI • This is a computer-generated invoice",
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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}
