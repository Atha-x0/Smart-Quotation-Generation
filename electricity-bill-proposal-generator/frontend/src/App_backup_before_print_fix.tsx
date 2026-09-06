import ProposalReadinessPanel from "./components/ProposalReadinessPanel";
import { getProposalReadiness } from "./lib/proposalReadiness";
import DetailedReviewPanel from "./components/DetailedReviewPanel";
import ProjectSetupPanel from "./components/ProjectSetupPanel";
import DashboardQuickNav from "./components/DashboardQuickNav";
import ProposalSignature from "./components/ProposalSignature";
import { useState } from "react";
import type { BillData, ClientDetails } from "./types/billTypes";
import type { ConnectedLoadData } from "./types/loadTypes";
import { calculateMetrics } from "./lib/calculationEngine";
import { validateBills } from "./lib/validator";
import {
  formatINR,
  formatKVA,
  formatKVAR,
  formatPercent,
} from "./lib/formatter";
import { generateRecommendations } from "./data/recommendationRules";
import ExportButtons from "./components/ExportButtons";
import ConnectedLoadSummary from "./components/ConnectedLoadSummary";
import ProjectHealthSummary from "./components/ProjectHealthSummary";
import TrendCharts from "./components/TrendCharts";
import "./App.css";

interface SourceLoadSummary {
  sourceFile: string;
  equipmentCount: number;
  connectedKW: number;
}

interface LocationLoadSummary {
  location: string;
  equipmentCount: number;
  connectedKW: number;
}

interface ConnectedLoadQualitySummary {
  parserName: string;
  averageConfidence: number;
  lowConfidenceRows: number;
  warningRows: number;
  headerRows: string;
  rowsWithDefaultQuantity: number;
  rowsWithDefaultDiversity: number;
}

type TrendStatus = "Increasing" | "Decreasing" | "Stable" | "Insufficient Data";

const defaultClient: ClientDetails = {
  companyName: "SAFAR ECOPET PVT. LTD.",
  location: "Khijadiya, Wankaner, Morbi, Gujarat",
  industryType: "Plastic / PET / PP / Washline",
  discom: "PGVCL",
  tariffCategory: "HTP-I",
  contactPerson: "Plant Head / Maintenance Head",
};

const defaultBills: BillData[] = [
  {
    month: "APR-2026",
    contractDemandKVA: 2500,
    actualDemandKVA: 1744,
    billingDemandKVA: 2125,
    minBillingDemandKVA: 2125,
    kWh: 916380,
    kVAh: 917055,
    powerFactor: 0.999,
    demandCharge: 75000,
    energyCharge: 3848796,
    pfPenalty: 0,
    pfIncentive: 0,
    todCharges: 0,
    otherCharges: 2803496.73,
    totalBillAmount: 6727292.73,
    sourceFile: "Sample PGVCL Bill",
    detectedBillFormat: "PGVCL",
    parser: "pgvcl_ht_bill_parser",
    extractionConfidence: 100,
    extractionWarnings: [],
  },
];

function getExtraValue(row: ConnectedLoadData, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function getNumberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function getStringValue(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function getExtractionWarnings(row: ConnectedLoadData): string[] {
  const value = getExtraValue(row, "extractionWarnings");

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function getSourceLoadSummaries(
  connectedLoads: ConnectedLoadData[]
): SourceLoadSummary[] {
  const sourceMap = new Map<string, SourceLoadSummary>();

  connectedLoads.forEach((item) => {
    const sourceFile = item.sourceFile || "Unknown Source";
    const existing = sourceMap.get(sourceFile);

    if (existing) {
      existing.equipmentCount += 1;
      existing.connectedKW += item.connectedKW || 0;
    } else {
      sourceMap.set(sourceFile, {
        sourceFile,
        equipmentCount: 1,
        connectedKW: item.connectedKW || 0,
      });
    }
  });

  return Array.from(sourceMap.values()).sort(
    (a, b) => b.connectedKW - a.connectedKW
  );
}

function getLocationLoadSummaries(
  connectedLoads: ConnectedLoadData[]
): LocationLoadSummary[] {
  const locationMap = new Map<string, LocationLoadSummary>();

  connectedLoads.forEach((item) => {
    const location = item.location || "Unspecified";
    const existing = locationMap.get(location);

    if (existing) {
      existing.equipmentCount += 1;
      existing.connectedKW += item.connectedKW || 0;
    } else {
      locationMap.set(location, {
        location,
        equipmentCount: 1,
        connectedKW: item.connectedKW || 0,
      });
    }
  });

  return Array.from(locationMap.values()).sort(
    (a, b) => b.connectedKW - a.connectedKW
  );
}

function getTopConnectedLoads(
  connectedLoads: ConnectedLoadData[],
  limit = 10
): ConnectedLoadData[] {
  return [...connectedLoads]
    .sort((a, b) => (b.connectedKW || 0) - (a.connectedKW || 0))
    .slice(0, limit);
}

function getConnectedLoadQualitySummary(
  connectedLoads: ConnectedLoadData[]
): ConnectedLoadQualitySummary {
  if (connectedLoads.length === 0) {
    return {
      parserName: "Not available",
      averageConfidence: 0,
      lowConfidenceRows: 0,
      warningRows: 0,
      headerRows: "Not available",
      rowsWithDefaultQuantity: 0,
      rowsWithDefaultDiversity: 0,
    };
  }

  const confidenceValues = connectedLoads.map((row) =>
    getNumberValue(getExtraValue(row, "extractionConfidence"))
  );

  const averageConfidence =
    confidenceValues.reduce((sum, value) => sum + value, 0) /
    confidenceValues.length;

  const lowConfidenceRows = confidenceValues.filter((value) => value < 80).length;

  const warningRows = connectedLoads.filter(
    (row) => getExtractionWarnings(row).length > 0
  ).length;

  const parserName = getStringValue(
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

  const rowsWithDefaultQuantity = connectedLoads.filter((row) =>
    getExtractionWarnings(row).some((warning) =>
      warning.toLowerCase().includes("default quantity")
    )
  ).length;

  const rowsWithDefaultDiversity = connectedLoads.filter((row) =>
    getExtractionWarnings(row).some((warning) =>
      warning.toLowerCase().includes("default diversity")
    )
  ).length;

  return {
    parserName,
    averageConfidence: Math.round(averageConfidence),
    lowConfidenceRows,
    warningRows,
    headerRows:
      headerRowValues.length > 0 ? headerRowValues.join(", ") : "Not available",
    rowsWithDefaultQuantity,
    rowsWithDefaultDiversity,
  };
}

function getAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMax(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function getMin(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
}

function getTrendStatus(values: number[]): TrendStatus {
  if (values.length < 3) {
    return "Insufficient Data";
  }

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.ceil(values.length / 2));

  const firstAverage = getAverage(firstHalf);
  const secondAverage = getAverage(secondHalf);

  if (firstAverage <= 0) {
    return "Insufficient Data";
  }

  const changePercent = ((secondAverage - firstAverage) / firstAverage) * 100;

  if (changePercent > 5) {
    return "Increasing";
  }

  if (changePercent < -5) {
    return "Decreasing";
  }

  return "Stable";
}

function getDemandRecommendationStatus(
  billCount: number,
  contractDemandKVA: number,
  maxBillingDemandKVA: number
): string {
  if (billCount < 6) {
    return "Preliminary only. Upload 6 to 12 months of bills before final contract demand decision.";
  }

  if (contractDemandKVA <= 0 || maxBillingDemandKVA <= 0) {
    return "Demand recommendation cannot be finalized due to missing demand values.";
  }

  const headroomKVA = contractDemandKVA - maxBillingDemandKVA;
  const headroomPercent = (headroomKVA / contractDemandKVA) * 100;

  if (headroomPercent >= 15) {
    return "Strong case for contract demand reduction study based on uploaded monthly trend.";
  }

  if (headroomPercent >= 8) {
    return "Moderate case for contract demand optimization after operational validation.";
  }

  return "No major contract demand reduction indicated from uploaded trend.";
}

function getManualReviewStatus(bill: BillData): string {
  const confidence = bill.extractionConfidence ?? 0;
  const warningCount = bill.extractionWarnings?.length || 0;

  if (confidence >= 85 && warningCount === 0) {
    return "High confidence extraction. Normal review recommended.";
  }

  if (confidence >= 60) {
    return "Moderate confidence extraction. Manual verification recommended.";
  }

  return "Low confidence extraction. Manual correction required before final proposal.";
}

function getOverallExtractionStatus(bills: BillData[]): string {
  if (bills.length === 0) {
    return "No bill data extracted.";
  }

  const averageConfidence = getAverage(
    bills.map((bill) => bill.extractionConfidence ?? 0)
  );

  const totalWarnings = bills.reduce(
    (sum, bill) => sum + (bill.extractionWarnings?.length || 0),
    0
  );

  if (averageConfidence >= 85 && totalWarnings === 0) {
    return "Overall extraction quality is high. Values are suitable for preliminary proposal generation.";
  }

  if (averageConfidence >= 60) {
    return "Overall extraction quality is moderate. Extracted values should be manually verified before final submission.";
  }

  return "Overall extraction quality is low. Manual review and correction are required before using this proposal.";
}

function App() {
  const [client, setClient] = useState<ClientDetails>(defaultClient);
  const [bills, setBills] = useState<BillData[]>(defaultBills);
  const [connectedLoads, setConnectedLoads] = useState<ConnectedLoadData[]>([]);

  const validation = validateBills(bills);
  const metrics = calculateMetrics(bills);
  const recommendations = generateRecommendations(metrics, {
    connectedLoads,
  });
    // PROPOSAL READINESS SECTION - FINAL EXPORT CHECK DATA
  const proposalReadiness = getProposalReadiness({
    client,
    bills,
    connectedLoads,
    validation,
  });

  const primaryBill = bills[0];

  const totalConnectedKW = connectedLoads.reduce(
    (sum, item) => sum + (item.connectedKW || 0),
    0
  );

  const connectedLoadToDemandRatio =
    primaryBill?.actualDemandKVA && primaryBill.actualDemandKVA > 0
      ? totalConnectedKW / primaryBill.actualDemandKVA
      : 0;

  const contractDemandUtilization =
    primaryBill?.contractDemandKVA && primaryBill.contractDemandKVA > 0
      ? (primaryBill.actualDemandKVA / primaryBill.contractDemandKVA) * 100
      : 0;

  const billingDemandUtilization =
    primaryBill?.contractDemandKVA && primaryBill.contractDemandKVA > 0
      ? ((primaryBill.billingDemandKVA || 0) / primaryBill.contractDemandKVA) *
        100
      : 0;

  const analysedMonths = bills.length;
  const averageMonthlySpend = metrics.avgMonthlyBill;
  const estimatedAnnualizedSpend = averageMonthlySpend * 12;

  const sourceLoadSummaries = getSourceLoadSummaries(connectedLoads);
  const locationLoadSummaries = getLocationLoadSummaries(connectedLoads);
  const topConnectedLoads = getTopConnectedLoads(connectedLoads, 10);
  const connectedLoadQuality = getConnectedLoadQualitySummary(connectedLoads);

  const billingDemandValues = bills.map(
    (bill) => bill.billingDemandKVA || bill.actualDemandKVA || 0
  );

  const actualDemandValues = bills.map((bill) => bill.actualDemandKVA || 0);
  const kWhValues = bills.map((bill) => bill.kWh || 0);
  const billAmountValues = bills.map((bill) => bill.totalBillAmount || 0);
  const powerFactorValues = bills.map((bill) => bill.powerFactor || 0);

  const maxBillingDemandKVA = getMax(billingDemandValues);
  const maxActualDemandKVA = getMax(actualDemandValues);
  const minActualDemandKVA = getMin(actualDemandValues);
  const avgActualDemandKVA = getAverage(actualDemandValues);

  const maxMonthlyBill = getMax(billAmountValues);
  const minMonthlyBill = getMin(billAmountValues);

  const avgKWh = getAverage(kWhValues);
  const maxKWh = getMax(kWhValues);

  const avgPowerFactor = getAverage(powerFactorValues);
  const minPowerFactor = getMin(powerFactorValues);

  const consumptionTrend = getTrendStatus(kWhValues);
  const billTrend = getTrendStatus(billAmountValues);
  const demandTrend = getTrendStatus(actualDemandValues);
  const pfTrend = getTrendStatus(powerFactorValues);

  const averageExtractionConfidence = getAverage(
    bills.map((bill) => bill.extractionConfidence ?? 0)
  );

  const totalExtractionWarnings = bills.reduce(
    (sum, bill) => sum + (bill.extractionWarnings?.length || 0),
    0
  );

  const extractionStatus = getOverallExtractionStatus(bills);

  const demandOptimizationOpportunity =
    primaryBill && primaryBill.contractDemandKVA > 0
      ? Math.max(
          0,
          primaryBill.contractDemandKVA - (primaryBill.billingDemandKVA || 0)
        )
      : 0;

  const multiMonthDemandOpportunity =
    primaryBill && primaryBill.contractDemandKVA > 0
      ? Math.max(0, primaryBill.contractDemandKVA - maxBillingDemandKVA)
      : 0;

  const demandOptimizationStatus = getDemandRecommendationStatus(
    analysedMonths,
    primaryBill?.contractDemandKVA || 0,
    maxBillingDemandKVA
  );

  const pfStatus =
    avgPowerFactor >= 0.98
      ? "Healthy power factor. No immediate APFC correction required."
      : "Power factor improvement should be reviewed.";

  const connectedLoadStatus =
    connectedLoads.length > 0
      ? "Connected load data available. Site validation recommended before final measure selection."
      : "Connected load data not uploaded yet.";

  const preliminaryPriority =
    connectedLoads.length > 0 && connectedLoadToDemandRatio > 1.3
      ? "High priority for connected load validation and operating pattern study"
      : "Medium priority for further validation";

  return (
    <main className="app">
      <section className="hero no-print">
        <div>
          <p className="eyebrow">SEE-Tech Solutions</p>
          <h1>Electricity Bill Proposal Generator</h1>
          <p className="subtitle">
            Structured bill analysis, savings calculation, connected load review,
            and proposal automation dashboard.
          </p>
        </div>

        <div className="client-card">
          <h2>{client.companyName || "Client Name"}</h2>
          <p>{client.location || "Location not entered"}</p>
          <p>{client.industryType || "Industry not entered"}</p>
          <p>
            {client.discom || "DISCOM"} |{" "}
            {client.tariffCategory || "Tariff Category"}
          </p>
        </div>
      </section>

      {/* DASHBOARD PHASE 2 - QUICK NAVIGATION */}
      <DashboardQuickNav />

      {/* DASHBOARD PHASE 2 - MAIN DASHBOARD BODY */}
      <div className="no-print">
        {/* DASHBOARD PHASE 2 - COMPACT PROJECT SETUP */}
        <div id="setup">
          <ProjectSetupPanel
            client={client}
            bills={bills}
            connectedLoads={connectedLoads}
            onClientChange={setClient}
            onBillsChange={setBills}
            onConnectedLoadsChange={setConnectedLoads}
/>
        </div>

        {/* DASHBOARD STRUCTURE - COLLAPSED DEVELOPER TESTING TOOLS */}
                {/* DETAILED REVIEW SECTION - COLLAPSIBLE REVIEW AND TESTING TOOLS */}
        <DetailedReviewPanel
          bills={bills}
          defaultBills={defaultBills}
          validation={validation}
          onBillsChange={setBills}
        />

        <div id="health">
          <ProjectHealthSummary
            bills={bills}
            connectedLoads={connectedLoads}
            metrics={metrics}
            validation={validation}
          />
        </div>

        {/* DASHBOARD PHASE 2 - EXECUTIVE KPI DASHBOARD */}
        <section id="kpis" className="kpi-grid">
          <div className="kpi-card">
            <p>Analysed Months</p>
            <h2>{analysedMonths}</h2>
          </div>

          <div className="kpi-card">
            <p>Average Monthly Bill</p>
            <h2>{formatINR(averageMonthlySpend)}</h2>
          </div>

          <div className="kpi-card">
            <p>Estimated Annualized Spend</p>
            <h2>{formatINR(estimatedAnnualizedSpend)}</h2>
          </div>

          <div className="kpi-card">
            <p>Extraction Confidence</p>
            <h2>{averageExtractionConfidence.toFixed(0)}%</h2>
          </div>

          <div className="kpi-card">
            <p>Maximum Billing Demand</p>
            <h2>{formatKVA(maxBillingDemandKVA)}</h2>
          </div>

          <div className="kpi-card">
            <p>Total Connected Load</p>
            <h2>{totalConnectedKW.toFixed(0)} kW</h2>
          </div>
        </section>

        <section className="panel">
          <h2>Project Savings Summary</h2>

          <div className="grid-two">
            <div>
              <div className="metric-row">
                <span>Single-Month Demand Opportunity</span>
                <strong>{formatKVA(demandOptimizationOpportunity)}</strong>
              </div>

              <div className="metric-row">
                <span>Multi-Month Demand Opportunity</span>
                <strong>{formatKVA(multiMonthDemandOpportunity)}</strong>
              </div>

              <div className="metric-row">
                <span>Demand Optimization Status</span>
                <strong>{demandOptimizationStatus}</strong>
              </div>
            </div>

            <div>
              <div className="metric-row">
                <span>Power Factor Status</span>
                <strong>{pfStatus}</strong>
              </div>

              <div className="metric-row">
                <span>Connected Load / Actual Demand Ratio</span>
                <strong>{connectedLoadToDemandRatio.toFixed(2)}</strong>
              </div>

              <div className="metric-row">
                <span>Preliminary Priority</span>
                <strong>{preliminaryPriority}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Multi-Month Trend Analysis</h2>

          <div className="grid-two">
            <div>
              <div className="metric-row">
                <span>Analysed Months</span>
                <strong>{analysedMonths}</strong>
              </div>

              <div className="metric-row">
                <span>Consumption Trend</span>
                <strong>{consumptionTrend}</strong>
              </div>

              <div className="metric-row">
                <span>Bill Amount Trend</span>
                <strong>{billTrend}</strong>
              </div>

              <div className="metric-row">
                <span>Demand Trend</span>
                <strong>{demandTrend}</strong>
              </div>

              <div className="metric-row">
                <span>Power Factor Trend</span>
                <strong>{pfTrend}</strong>
              </div>
            </div>

            <div>
              <div className="metric-row">
                <span>Average kWh</span>
                <strong>
                  {avgKWh.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  kWh
                </strong>
              </div>

              <div className="metric-row">
                <span>Maximum kWh</span>
                <strong>
                  {maxKWh.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  kWh
                </strong>
              </div>

              <div className="metric-row">
                <span>Average Actual Demand</span>
                <strong>{formatKVA(avgActualDemandKVA)}</strong>
              </div>

              <div className="metric-row">
                <span>Maximum Actual Demand</span>
                <strong>{formatKVA(maxActualDemandKVA)}</strong>
              </div>

              <div className="metric-row">
                <span>Minimum Actual Demand</span>
                <strong>{formatKVA(minActualDemandKVA)}</strong>
              </div>
            </div>
          </div>
        </section>

        <div id="trends">
          <TrendCharts bills={bills} />
        </div>

        <section className="panel">
          <h2>Extraction Reliability Summary</h2>

          <div className="grid-two">
            <div>
              <div className="metric-row">
                <span>Average Extraction Confidence</span>
                <strong>{averageExtractionConfidence.toFixed(0)}%</strong>
              </div>

              <div className="metric-row">
                <span>Total Extraction Warnings</span>
                <strong>{totalExtractionWarnings}</strong>
              </div>

              <div className="metric-row">
                <span>Overall Extraction Status</span>
                <strong>{extractionStatus}</strong>
              </div>
            </div>

            <div>
              <div className="metric-row">
                <span>Primary Bill Format</span>
                <strong>{primaryBill?.detectedBillFormat || "Not available"}</strong>
              </div>

              <div className="metric-row">
                <span>Primary Parser</span>
                <strong>{primaryBill?.parser || "Not available"}</strong>
              </div>

              <div className="metric-row">
                <span>Manual Review Status</span>
                <strong>
                  {primaryBill
                    ? getManualReviewStatus(primaryBill)
                    : "No bill data available."}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="grid-two">
          <div className="panel">
            <h2>Demand Analysis</h2>

            <div className="metric-row">
              <span>Contract Demand</span>
              <strong>{formatKVA(primaryBill?.contractDemandKVA || 0)}</strong>
            </div>

            <div className="metric-row">
              <span>Actual Maximum Demand</span>
              <strong>{formatKVA(primaryBill?.actualDemandKVA || 0)}</strong>
            </div>

            <div className="metric-row">
              <span>Billing Demand</span>
              <strong>{formatKVA(primaryBill?.billingDemandKVA || 0)}</strong>
            </div>

            <div className="metric-row">
              <span>Actual Demand Utilization</span>
              <strong>{formatPercent(contractDemandUtilization)}</strong>
            </div>
          </div>

          <div className="panel">
            <h2>Power Factor Analysis</h2>

            <div className="metric-row">
              <span>Average PF</span>
              <strong>{avgPowerFactor.toFixed(3)}</strong>
            </div>

            <div className="metric-row">
              <span>Minimum PF</span>
              <strong>{minPowerFactor.toFixed(3)}</strong>
            </div>

            <div className="metric-row">
              <span>PF Penalty Months</span>
              <strong>{metrics.pfPenaltyMonths}</strong>
            </div>

            <div className="metric-row">
              <span>Required APFC</span>
              <strong>{formatKVAR(metrics.requiredAPFCKVAR)}</strong>
            </div>
          </div>
        </section>

        <div id="loads">
          <ConnectedLoadSummary connectedLoads={connectedLoads} />
        </div>

        <section className="panel">
          <h2>Monthly Bill Summary</h2>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>kWh</th>
                  <th>kVAh</th>
                  <th>PF</th>
                  <th>Actual Demand</th>
                  <th>Billing Demand</th>
                  <th>Total Bill</th>
                </tr>
              </thead>

              <tbody>
                {bills.map((bill, index) => (
                  <tr key={`${bill.month}-${index}`}>
                    <td>{bill.month}</td>
                    <td>{bill.kWh.toLocaleString("en-IN")}</td>
                    <td>{bill.kVAh.toLocaleString("en-IN")}</td>
                    <td>{bill.powerFactor.toFixed(3)}</td>
                    <td>{formatKVA(bill.actualDemandKVA)}</td>
                    <td>{formatKVA(bill.billingDemandKVA || bill.actualDemandKVA)}</td>
                    <td>{formatINR(bill.totalBillAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="recommendations" className="panel recommendations-panel">
          <h2>Recommendations</h2>

          <div className="recommendation-grid">
            {recommendations.map((recommendation) => (
              <div className="recommendation-card" key={recommendation.title}>
                <div className="recommendation-header">
                  <span className={`priority ${recommendation.priority.toLowerCase()}`}>
                    {recommendation.priority}
                  </span>
                  <span>{recommendation.category}</span>
                </div>

                <h3>{recommendation.title}</h3>
                <p>{recommendation.description}</p>
                <strong>{recommendation.expectedImpact}</strong>
              </div>
            ))}
          </div>
        </section>

                {/* PROPOSAL READINESS SECTION - FINAL CHECK BEFORE EXPORT */}
        <ProposalReadinessPanel readiness={proposalReadiness} />

        <ExportButtons readiness={proposalReadiness} />
      </div>

            <section id="proposal" className="panel proposal print-area">
                <div className="proposal-cover">
          <p className="eyebrow">SEE-Tech Solutions</p>
          <h2>Electricity Bill Analysis & Connected Load Review</h2>
          <p>
            <strong>Client:</strong> {client.companyName || "Client Name"}
          </p>
          <p>
            <strong>Location:</strong> {client.location || "Location"} |{" "}
            <strong>Industry:</strong> {client.industryType || "Industry"}
          </p>
          <p>
            <strong>DISCOM:</strong> {client.discom || "DISCOM"} |{" "}
            <strong>Tariff:</strong> {client.tariffCategory || "Tariff Category"}
          </p>
        </div>

        <div className="proposal-highlight-grid">
          <div>
            <span>Analysed Months</span>
            <strong>{analysedMonths}</strong>
          </div>

          <div>
            <span>Estimated Annualized Spend</span>
            <strong>{formatINR(estimatedAnnualizedSpend)}</strong>
          </div>

          <div>
            <span>Extraction Confidence</span>
            <strong>{averageExtractionConfidence.toFixed(0)}%</strong>
          </div>

          <div>
            <span>Connected Load</span>
            <strong>{totalConnectedKW.toFixed(2)} kW</strong>
          </div>
        </div>

        <h3>1. Executive Summary</h3>
        <p>
          Based on the uploaded electricity bill and connected load working files,
          {client.companyName ? ` ${client.companyName}` : " the client"} has an
          average monthly electricity bill of {formatINR(averageMonthlySpend)}.
          Based on the uploaded month(s), the estimated annualized electricity
          spend is approximately {formatINR(estimatedAnnualizedSpend)}.
        </p>

        <p>
          The plant has a contract demand of{" "}
          {formatKVA(primaryBill?.contractDemandKVA || 0)}. The maximum actual
          demand observed in the uploaded bill data is{" "}
          {formatKVA(maxActualDemandKVA)}, while the maximum billing demand is{" "}
          {formatKVA(maxBillingDemandKVA)}. The uploaded connected load data
          includes {connectedLoads.length} equipment rows with total connected
          load of {totalConnectedKW.toFixed(2)} kW.
        </p>

        <h3>2. Extraction Reliability Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Average Bill Extraction Confidence</td>
              <td>{averageExtractionConfidence.toFixed(0)}%</td>
            </tr>
            <tr>
              <td>Total Bill Extraction Warnings</td>
              <td>{totalExtractionWarnings}</td>
            </tr>
            <tr>
              <td>Overall Bill Extraction Status</td>
              <td>{extractionStatus}</td>
            </tr>
            <tr>
              <td>Manual Review Requirement</td>
              <td>
                Extracted values should be reviewed before final commercial
                submission. High confidence values are suitable for preliminary
                proposal generation.
              </td>
            </tr>
          </tbody>
        </table>

        <h3>3. Bill Extraction Details</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Source File</th>
              <th>Format</th>
              <th>Parser</th>
              <th>Confidence</th>
              <th>Manual Review Status</th>
            </tr>
          </thead>

          <tbody>
            {bills.map((bill, index) => (
              <tr key={`${bill.month}-parser-${index}`}>
                <td>{bill.month}</td>
                <td>{bill.sourceFile || "Not available"}</td>
                <td>{bill.detectedBillFormat || "Not available"}</td>
                <td>{bill.parser || "Not available"}</td>
                <td>{bill.extractionConfidence ?? "N/A"}%</td>
                <td>{getManualReviewStatus(bill)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalExtractionWarnings > 0 && (
          <>
            <h3>4. Extraction Warnings</h3>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Source File</th>
                  <th>Warning</th>
                </tr>
              </thead>

              <tbody>
                {bills.flatMap((bill, billIndex) =>
                  (bill.extractionWarnings || []).map((warning, warningIndex) => (
                    <tr key={`${billIndex}-${warningIndex}-${warning}`}>
                      <td>{bill.month}</td>
                      <td>{bill.sourceFile || "Not available"}</td>
                      <td>{warning}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}

        <h3>{totalExtractionWarnings > 0 ? "5" : "4"}. Project Savings Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Single-Month Demand Optimization Opportunity</td>
              <td>{formatKVA(demandOptimizationOpportunity)}</td>
            </tr>
            <tr>
              <td>Multi-Month Demand Optimization Opportunity</td>
              <td>{formatKVA(multiMonthDemandOpportunity)}</td>
            </tr>
            <tr>
              <td>Demand Optimization Status</td>
              <td>{demandOptimizationStatus}</td>
            </tr>
            <tr>
              <td>Power Factor Status</td>
              <td>{pfStatus}</td>
            </tr>
            <tr>
              <td>Connected Load Status</td>
              <td>{connectedLoadStatus}</td>
            </tr>
            <tr>
              <td>Connected Load / Actual Demand Ratio</td>
              <td>{connectedLoadToDemandRatio.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Preliminary Implementation Priority</td>
              <td>{preliminaryPriority}</td>
            </tr>
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "6" : "5"}. Multi-Month Electricity Bill Trend Review</h3>
        <table>
          <tbody>
            <tr>
              <td>Uploaded / Analysed Months</td>
              <td>{analysedMonths}</td>
            </tr>
            <tr>
              <td>Average Monthly Bill</td>
              <td>{formatINR(averageMonthlySpend)}</td>
            </tr>
            <tr>
              <td>Maximum Monthly Bill</td>
              <td>{formatINR(maxMonthlyBill)}</td>
            </tr>
            <tr>
              <td>Minimum Monthly Bill</td>
              <td>{formatINR(minMonthlyBill)}</td>
            </tr>
            <tr>
              <td>Average kWh Consumption</td>
              <td>
                {avgKWh.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kWh
              </td>
            </tr>
            <tr>
              <td>Maximum kWh Consumption</td>
              <td>
                {maxKWh.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kWh
              </td>
            </tr>
            <tr>
              <td>Consumption Trend</td>
              <td>{consumptionTrend}</td>
            </tr>
            <tr>
              <td>Bill Amount Trend</td>
              <td>{billTrend}</td>
            </tr>
            <tr>
              <td>Demand Trend</td>
              <td>{demandTrend}</td>
            </tr>
            <tr>
              <td>Power Factor Trend</td>
              <td>{pfTrend}</td>
            </tr>
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "7" : "6"}. Monthly Bill Data Table</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>kWh</th>
              <th>kVAh</th>
              <th>PF</th>
              <th>Actual Demand</th>
              <th>Billing Demand</th>
              <th>Total Bill</th>
            </tr>
          </thead>

          <tbody>
            {bills.map((bill, index) => (
              <tr key={`${bill.month}-proposal-${index}`}>
                <td>{bill.month}</td>
                <td>{bill.kWh.toLocaleString("en-IN")}</td>
                <td>{bill.kVAh.toLocaleString("en-IN")}</td>
                <td>{bill.powerFactor.toFixed(3)}</td>
                <td>{formatKVA(bill.actualDemandKVA)}</td>
                <td>{formatKVA(bill.billingDemandKVA || bill.actualDemandKVA)}</td>
                <td>{formatINR(bill.totalBillAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "8" : "7"}. Input Data Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Bill Rows Extracted</td>
              <td>{bills.length}</td>
            </tr>
            <tr>
              <td>Connected Load Rows Extracted</td>
              <td>{connectedLoads.length}</td>
            </tr>
            <tr>
              <td>Total Connected Load</td>
              <td>{totalConnectedKW.toFixed(2)} kW</td>
            </tr>
            <tr>
              <td>Source Files Parsed</td>
              <td>{sourceLoadSummaries.length} connected load source file(s)</td>
            </tr>
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "9" : "8"}. Electricity Bill Analysis</h3>
        <table>
          <tbody>
            <tr>
              <td>Contract Demand</td>
              <td>{formatKVA(primaryBill?.contractDemandKVA || 0)}</td>
            </tr>
            <tr>
              <td>85% / Minimum Billing Demand</td>
              <td>{formatKVA(primaryBill?.minBillingDemandKVA || 0)}</td>
            </tr>
            <tr>
              <td>Maximum Actual Demand</td>
              <td>{formatKVA(maxActualDemandKVA)}</td>
            </tr>
            <tr>
              <td>Maximum Billing Demand</td>
              <td>{formatKVA(maxBillingDemandKVA)}</td>
            </tr>
            <tr>
              <td>Actual Demand Utilization</td>
              <td>{formatPercent(contractDemandUtilization)}</td>
            </tr>
            <tr>
              <td>Billing Demand Utilization</td>
              <td>{formatPercent(billingDemandUtilization)}</td>
            </tr>
            <tr>
              <td>Average Power Factor</td>
              <td>{avgPowerFactor.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Minimum Power Factor</td>
              <td>{minPowerFactor.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Estimated Annualized Spend</td>
              <td>{formatINR(estimatedAnnualizedSpend)}</td>
            </tr>
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "10" : "9"}. Bill Component Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Demand Charge</td>
              <td>{formatINR(primaryBill?.demandCharge || 0)}</td>
            </tr>
            <tr>
              <td>Energy Charge</td>
              <td>{formatINR(primaryBill?.energyCharge || 0)}</td>
            </tr>
            <tr>
              <td>PF Penalty</td>
              <td>{formatINR(primaryBill?.pfPenalty || 0)}</td>
            </tr>
            <tr>
              <td>PF Incentive</td>
              <td>{formatINR(primaryBill?.pfIncentive || 0)}</td>
            </tr>
            <tr>
              <td>TOD Charges</td>
              <td>{formatINR(primaryBill?.todCharges || 0)}</td>
            </tr>
            <tr>
              <td>Other Charges</td>
              <td>{formatINR(primaryBill?.otherCharges || 0)}</td>
            </tr>
            <tr>
              <td>
                <strong>Total Bill Amount</strong>
              </td>
              <td>
                <strong>{formatINR(primaryBill?.totalBillAmount || 0)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <h3>{totalExtractionWarnings > 0 ? "11" : "10"}. Connected Load Analysis</h3>
        <p>
          The uploaded connected load and machine detail files indicate a total
          connected load of {totalConnectedKW.toFixed(2)} kW across{" "}
          {connectedLoads.length} equipment entries. The maximum actual demand
          observed is {formatKVA(maxActualDemandKVA)}, giving a connected load to
          demand ratio of {connectedLoadToDemandRatio.toFixed(2)}.
        </p>

        <p>
          This ratio indicates that all connected equipment is not operating
          simultaneously. Therefore, load diversity, operating hours, batch
          operation, standby equipment, and process-wise utilization should be
          validated at site before finalizing demand reduction or connected load
          based recommendations.
        </p>

        <h3>{totalExtractionWarnings > 0 ? "12" : "11"}. Connected Load Parser Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Connected Load Parser</td>
              <td>{connectedLoadQuality.parserName}</td>
            </tr>
            <tr>
              <td>Header Row Detected</td>
              <td>{connectedLoadQuality.headerRows}</td>
            </tr>
            <tr>
              <td>Average Connected Load Extraction Confidence</td>
              <td>{connectedLoadQuality.averageConfidence}%</td>
            </tr>
            <tr>
              <td>Rows With Warnings</td>
              <td>{connectedLoadQuality.warningRows}</td>
            </tr>
            <tr>
              <td>Low Confidence Rows</td>
              <td>{connectedLoadQuality.lowConfidenceRows}</td>
            </tr>
            <tr>
              <td>Rows Where Default Quantity Was Used</td>
              <td>{connectedLoadQuality.rowsWithDefaultQuantity}</td>
            </tr>
            <tr>
              <td>Rows Where Default Diversity Factor Was Used</td>
              <td>{connectedLoadQuality.rowsWithDefaultDiversity}</td>
            </tr>
          </tbody>
        </table>

        {sourceLoadSummaries.length > 0 && (
          <>
            <h3>{totalExtractionWarnings > 0 ? "13" : "12"}. Source-wise Connected Load Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Source File</th>
                  <th>Equipment Rows</th>
                  <th>Connected Load</th>
                </tr>
              </thead>

              <tbody>
                {sourceLoadSummaries.map((source) => (
                  <tr key={source.sourceFile}>
                    <td>{source.sourceFile}</td>
                    <td>{source.equipmentCount}</td>
                    <td>{source.connectedKW.toFixed(2)} kW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {locationLoadSummaries.length > 0 && (
          <>
            <h3>{totalExtractionWarnings > 0 ? "14" : "13"}. Section-wise Connected Load Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Section / Location</th>
                  <th>Equipment Rows</th>
                  <th>Connected Load</th>
                </tr>
              </thead>

              <tbody>
                {locationLoadSummaries.map((location) => (
                  <tr key={location.location}>
                    <td>{location.location}</td>
                    <td>{location.equipmentCount}</td>
                    <td>{location.connectedKW.toFixed(2)} kW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {topConnectedLoads.length > 0 && (
          <>
            <h3>{totalExtractionWarnings > 0 ? "15" : "14"}. Top 10 Major Connected Loads</h3>
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Section / Location</th>
                  <th>Rating kW</th>
                  <th>Quantity</th>
                  <th>Connected kW</th>
                  <th>Confidence</th>
                </tr>
              </thead>

              <tbody>
                {topConnectedLoads.map((load, index) => (
                  <tr key={`${load.equipmentName}-${index}`}>
                    <td>{load.equipmentName || "-"}</td>
                    <td>{load.location || "-"}</td>
                    <td>{(load.ratingKW || 0).toFixed(2)}</td>
                    <td>{(load.quantity || 0).toFixed(0)}</td>
                    <td>{(load.connectedKW || 0).toFixed(2)}</td>
                    <td>{getNumberValue(getExtraValue(load, "extractionConfidence"))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3>{totalExtractionWarnings > 0 ? "16" : "15"}. Parser Assumptions and Warnings</h3>
        <ul>
          <li>
            Connected load extraction is based on machine detail columns such as
            equipment name, kW rating, HP rating, quantity, diversity factor, and
            section/location wherever available.
          </li>
          <li>
            Where quantity is missing, the parser assumes quantity as 1 for
            preliminary connected load calculation.
          </li>
          <li>
            Where diversity factor is missing, the parser assumes diversity factor
            as 1. Site validation is required before using the connected load for
            final demand optimization recommendations.
          </li>
          <li>
            Section rows such as process area names are used as location/section
            tags for the following equipment rows.
          </li>
          <li>
            Rows with missing kW/HP ratings are excluded from connected load
            total and should be reviewed manually.
          </li>
        </ul>

        <h3>{totalExtractionWarnings > 0 ? "17" : "16"}. Key Observations</h3>
        <ul>
          <li>
            {analysedMonths} bill month(s) have been analysed for electricity
            consumption, demand, power factor, and billing pattern.
          </li>
          <li>
            Average monthly bill is {formatINR(averageMonthlySpend)}, with an
            estimated annualized spend of {formatINR(estimatedAnnualizedSpend)}.
          </li>
          <li>
            Maximum billing demand is {formatKVA(maxBillingDemandKVA)} against
            contract demand of {formatKVA(primaryBill?.contractDemandKVA || 0)}.
          </li>
          <li>
            Average power factor is {avgPowerFactor.toFixed(3)}, and minimum
            power factor is {minPowerFactor.toFixed(3)}.
          </li>
          <li>
            Total connected load is {totalConnectedKW.toFixed(2)} kW, which is
            higher than the actual recorded demand. This indicates diversity in
            equipment operation.
          </li>
          <li>{extractionStatus}</li>
        </ul>

        <h3>{totalExtractionWarnings > 0 ? "18" : "17"}. Recommended Actions</h3>
        <ul>
          {recommendations.map((recommendation) => (
            <li key={recommendation.title}>
              <strong>{recommendation.title}:</strong>{" "}
              {recommendation.description}
            </li>
          ))}
          <li>
            <strong>Upload multiple monthly bills:</strong> Add 6 to 12 months of
            electricity bills for stronger contract demand optimization analysis.
          </li>
          <li>
            <strong>Validate connected load file:</strong> Confirm equipment
            ratings, quantity, operating hours, standby equipment, and diversity
            factor for major process sections.
          </li>
          <li>
            <strong>Review extraction quality:</strong> Verify all values where
            parser confidence is moderate or low before submitting the final
            proposal.
          </li>
        </ul>

        <h3>{totalExtractionWarnings > 0 ? "19" : "18"}. Proposed Next Steps</h3>
        <ol>
          <li>Verify extracted electricity bill values with original bill PDFs.</li>
          <li>Upload 6 to 12 months of bills for trend-based demand review.</li>
          <li>Validate connected load list with site team and machine nameplates.</li>
          <li>Identify continuously operating, intermittent, and standby loads.</li>
          <li>Review actual demand trend, billing demand trend, and production trend.</li>
          <li>Finalize demand optimization and energy-saving measures.</li>
          <li>Prepare implementation-level proposal with investment and ROI.</li>
        </ol>

                <h3>{totalExtractionWarnings > 0 ? "20" : "19"}. Assumptions and Limitations</h3>
        <ul>
          <li>
            This proposal preview is based on uploaded bill and connected load
            files only.
          </li>
          <li>
            Savings potential shown in the dashboard is preliminary and should be
            validated with site measurements.
          </li>
          <li>
            Connected load values depend on correctness of Excel file headers,
            ratings, quantities, and extracted values.
          </li>
          <li>
            Demand optimization should be finalized only after reviewing at least
            6 to 12 months of demand and consumption history.
          </li>
          <li>
            Tariff applicability, billing demand rules, and charges should be
            verified against the latest applicable DISCOM tariff order.
          </li>
        </ul>

        <ProposalSignature />
      </section>
    </main>
  );
}

export default App;