import type { BillData } from "../types/billTypes";
import type { ConnectedLoadData } from "../types/loadTypes";
import type { CalculatedMetrics } from "../types/metricsTypes";

interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  errors: string[];
  warnings: string[];
}

interface ProjectHealthSummaryProps {
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
  metrics: CalculatedMetrics;
  validation: ValidationResult;
}

type HealthStatus = "Ready" | "Needs Review" | "Not Ready";

interface HealthItem {
  title: string;
  status: HealthStatus;
  score: number;
  description: string;
}

function getStatusClass(status: HealthStatus): string {
  if (status === "Ready") {
    return "health-ready";
  }

  if (status === "Needs Review") {
    return "health-review";
  }

  return "health-not-ready";
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(score), 100));
}

function getAverageExtractionConfidence(bills: BillData[]): number {
  if (bills.length === 0) {
    return 0;
  }

  const confidenceValues = bills.map((bill) => bill.extractionConfidence ?? 0);
  const total = confidenceValues.reduce((sum, value) => sum + value, 0);

  return total / confidenceValues.length;
}

function getTotalExtractionWarnings(bills: BillData[]): number {
  return bills.reduce(
    (sum, bill) => sum + (bill.extractionWarnings?.length || 0),
    0
  );
}

function getTotalConnectedKW(connectedLoads: ConnectedLoadData[]): number {
  return connectedLoads.reduce((sum, item) => sum + (item.connectedKW || 0), 0);
}

function buildBillExtractionHealth(bills: BillData[]): HealthItem {
  if (bills.length === 0) {
    return {
      title: "Bill Extraction",
      status: "Not Ready",
      score: 0,
      description: "No electricity bill data has been uploaded or loaded.",
    };
  }

  const averageConfidence = getAverageExtractionConfidence(bills);
  const warningCount = getTotalExtractionWarnings(bills);

  if (averageConfidence >= 85 && warningCount === 0) {
    return {
      title: "Bill Extraction",
      status: "Ready",
      score: Math.round(averageConfidence),
      description:
        "Bill extraction quality is high. Extracted values are suitable for preliminary proposal generation.",
    };
  }

  if (averageConfidence >= 60) {
    return {
      title: "Bill Extraction",
      status: "Needs Review",
      score: Math.round(averageConfidence),
      description:
        "Bill extraction is usable, but values should be manually verified before final proposal submission.",
    };
  }

  return {
    title: "Bill Extraction",
    status: "Not Ready",
    score: Math.round(averageConfidence),
    description:
      "Bill extraction confidence is low. Correct the extracted values before generating the final proposal.",
  };
}

function buildCalculationHealth(
  bills: BillData[],
  metrics: CalculatedMetrics,
  validation: ValidationResult
): HealthItem {
  if (bills.length === 0) {
    return {
      title: "Calculation Readiness",
      status: "Not Ready",
      score: 0,
      description: "No bill data is available for calculations.",
    };
  }

  if (validation.errors.length > 0) {
    return {
      title: "Calculation Readiness",
      status: "Not Ready",
      score: validation.confidenceScore,
      description:
        "Calculation inputs have errors. Correct bill values before using savings outputs.",
    };
  }

  if (metrics.anomalies.length > 0 || validation.warnings.length > 0) {
    return {
      title: "Calculation Readiness",
      status: "Needs Review",
      score: validation.confidenceScore,
      description:
        "Calculations are available, but some anomalies or warnings should be reviewed.",
    };
  }

  return {
    title: "Calculation Readiness",
    status: "Ready",
    score: validation.confidenceScore,
    description:
      "Calculation inputs are valid and ready for preliminary analysis.",
  };
}

function buildConnectedLoadHealth(
  connectedLoads: ConnectedLoadData[]
): HealthItem {
  if (connectedLoads.length === 0) {
    return {
      title: "Connected Load Data",
      status: "Needs Review",
      score: 50,
      description:
        "Connected load data is not uploaded. Proposal can be generated, but connected load analysis will be limited.",
    };
  }

  const totalConnectedKW = getTotalConnectedKW(connectedLoads);
  const zeroKWRows = connectedLoads.filter(
    (item) => !item.connectedKW || item.connectedKW <= 0
  ).length;

  if (totalConnectedKW <= 0) {
    return {
      title: "Connected Load Data",
      status: "Not Ready",
      score: 30,
      description:
        "Connected load rows are present, but total connected load is zero. Check Excel mapping.",
    };
  }

  if (zeroKWRows > 0) {
    return {
      title: "Connected Load Data",
      status: "Needs Review",
      score: 75,
      description: `${zeroKWRows} connected load row(s) have zero or missing kW. Review these rows before final reporting.`,
    };
  }

  return {
    title: "Connected Load Data",
    status: "Ready",
    score: 90,
    description:
      "Connected load data is available and suitable for preliminary connected load analysis.",
  };
}

function buildProposalHealth(
  bills: BillData[],
  connectedLoads: ConnectedLoadData[],
  validation: ValidationResult
): HealthItem {
  const billHealth = buildBillExtractionHealth(bills);
  const connectedLoadHealth = buildConnectedLoadHealth(connectedLoads);

  if (bills.length === 0 || validation.errors.length > 0) {
    return {
      title: "Proposal Readiness",
      status: "Not Ready",
      score: 0,
      description:
        "Proposal is not ready. Upload valid bill data and correct validation errors.",
    };
  }

  if (
    billHealth.status === "Needs Review" ||
    connectedLoadHealth.status === "Needs Review" ||
    validation.warnings.length > 0
  ) {
    return {
      title: "Proposal Readiness",
      status: "Needs Review",
      score: 75,
      description:
        "Proposal can be generated for internal review, but extracted values and warnings should be checked before client submission.",
    };
  }

  return {
    title: "Proposal Readiness",
    status: "Ready",
    score: 90,
    description:
      "Proposal is ready for preliminary export and internal review.",
  };
}

function getOverallStatus(items: HealthItem[]): HealthStatus {
  if (items.some((item) => item.status === "Not Ready")) {
    return "Not Ready";
  }

  if (items.some((item) => item.status === "Needs Review")) {
    return "Needs Review";
  }

  return "Ready";
}

function getOverallScore(items: HealthItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + item.score, 0);

  return Math.round(total / items.length);
}

function ProjectHealthSummary({
  bills,
  connectedLoads,
  metrics,
  validation,
}: ProjectHealthSummaryProps) {
  const healthItems: HealthItem[] = [
    buildBillExtractionHealth(bills),
    buildCalculationHealth(bills, metrics, validation),
    buildConnectedLoadHealth(connectedLoads),
    buildProposalHealth(bills, connectedLoads, validation),
  ];

  const overallStatus = getOverallStatus(healthItems);
  const overallScore = getOverallScore(healthItems);

  return (
    <section className="panel project-health-panel">
      <div className="panel-header">
        <div>
          <h2>Project Health Summary</h2>
          <p className="section-note">
            Quick readiness check for bill extraction, calculations, connected
            load data, and proposal export.
          </p>
        </div>

        <span className={`health-status-badge ${getStatusClass(overallStatus)}`}>
          {overallStatus} | {overallScore}%
        </span>
      </div>

      <div className="project-health-grid">
        {healthItems.map((item) => {
          const score = clampScore(item.score);

          return (
            <div className="project-health-card" key={item.title}>
              <div className="project-health-card-header">
                <h3>{item.title}</h3>
                <span className={`health-status-pill ${getStatusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <progress
                className={`health-progress ${getStatusClass(item.status)}`}
                value={score}
                max={100}
                aria-label={`${item.title} readiness score`}
              />

              <p className="health-score-text">{score}% readiness</p>
              <p>{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ProjectHealthSummary;