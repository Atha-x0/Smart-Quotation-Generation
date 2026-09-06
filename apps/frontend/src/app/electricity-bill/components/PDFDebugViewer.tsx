import type { ChangeEvent } from "react";
import { useState } from "react";
import { formatINR, formatKVA } from "../lib/formatter";

interface ParserSummary {
  month?: string;
  contractDemandKVA?: number;
  actualDemandKVA?: number;
  billingDemandKVA?: number;
  kWh?: number;
  kVAh?: number;
  powerFactor?: number;
  demandCharge?: number;
  energyCharge?: number;
  totalBillAmount?: number;
  detectedBillFormat?: string;
  parser?: string;
  extractionConfidence?: number;
  extractionWarnings?: string[];
}

interface PDFDebugResult {
  fileName: string;
  detectedFormat: string;
  lineCount: number;
  firstLines: string[];
  textPreview: string;
  parserSummary: ParserSummary;
  parserResultPreview: string;
}

function getObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getStringValue(
  source: Record<string, unknown>,
  keys: string[],
  fallback: string
): string {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumberValue(
  source: Record<string, unknown>,
  keys: string[],
  fallback: number
): number {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function getStringArrayValue(
  source: Record<string, unknown>,
  keys: string[]
): string[] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }
  }

  return [];
}

function normalizeParserSummary(source: Record<string, unknown>): ParserSummary {
  const parserSummary = getObject(source.parserSummary);
  const parserResult = getObject(source.parserResult);

  const merged = {
    ...parserResult,
    ...parserSummary,
  };

  return {
    month: getStringValue(merged, ["month"], ""),
    contractDemandKVA: getNumberValue(merged, ["contractDemandKVA"], 0),
    actualDemandKVA: getNumberValue(merged, ["actualDemandKVA"], 0),
    billingDemandKVA: getNumberValue(merged, ["billingDemandKVA"], 0),
    kWh: getNumberValue(merged, ["kWh"], 0),
    kVAh: getNumberValue(merged, ["kVAh"], 0),
    powerFactor: getNumberValue(merged, ["powerFactor"], 0),
    demandCharge: getNumberValue(merged, ["demandCharge"], 0),
    energyCharge: getNumberValue(merged, ["energyCharge"], 0),
    totalBillAmount: getNumberValue(merged, ["totalBillAmount"], 0),
    detectedBillFormat: getStringValue(
      merged,
      ["detectedBillFormat", "detectedFormat"],
      ""
    ),
    parser: getStringValue(merged, ["parser"], ""),
    extractionConfidence: getNumberValue(merged, ["extractionConfidence"], 0),
    extractionWarnings: getStringArrayValue(merged, ["extractionWarnings"]),
  };
}

function normalizeDebugResult(
  data: unknown,
  fallbackFileName: string
): PDFDebugResult {
  const source = getObject(data);

  const firstLines = getStringArrayValue(source, ["firstLines", "first_lines"]);

  const textPreview =
    getStringValue(
      source,
      [
        "textPreview",
        "text_preview",
        "rawTextPreview",
        "raw_text_preview",
        "rawText",
        "raw_text",
        "text",
      ],
      ""
    ) || firstLines.join("\n");

  return {
    fileName: getStringValue(
      source,
      ["fileName", "file_name", "filename"],
      fallbackFileName
    ),
    detectedFormat: getStringValue(
      source,
      ["detectedFormat", "detected_format", "format"],
      "UNKNOWN"
    ),
    lineCount: getNumberValue(
      source,
      ["lineCount", "line_count", "totalLines", "total_lines"],
      firstLines.length
    ),
    firstLines,
    textPreview,
    parserSummary: normalizeParserSummary(source),
    parserResultPreview: JSON.stringify(data, null, 2),
  };
}

function PDFDebugViewer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [debugResult, setDebugResult] = useState<PDFDebugResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    setSelectedFile(file);
    setDebugResult(null);
    setStatusMessage("");
    setErrorMessage("");
  }

  async function debugPDF() {
    if (!selectedFile) {
      setErrorMessage("Please select a PDF file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setStatusMessage("Reading PDF text and parser result...");
    setErrorMessage("");
    setDebugResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/debug-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      const normalizedResult = normalizeDebugResult(data, selectedFile.name);

      setDebugResult(normalizedResult);
      setStatusMessage("PDF debug completed successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Unable to debug PDF. Please check whether backend is running on port 8000."
      );
      setStatusMessage("");
    }
  }

  function clearDebug() {
    setSelectedFile(null);
    setDebugResult(null);
    setStatusMessage("");
    setErrorMessage("");
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 pdf-debug-panel no-print">
      <div className="panel-header">
        <div>
          <h2>PDF Debug Viewer</h2>
          <p className="section-note">
            Use this only during testing. It shows extracted PDF text, detected
            format, parser result, confidence score, and warnings.
          </p>
        </div>

        <span className="badge success">Testing Tool</span>
      </div>

      <div className="pdf-debug-actions">
        <label className="upload-box">
          Select PDF for Debug
          <input type="file" accept=".pdf" onChange={handleFileChange} />
        </label>

        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" type="button" onClick={debugPDF}>
          Debug PDF
        </button>

        <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" type="button" onClick={clearDebug}>
          Clear
        </button>
      </div>

      {selectedFile && (
        <p className="pdf-debug-file">
          Selected file: <strong>{selectedFile.name}</strong>
        </p>
      )}

      {statusMessage && <div className="upload-status info">{statusMessage}</div>}

      {errorMessage && <div className="upload-status error">{errorMessage}</div>}

      {debugResult && (
        <div className="pdf-debug-result">
          <div className="upload-summary-grid">
            <div>
              <span>File Name</span>
              <strong>{debugResult.fileName}</strong>
            </div>

            <div>
              <span>Detected Format</span>
              <strong>{debugResult.detectedFormat}</strong>
            </div>

            <div>
              <span>Extracted Lines</span>
              <strong>{debugResult.lineCount}</strong>
            </div>

            <div>
              <span>Confidence</span>
              <strong>{debugResult.parserSummary.extractionConfidence || 0}%</strong>
            </div>
          </div>

          <div className="pdf-debug-section">
            <h3>Parser Result Summary</h3>

            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <td>Month</td>
                    <td>{debugResult.parserSummary.month || "Not detected"}</td>
                  </tr>
                  <tr>
                    <td>Parser</td>
                    <td>{debugResult.parserSummary.parser || "Not detected"}</td>
                  </tr>
                  <tr>
                    <td>Detected Bill Format</td>
                    <td>
                      {debugResult.parserSummary.detectedBillFormat ||
                        debugResult.detectedFormat}
                    </td>
                  </tr>
                  <tr>
                    <td>Contract Demand</td>
                    <td>
                      {formatKVA(debugResult.parserSummary.contractDemandKVA || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Actual Demand</td>
                    <td>
                      {formatKVA(debugResult.parserSummary.actualDemandKVA || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Billing Demand</td>
                    <td>
                      {formatKVA(debugResult.parserSummary.billingDemandKVA || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>kWh</td>
                    <td>
                      {(debugResult.parserSummary.kWh || 0).toLocaleString(
                        "en-IN"
                      )}{" "}
                      kWh
                    </td>
                  </tr>
                  <tr>
                    <td>kVAh</td>
                    <td>
                      {(debugResult.parserSummary.kVAh || 0).toLocaleString(
                        "en-IN"
                      )}{" "}
                      kVAh
                    </td>
                  </tr>
                  <tr>
                    <td>Power Factor</td>
                    <td>
                      {(debugResult.parserSummary.powerFactor || 0).toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td>Demand Charge</td>
                    <td>
                      {formatINR(debugResult.parserSummary.demandCharge || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Energy Charge</td>
                    <td>
                      {formatINR(debugResult.parserSummary.energyCharge || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Total Bill</td>
                    <td>
                      {formatINR(debugResult.parserSummary.totalBillAmount || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {debugResult.parserSummary.extractionWarnings &&
              debugResult.parserSummary.extractionWarnings.length > 0 && (
                <div className="alert warning">
                  <h3>Parser Warnings</h3>
                  <ul>
                    {debugResult.parserSummary.extractionWarnings.map(
                      (warning, index) => (
                        <li key={`${index}-${warning}`}>{warning}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </div>

          <div className="pdf-debug-section">
            <h3>First Extracted Lines</h3>

            {debugResult.firstLines.length > 0 ? (
              <div className="pdf-debug-lines">
                {debugResult.firstLines.map((line, index) => (
                  <div className="pdf-debug-line" key={`${index}-${line}`}>
                    <span>{index + 1}</span>
                    <p>{line}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert warning">
                <h3>No Lines Found</h3>
                <p>The backend response did not include extracted PDF lines.</p>
              </div>
            )}
          </div>

          <div className="pdf-debug-section">
            <h3>Raw Text Preview</h3>

            {debugResult.textPreview.trim().length > 0 ? (
              <pre className="pdf-debug-preview">{debugResult.textPreview}</pre>
            ) : (
              <div className="alert warning">
                <h3>No Raw Text Preview Found</h3>
                <p>The backend response did not include a text preview.</p>
              </div>
            )}
          </div>

          <div className="pdf-debug-section">
            <h3>Raw Backend Response</h3>
            <pre className="pdf-debug-preview">
              {debugResult.parserResultPreview}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

export default PDFDebugViewer;