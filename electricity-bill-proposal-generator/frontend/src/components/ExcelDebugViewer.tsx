import type { ChangeEvent } from "react";
import { useState } from "react";

interface ConnectedLoadRow {
  sourceFile?: string;
  sheetName?: string;
  rowNumber?: number;
  equipmentName?: string;
  location?: string;
  quantity?: number;
  ratingKW?: number;
  ratingHP?: number;
  runningHours?: number;
  diversityFactor?: number;
  connectedKW?: number;
}

interface BillRow {
  month?: string;
  contractDemandKVA?: number;
  actualDemandKVA?: number;
  billingDemandKVA?: number;
  kWh?: number;
  kVAh?: number;
  powerFactor?: number;
  totalBillAmount?: number;
}

interface ExcelDebugResult {
  fileName: string;
  detectedExcelType: string;
  sheetNames: string[];
  sheetCount: number;
  connectedLoadRows: number;
  billRows: number;
  totalConnectedKW: number;
  firstConnectedLoadRows: ConnectedLoadRow[];
  firstBillRows: BillRow[];
  firstSheetPreview: string[][];
  warnings: string[];
  rawResponse: string;
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
  }

  return [];
}

function getTablePreviewValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function getStringMatrixValue(
  source: Record<string, unknown>,
  keys: string[]
): string[][] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value.map((row) => {
        if (Array.isArray(row)) {
          return row.map((cell) => getTablePreviewValue(cell));
        }

        return [getTablePreviewValue(row)];
      });
    }
  }

  return [];
}

function getObjectArrayValue<T>(
  source: Record<string, unknown>,
  keys: string[]
): T[] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value
        .filter((item) => item && typeof item === "object")
        .map((item) => item as T);
    }
  }

  return [];
}

function normalizeExcelDebugResult(
  data: unknown,
  fallbackFileName: string
): ExcelDebugResult {
  const source = getObject(data);

  return {
    fileName: getStringValue(
      source,
      ["fileName", "file_name", "filename"],
      fallbackFileName
    ),
    detectedExcelType: getStringValue(
      source,
      ["detectedExcelType", "detected_excel_type", "fileType", "file_type"],
      "UNKNOWN"
    ),
    sheetNames: getStringArrayValue(source, ["sheetNames", "sheet_names"]),
    sheetCount: getNumberValue(source, ["sheetCount", "sheet_count"], 0),
    connectedLoadRows: getNumberValue(
      source,
      ["connectedLoadRows", "connected_load_rows"],
      0
    ),
    billRows: getNumberValue(source, ["billRows", "bill_rows"], 0),
    totalConnectedKW: getNumberValue(
      source,
      ["totalConnectedKW", "total_connected_kw"],
      0
    ),
    firstConnectedLoadRows: getObjectArrayValue<ConnectedLoadRow>(source, [
      "firstConnectedLoadRows",
      "first_connected_load_rows",
    ]),
    firstBillRows: getObjectArrayValue<BillRow>(source, [
      "firstBillRows",
      "first_bill_rows",
    ]),
    firstSheetPreview: getStringMatrixValue(source, [
      "firstSheetPreview",
      "first_sheet_preview",
    ]),
    warnings: getStringArrayValue(source, ["warnings"]),
    rawResponse: JSON.stringify(data, null, 2),
  };
}

function ExcelDebugViewer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [debugResult, setDebugResult] = useState<ExcelDebugResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    setSelectedFile(file);
    setDebugResult(null);
    setStatusMessage("");
    setErrorMessage("");
  }

  async function debugExcel() {
    if (!selectedFile) {
      setErrorMessage("Please select an Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setStatusMessage("Reading Excel file and parser result...");
    setErrorMessage("");
    setDebugResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/debug-excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      const normalizedResult = normalizeExcelDebugResult(data, selectedFile.name);

      setDebugResult(normalizedResult);
      setStatusMessage("Excel debug completed successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Unable to debug Excel file. Please check whether backend is running on port 8000."
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
    <section className="panel excel-debug-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Excel Debug Viewer</h2>
          <p className="section-note">
            Use this only during testing. It shows Excel sheet details, detected
            file type, connected load rows, bill rows, and raw backend response.
          </p>
        </div>

        <span className="badge success">Testing Tool</span>
      </div>

      <div className="pdf-debug-actions">
        <label className="upload-box">
          Select Excel for Debug
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
        </label>

        <button className="primary-button" type="button" onClick={debugExcel}>
          Debug Excel
        </button>

        <button className="secondary-button" type="button" onClick={clearDebug}>
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
              <span>Detected Excel Type</span>
              <strong>{debugResult.detectedExcelType}</strong>
            </div>

            <div>
              <span>Sheet Count</span>
              <strong>{debugResult.sheetCount}</strong>
            </div>

            <div>
              <span>Total Connected Load</span>
              <strong>{debugResult.totalConnectedKW.toFixed(2)} kW</strong>
            </div>
          </div>

          <div className="upload-summary-grid">
            <div>
              <span>Connected Load Rows</span>
              <strong>{debugResult.connectedLoadRows}</strong>
            </div>

            <div>
              <span>Bill Rows</span>
              <strong>{debugResult.billRows}</strong>
            </div>

            <div>
              <span>Sheet Names</span>
              <strong>
                {debugResult.sheetNames.length > 0
                  ? debugResult.sheetNames.join(", ")
                  : "Not available"}
              </strong>
            </div>

            <div>
              <span>Debug Status</span>
              <strong>Ready</strong>
            </div>
          </div>

          {debugResult.warnings.length > 0 && (
            <div className="alert warning">
              <h3>Warnings</h3>
              <ul>
                {debugResult.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {debugResult.firstConnectedLoadRows.length > 0 && (
            <div className="pdf-debug-section">
              <h3>First Connected Load Rows</h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Equipment</th>
                      <th>Location</th>
                      <th>Qty</th>
                      <th>kW</th>
                      <th>HP</th>
                      <th>Hours</th>
                      <th>Diversity</th>
                      <th>Connected kW</th>
                    </tr>
                  </thead>

                  <tbody>
                    {debugResult.firstConnectedLoadRows.map((row, index) => (
                      <tr key={`${index}-${row.equipmentName || "equipment"}`}>
                        <td>{row.rowNumber || index + 1}</td>
                        <td>{row.equipmentName || "-"}</td>
                        <td>{row.location || "-"}</td>
                        <td>{row.quantity || 0}</td>
                        <td>{row.ratingKW || 0}</td>
                        <td>{row.ratingHP || 0}</td>
                        <td>{row.runningHours || 0}</td>
                        <td>{row.diversityFactor || 0}</td>
                        <td>{row.connectedKW || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {debugResult.firstBillRows.length > 0 && (
            <div className="pdf-debug-section">
              <h3>First Excel Bill Rows</h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Contract Demand</th>
                      <th>Actual Demand</th>
                      <th>Billing Demand</th>
                      <th>kWh</th>
                      <th>kVAh</th>
                      <th>PF</th>
                      <th>Total Bill</th>
                    </tr>
                  </thead>

                  <tbody>
                    {debugResult.firstBillRows.map((row, index) => (
                      <tr key={`${index}-${row.month || "month"}`}>
                        <td>{row.month || "-"}</td>
                        <td>{row.contractDemandKVA || 0}</td>
                        <td>{row.actualDemandKVA || 0}</td>
                        <td>{row.billingDemandKVA || 0}</td>
                        <td>{row.kWh || 0}</td>
                        <td>{row.kVAh || 0}</td>
                        <td>{row.powerFactor || 0}</td>
                        <td>{row.totalBillAmount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pdf-debug-section">
            <h3>First Sheet Preview</h3>

            {debugResult.firstSheetPreview.length > 0 ? (
              <div className="excel-preview-table-wrap">
                <table>
                  <tbody>
                    {debugResult.firstSheetPreview.map((row, rowIndex) => (
                      <tr key={`preview-row-${rowIndex}`}>
                        <th>{rowIndex + 1}</th>
                        {row.map((cell, cellIndex) => (
                          <td key={`preview-cell-${rowIndex}-${cellIndex}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="alert warning">
                <h3>No Sheet Preview Found</h3>
                <p>The backend response did not include Excel sheet preview.</p>
              </div>
            )}
          </div>

          <div className="pdf-debug-section">
            <h3>Raw Backend Response</h3>
            <pre className="pdf-debug-preview">{debugResult.rawResponse}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

export default ExcelDebugViewer;