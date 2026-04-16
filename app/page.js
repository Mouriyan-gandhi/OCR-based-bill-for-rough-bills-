"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("extracted");
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState([]);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("invoiceai_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Save history to localStorage
  const saveToHistory = (data) => {
    const entry = {
      id: Date.now(),
      vendor: data.vendor_name || "Unknown",
      total: data.total,
      date: data.date || new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem("invoiceai_history", JSON.stringify(updated));
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setResult(null);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const processImage = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("image", file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 15, 85));
      }, 500);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(95);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Processing failed");
      }

      setProgress(100);
      setResult(data.data);
      setActiveTab("extracted");
      saveToHistory(data.data);

      setTimeout(() => setProgress(0), 500);
    } catch (err) {
      setError(err.message);
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  };

  const downloadPDF = async () => {
    if (!result) return;
    // Dynamic import for client-side only
    const { generateInvoicePDF } = await import("@/lib/generatePDF");
    const doc = generateInvoicePDF(result);
    doc.save(`invoice-${result.invoice_number || Date.now()}.pdf`);
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${result.invoice_number || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("invoiceai_history");
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const syntaxHighlight = (json) => {
    const str = JSON.stringify(json, null, 2);
    return str.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-number";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const getConfidenceLevel = (score) => {
    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-badge">
          <span className="pulse-dot"></span>
          AI-Powered OCR
        </div>
        <h1>InvoiceAI</h1>
        <p>Transform any bill, receipt, or handwritten invoice into structured data & professional PDFs</p>
      </header>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="upload-icon">📄</span>
        <h3>Drop your document here</h3>
        <p>Supports JPEG, PNG, PDF — including handwritten bills</p>
        <span className="browse-btn">Browse Files</span>
        <input
          ref={fileInputRef}
          type="file"
          className="upload-input"
          accept="image/*,.pdf"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <br />
        <button
          className="camera-btn"
          onClick={(e) => {
            e.stopPropagation();
            cameraInputRef.current?.click();
          }}
        >
          📷 Take Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          className="upload-input"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* File Preview */}
      {file && (
        <div className="preview-container">
          {preview && (
            <img src={preview} alt="Preview" className="preview-thumb" />
          )}
          <div className="preview-info">
            <div className="preview-name">{file.name}</div>
            <div className="preview-size">
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button className="preview-remove" onClick={removeFile}>✕</button>
        </div>
      )}

      {/* Process Button */}
      <button
        className={`process-btn ${processing ? "processing" : ""}`}
        onClick={processImage}
        disabled={!file || processing}
      >
        {processing ? (
          <>
            <div className="spinner"></div>
            Analyzing Document...
          </>
        ) : (
          <>🔍 Extract &amp; Process</>
        )}
      </button>

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-toast">⚠️ {error}</div>}

      {/* Results */}
      {result && (
        <div className="results-section">
          {/* Tabs */}
          <div className="results-tabs">
            <button
              className={`tab-btn ${activeTab === "extracted" ? "active" : ""}`}
              onClick={() => setActiveTab("extracted")}
            >
              📋 Extracted Data
            </button>
            <button
              className={`tab-btn ${activeTab === "json" ? "active" : ""}`}
              onClick={() => setActiveTab("json")}
            >
              {"{ }"} JSON
            </button>
            <button
              className={`tab-btn ${activeTab === "confidence" ? "active" : ""}`}
              onClick={() => setActiveTab("confidence")}
            >
              📊 Confidence
            </button>
          </div>

          {/* Tab: Extracted Data */}
          {activeTab === "extracted" && (
            <div className="data-card">
              <div className="card-header">
                <span>🏢</span>
                <h3>Invoice Details</h3>
              </div>

              <div className="field-grid">
                <div className="field-item">
                  <span className="field-label">Vendor Name</span>
                  <span className={`field-value ${!result.vendor_name ? "null" : ""}`}>
                    {result.vendor_name || "Not detected"}
                  </span>
                </div>
                <div className="field-item">
                  <span className="field-label">Invoice Number</span>
                  <span className={`field-value ${!result.invoice_number ? "null" : ""}`}>
                    {result.invoice_number || "Not detected"}
                  </span>
                </div>
                <div className="field-item">
                  <span className="field-label">Date</span>
                  <span className={`field-value ${!result.date ? "null" : ""}`}>
                    {result.date || "Not detected"}
                  </span>
                </div>
                <div className="field-item">
                  <span className="field-label">Payment Method</span>
                  <span className={`field-value ${!result.payment_method ? "null" : ""}`}>
                    {result.payment_method || "Not detected"}
                  </span>
                </div>
                {result.vendor_address && (
                  <div className="field-item">
                    <span className="field-label">Vendor Address</span>
                    <span className="field-value">{result.vendor_address}</span>
                  </div>
                )}
                {result.vendor_phone && (
                  <div className="field-item">
                    <span className="field-label">Phone</span>
                    <span className="field-value">{result.vendor_phone}</span>
                  </div>
                )}
                {result.vendor_gst && (
                  <div className="field-item">
                    <span className="field-label">GST Number</span>
                    <span className="field-value">{result.vendor_gst}</span>
                  </div>
                )}
                {result.customer_name && (
                  <div className="field-item">
                    <span className="field-label">Customer</span>
                    <span className="field-value">{result.customer_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              {result.items && result.items.length > 0 && (
                <>
                  <div className="card-header" style={{ marginTop: 24 }}>
                    <span>📦</span>
                    <h3>Line Items ({result.items.length})</h3>
                  </div>
                  <div className="items-table-wrap">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{item.name || "—"}</td>
                            <td>{item.quantity ?? "—"}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>
                              {formatCurrency(
                                item.amount || (item.quantity && item.price
                                  ? item.quantity * item.price
                                  : null)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Totals */}
              <div style={{ marginTop: 20 }}>
                <div className="totals-row">
                  <span className="label">Subtotal</span>
                  <span className="value">{formatCurrency(result.subtotal)}</span>
                </div>
                {result.discount && (
                  <div className="totals-row">
                    <span className="label">Discount</span>
                    <span className="value" style={{ color: "#f87171" }}>
                      -{formatCurrency(result.discount)}
                    </span>
                  </div>
                )}
                {result.tax_details && result.tax_details.length > 0 ? (
                  result.tax_details.map((tax, i) => (
                    tax && tax.type ? (
                      <div className="totals-row" key={i}>
                        <span className="label">
                          {tax.type} {tax.rate ? `(${tax.rate}%)` : ""}
                        </span>
                        <span className="value">{formatCurrency(tax.amount)}</span>
                      </div>
                    ) : null
                  ))
                ) : result.tax ? (
                  <div className="totals-row">
                    <span className="label">Tax</span>
                    <span className="value">{formatCurrency(result.tax)}</span>
                  </div>
                ) : null}
                <div className="totals-row grand-total">
                  <span className="label">Total</span>
                  <span className="value">{formatCurrency(result.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab: JSON */}
          {activeTab === "json" && (
            <div className="data-card">
              <div className="card-header">
                <span>{"{ }"}</span>
                <h3>Raw JSON Output</h3>
              </div>
              <div className="json-view">
                <pre
                  dangerouslySetInnerHTML={{
                    __html: syntaxHighlight(result),
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab: Confidence */}
          {activeTab === "confidence" && result.confidence && (
            <div className="data-card">
              <div className="card-header">
                <span>📊</span>
                <h3>Confidence Report</h3>
              </div>
              <div className="confidence-grid">
                {Object.entries(result.confidence).map(([key, score]) => {
                  const level = getConfidenceLevel(score);
                  return (
                    <div className="confidence-item" key={key}>
                      <div className="confidence-label">{key.replace(/_/g, " ")}</div>
                      <div className="confidence-bar-bg">
                        <div
                          className={`confidence-bar-fill ${level}`}
                          style={{ width: `${score * 100}%` }}
                        ></div>
                      </div>
                      <span className={`confidence-score ${level}`}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="actions-bar">
            <button className="action-btn primary" onClick={downloadPDF}>
              📄 Download PDF Invoice
            </button>
            <button className="action-btn secondary" onClick={downloadJSON}>
              💾 Download JSON
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="history-section">
        <div className="history-header">
          <h3>📁 Recent Invoices</h3>
          {history.length > 0 && (
            <button className="history-clear" onClick={clearHistory}>
              Clear All
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="history-empty">
            No invoices processed yet. Upload a document to get started.
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div className="history-item" key={item.id}>
                <div className="history-icon">🧾</div>
                <div className="history-details">
                  <div className="history-vendor">{item.vendor}</div>
                  <div className="history-meta">{item.date}</div>
                </div>
                <div className="history-amount">{formatCurrency(item.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
