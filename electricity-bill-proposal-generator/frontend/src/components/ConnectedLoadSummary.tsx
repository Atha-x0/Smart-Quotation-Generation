import type { ConnectedLoadData } from "../types/loadTypes";

interface ConnectedLoadSummaryProps {
  connectedLoads: ConnectedLoadData[];
}

interface LocationSummary {
  location: string;
  equipmentCount: number;
  connectedKW: number;
}

interface SourceSummary {
  sourceFile: string;
  equipmentCount: number;
  connectedKW: number;
}

interface ParserQualitySummary {
  averageConfidence: number;
  lowConfidenceRows: number;
  warningRows: number;
  parserName: string;
  headerRows: string;
}

function getNumber(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }

  return Number(value);
}

function getString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function getExtraValue(row: ConnectedLoadData, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function getExtractionWarnings(row: ConnectedLoadData): string[] {
  const value = getExtraValue(row, "extractionWarnings");

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function getLocationSummaries(connectedLoads: ConnectedLoadData[]): LocationSummary[] {
  const summaryMap = new Map<string, LocationSummary>();

  connectedLoads.forEach((item) => {
    const location = item.location || "Unspecified";

    const existing = summaryMap.get(location);

    if (existing) {
      existing.equipmentCount += 1;
      existing.connectedKW += getNumber(item.connectedKW);
    } else {
      summaryMap.set(location, {
        location,
        equipmentCount: 1,
        connectedKW: getNumber(item.connectedKW),
      });
    }
  });

  return Array.from(summaryMap.values()).sort(
    (a, b) => b.connectedKW - a.connectedKW
  );
}

function getSourceSummaries(connectedLoads: ConnectedLoadData[]): SourceSummary[] {
  const summaryMap = new Map<string, SourceSummary>();

  connectedLoads.forEach((item) => {
    const sourceFile = item.sourceFile || "Unknown Source";

    const existing = summaryMap.get(sourceFile);

    if (existing) {
      existing.equipmentCount += 1;
      existing.connectedKW += getNumber(item.connectedKW);
    } else {
      summaryMap.set(sourceFile, {
        sourceFile,
        equipmentCount: 1,
        connectedKW: getNumber(item.connectedKW),
      });
    }
  });

  return Array.from(summaryMap.values()).sort(
    (a, b) => b.connectedKW - a.connectedKW
  );
}

function getParserQualitySummary(
  connectedLoads: ConnectedLoadData[]
): ParserQualitySummary {
  if (connectedLoads.length === 0) {
    return {
      averageConfidence: 0,
      lowConfidenceRows: 0,
      warningRows: 0,
      parserName: "Not available",
      headerRows: "Not available",
    };
  }

  const confidenceValues = connectedLoads.map((row) =>
    getNumber(getExtraValue(row, "extractionConfidence") as number)
  );

  const averageConfidence =
    confidenceValues.reduce((sum, value) => sum + value, 0) /
    confidenceValues.length;

  const lowConfidenceRows = confidenceValues.filter((value) => value < 80).length;

  const warningRows = connectedLoads.filter(
    (row) => getExtractionWarnings(row).length > 0
  ).length;

  const parserName = getString(
    getExtraValue(connectedLoads[0], "parser"),
    "Not available"
  );

  const headerRowValues = Array.from(
    new Set(
      connectedLoads
        .map((row) => getExtraValue(row, "headerRowNumber"))
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => String(value))
    )
  );

  return {
    averageConfidence: Math.round(averageConfidence),
    lowConfidenceRows,
    warningRows,
    parserName,
    headerRows:
      headerRowValues.length > 0 ? headerRowValues.join(", ") : "Not available",
  };
}

function ConnectedLoadSummary({ connectedLoads }: ConnectedLoadSummaryProps) {
  const totalConnectedKW = connectedLoads.reduce(
    (sum, item) => sum + getNumber(item.connectedKW),
    0
  );

  const totalQuantity = connectedLoads.reduce(
    (sum, item) => sum + getNumber(item.quantity),
    0
  );

  const averageKW =
    connectedLoads.length > 0 ? totalConnectedKW / connectedLoads.length : 0;

  const locationSummaries = getLocationSummaries(connectedLoads);
  const sourceSummaries = getSourceSummaries(connectedLoads);
  const parserQuality = getParserQualitySummary(connectedLoads);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Connected Load Summary</h2>
          <p className="section-note">
            Summary of extracted connected load and machine details from uploaded
            Excel files.
          </p>
        </div>

        <span className="badge success">{connectedLoads.length} row(s)</span>
      </div>

      {connectedLoads.length === 0 ? (
        <p className="section-note">
          No connected load data uploaded yet. Upload machine details or connected
          load Excel files to enable this section.
        </p>
      ) : (
        <>
          <div className="connected-load-grid">
            <div className="mini-kpi-card">
              <p>Total Connected Load</p>
              <h3>{totalConnectedKW.toFixed(2)} kW</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Total Equipment Quantity</p>
              <h3>{totalQuantity.toFixed(0)}</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Average Load Per Row</p>
              <h3>{averageKW.toFixed(2)} kW</h3>
            </div>
          </div>

          <div className="connected-load-grid">
            <div className="mini-kpi-card">
              <p>Parser Used</p>
              <h3>{parserQuality.parserName}</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Avg Extraction Confidence</p>
              <h3>{parserQuality.averageConfidence}%</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Header Row Detected</p>
              <h3>{parserQuality.headerRows}</h3>
            </div>
          </div>

          <div className="connected-load-grid">
            <div className="mini-kpi-card">
              <p>Low Confidence Rows</p>
              <h3>{parserQuality.lowConfidenceRows}</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Rows With Warnings</p>
              <h3>{parserQuality.warningRows}</h3>
            </div>

            <div className="mini-kpi-card">
              <p>Source Files</p>
              <h3>{sourceSummaries.length}</h3>
            </div>
          </div>

          <section className="sub-panel">
            <h3>Source-wise Connected Load</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source File</th>
                    <th>Equipment Rows</th>
                    <th>Connected Load</th>
                  </tr>
                </thead>

                <tbody>
                  {sourceSummaries.map((source) => (
                    <tr key={source.sourceFile}>
                      <td>{source.sourceFile}</td>
                      <td>{source.equipmentCount}</td>
                      <td>{source.connectedKW.toFixed(2)} kW</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sub-panel">
            <h3>Location / Section-wise Connected Load</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Location / Section</th>
                    <th>Equipment Rows</th>
                    <th>Connected Load</th>
                  </tr>
                </thead>

                <tbody>
                  {locationSummaries.map((location) => (
                    <tr key={location.location}>
                      <td>{location.location}</td>
                      <td>{location.equipmentCount}</td>
                      <td>{location.connectedKW.toFixed(2)} kW</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sub-panel">
            <h3>First 25 Connected Load Rows</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Equipment</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Rating kW</th>
                    <th>Connected kW</th>
                    <th>Confidence</th>
                    <th>Warnings</th>
                  </tr>
                </thead>

                <tbody>
                  {connectedLoads.slice(0, 25).map((item, index) => {
                    const warnings = getExtractionWarnings(item);

                    return (
                      <tr key={`${item.equipmentName}-${index}`}>
                        <td>{item.rowNumber}</td>
                        <td>{item.equipmentName}</td>
                        <td>{item.location || "-"}</td>
                        <td>{getNumber(item.quantity).toFixed(0)}</td>
                        <td>{getNumber(item.ratingKW).toFixed(2)}</td>
                        <td>{getNumber(item.connectedKW).toFixed(2)}</td>
                        <td>
                          {getNumber(
                            getExtraValue(item, "extractionConfidence") as number
                          )}
                          %
                        </td>
                        <td>
                          {warnings.length > 0 ? warnings.join("; ") : "No warnings"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export default ConnectedLoadSummary;