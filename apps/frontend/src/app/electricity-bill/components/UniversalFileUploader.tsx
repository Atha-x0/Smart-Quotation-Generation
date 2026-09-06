import type { ChangeEvent } from "react";
import { useState } from "react";
import type { BillData } from "../types/billTypes";
import type { ConnectedLoadData } from "../types/loadTypes";

interface UniversalFileUploaderProps {
  onBillsLoaded: (bills: BillData[]) => void;
  onConnectedLoadsLoaded: (connectedLoads: ConnectedLoadData[]) => void;
}

interface FileResult {
  fileName: string;
  fileType: string;
  status: string;
  rowsExtracted: number;
  message: string;
}

interface UploadSummary {
  totalFiles: number;
  billRows: number;
  connectedLoadRows: number;
  successfulFiles: number;
  failedFiles: number;
}

interface UploadResult {
  status: string;
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
  fileResults: FileResult[];
  summary: UploadSummary;
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

    if (typeof value === "string") {
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

function getArrayValue<T>(
  source: Record<string, unknown>,
  keys: string[]
): T[] {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function normalizeFileResult(value: unknown): FileResult {
  const source = getObject(value);

  return {
    fileName: getStringValue(
      source,
      ["fileName", "file_name", "filename", "name"],
      "Unknown file"
    ),
    fileType: getStringValue(
      source,
      ["fileType", "file_type", "type"],
      "UNKNOWN_FILE"
    ),
    status: getStringValue(source, ["status"], "unknown"),
    rowsExtracted: getNumberValue(
      source,
      ["rowsExtracted", "rows_extracted", "rowCount", "row_count"],
      0
    ),
    message: getStringValue(source, ["message", "error"], ""),
  };
}

function normalizeUploadResult(data: unknown): UploadResult {
  const source = getObject(data);

  const bills = getArrayValue<BillData>(source, ["bills", "billRows"]);

  const connectedLoads = getArrayValue<ConnectedLoadData>(source, [
    "connectedLoads",
    "connected_loads",
    "loads",
  ]);

  const rawFileResults = getArrayValue<unknown>(source, [
    "fileResults",
    "file_results",
    "files",
  ]);

  const fileResults = rawFileResults.map((item) => normalizeFileResult(item));
  const summarySource = getObject(source.summary);

  const summary: UploadSummary = {
    totalFiles: getNumberValue(
      summarySource,
      ["totalFiles", "total_files"],
      fileResults.length
    ),
    billRows: getNumberValue(
      summarySource,
      ["billRows", "bill_rows"],
      bills.length
    ),
    connectedLoadRows: getNumberValue(
      summarySource,
      ["connectedLoadRows", "connected_load_rows"],
      connectedLoads.length
    ),
    successfulFiles: getNumberValue(
      summarySource,
      ["successfulFiles", "successful_files"],
      fileResults.filter((item) => item.status === "success").length
    ),
    failedFiles: getNumberValue(
      summarySource,
      ["failedFiles", "failed_files"],
      fileResults.filter((item) => item.status === "error").length
    ),
  };

  return {
    status: getStringValue(source, ["status"], "unknown"),
    bills,
    connectedLoads,
    fileResults,
    summary,
  };
}

function UniversalFileUploader({
  onBillsLoaded,
  onConnectedLoadsLoaded,
}: UniversalFileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    setSelectedFiles(files);
    setStatusMessage("");
    setErrorMessage("");
  }

  async function uploadFiles() {
    if (selectedFiles.length === 0) {
      setErrorMessage("Please select at least one PDF, image, Excel, or CSV file.");
      return;
    }

    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    setStatusMessage("Uploading and extracting files...");
    setErrorMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/extract-multiple", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      const normalizedResult = normalizeUploadResult(data);

      if (normalizedResult.bills.length > 0) {
        onBillsLoaded(normalizedResult.bills);
      }

      if (normalizedResult.connectedLoads.length > 0) {
        onConnectedLoadsLoaded(normalizedResult.connectedLoads);
      }

      setStatusMessage("File extraction completed successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Unable to upload or extract files. Please check whether backend is running on port 8000."
      );
      setStatusMessage("");
    }
  }

  function clearFiles() {
    setSelectedFiles([]);
    setStatusMessage("");
    setErrorMessage("");
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Universal File Upload</h2>
          <p className="text-sm text-slate-500">
            Upload bill PDF and all working Excel files together. The backend
            will classify bill files, connected load files, and machine detail
            files automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100">Bill PDF</span>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100">Bill Image</span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">Excel Bill</span>
          <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-semibold border border-slate-200">Machine Details</span>
          <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-semibold border border-slate-200">Connected Load</span>
          <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-semibold border border-slate-200">CSV</span>
        </div>

        <div className="flex items-center space-x-3 mb-4">
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl py-2 px-5 shadow-sm transition-colors text-xs flex items-center justify-center">
            Select Files
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
              onChange={handleFileChange}
            />
          </label>

          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-5 shadow-sm transition-colors text-xs flex items-center justify-center" type="button" onClick={uploadFiles}>
            Upload Files
          </button>

          <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl py-2 px-5 shadow-sm transition-colors text-xs flex items-center justify-center" type="button" onClick={clearFiles}>
            Clear
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="upload-result">
            <h3>Selected Files</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Size</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedFiles.map((file) => (
                    <tr key={`${file.name}-${file.size}`}>
                      <td>{file.name}</td>
                      <td>{(file.size / 1024).toFixed(1)} KB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {statusMessage && <div className="upload-status info">{statusMessage}</div>}

        {errorMessage && <div className="upload-status error">{errorMessage}</div>}
      </div>
    </section>
  );
}

export default UniversalFileUploader;