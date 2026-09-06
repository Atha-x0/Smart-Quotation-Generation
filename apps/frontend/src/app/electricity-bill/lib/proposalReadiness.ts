import type { BillData, ClientDetails } from "../types/billTypes";
import type { ConnectedLoadData } from "../types/loadTypes";

export interface ValidationSummary {
  isValid: boolean;
  confidenceScore: number;
  errors: string[];
  warnings: string[];
}

export interface ProposalReadinessInput {
  client: ClientDetails;
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
  validation: ValidationSummary;
}

export interface ProposalReadinessCheck {
  title: string;
  status: "Pass" | "Warning" | "Fail";
  message: string;
  isBlocking: boolean;
}

export interface ProposalReadinessResult {
  canExport: boolean;
  score: number;
  status: "Ready" | "Needs Review" | "Not Ready";
  checks: ProposalReadinessCheck[];
  blockingIssues: string[];
  warnings: string[];
}

function getAverageBillExtractionConfidence(bills: BillData[]): number {
  if (bills.length === 0) {
    return 0;
  }

  const totalConfidence = bills.reduce(
    (sum, bill) => sum + (bill.extractionConfidence ?? 0),
    0
  );

  return Math.round(totalConfidence / bills.length);
}

function addCheck(
  checks: ProposalReadinessCheck[],
  check: ProposalReadinessCheck
) {
  checks.push(check);
}

export function getProposalReadiness(
  input: ProposalReadinessInput
): ProposalReadinessResult {
  // PROPOSAL READINESS - INPUT DATA
  const { client, bills, connectedLoads, validation } = input;
  const checks: ProposalReadinessCheck[] = [];

  const averageExtractionConfidence =
    getAverageBillExtractionConfidence(bills);

  // PROPOSAL READINESS - CLIENT DETAILS CHECK
  if (client.companyName && client.companyName.trim().length > 0) {
    addCheck(checks, {
      title: "Client Name",
      status: "Pass",
      message: "Client company name is available.",
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Client Name",
      status: "Fail",
      message: "Client company name is missing.",
      isBlocking: true,
    });
  }

  if (client.location && client.location.trim().length > 0) {
    addCheck(checks, {
      title: "Client Location",
      status: "Pass",
      message: "Client location is available.",
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Client Location",
      status: "Warning",
      message: "Client location is missing. Add it for a professional proposal.",
      isBlocking: false,
    });
  }

  if (client.discom && client.tariffCategory) {
    addCheck(checks, {
      title: "DISCOM & Tariff",
      status: "Pass",
      message: "DISCOM and tariff category are available.",
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "DISCOM & Tariff",
      status: "Warning",
      message: "DISCOM or tariff category is missing.",
      isBlocking: false,
    });
  }

  // PROPOSAL READINESS - BILL DATA CHECK
  if (bills.length > 0) {
    addCheck(checks, {
      title: "Electricity Bill Data",
      status: "Pass",
      message: `${bills.length} bill row(s) are available.`,
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Electricity Bill Data",
      status: "Fail",
      message: "No electricity bill data is available.",
      isBlocking: true,
    });
  }

  // PROPOSAL READINESS - CONNECTED LOAD CHECK
  if (connectedLoads.length > 0) {
    addCheck(checks, {
      title: "Connected Load Data",
      status: "Pass",
      message: `${connectedLoads.length} connected load row(s) are available.`,
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Connected Load Data",
      status: "Warning",
      message:
        "Connected load data is missing. Proposal can be exported, but connected load analysis will be weak.",
      isBlocking: false,
    });
  }

  // PROPOSAL READINESS - VALIDATION CHECK
  if (validation.errors.length === 0) {
    addCheck(checks, {
      title: "Validation Errors",
      status: "Pass",
      message: "No blocking validation errors found.",
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Validation Errors",
      status: "Fail",
      message: `${validation.errors.length} validation error(s) found.`,
      isBlocking: true,
    });
  }

  if (validation.warnings.length === 0) {
    addCheck(checks, {
      title: "Validation Warnings",
      status: "Pass",
      message: "No validation warnings found.",
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Validation Warnings",
      status: "Warning",
      message: `${validation.warnings.length} warning(s) should be reviewed.`,
      isBlocking: false,
    });
  }

  // PROPOSAL READINESS - EXTRACTION CONFIDENCE CHECK
  if (bills.length === 0) {
    addCheck(checks, {
      title: "Extraction Confidence",
      status: "Fail",
      message: "Extraction confidence cannot be calculated without bill data.",
      isBlocking: true,
    });
  } else if (averageExtractionConfidence >= 85) {
    addCheck(checks, {
      title: "Extraction Confidence",
      status: "Pass",
      message: `Average bill extraction confidence is ${averageExtractionConfidence}%.`,
      isBlocking: false,
    });
  } else if (averageExtractionConfidence >= 60) {
    addCheck(checks, {
      title: "Extraction Confidence",
      status: "Warning",
      message: `Average bill extraction confidence is ${averageExtractionConfidence}%. Manual review is recommended.`,
      isBlocking: false,
    });
  } else {
    addCheck(checks, {
      title: "Extraction Confidence",
      status: "Fail",
      message: `Average bill extraction confidence is only ${averageExtractionConfidence}%. Manual correction is required.`,
      isBlocking: true,
    });
  }

  // PROPOSAL READINESS - SIGNATURE CHECK
  addCheck(checks, {
    title: "Signature Section",
    status: "Pass",
    message:
      "Signature & Close section is available with SEE-Tech signatory details.",
    isBlocking: false,
  });

  const blockingIssues = checks
    .filter((check) => check.status === "Fail" && check.isBlocking)
    .map((check) => `${check.title}: ${check.message}`);

  const warnings = checks
    .filter((check) => check.status === "Warning")
    .map((check) => `${check.title}: ${check.message}`);

  const passCount = checks.filter((check) => check.status === "Pass").length;
  const score = Math.round((passCount / checks.length) * 100);

  const canExport = blockingIssues.length === 0;

  let status: ProposalReadinessResult["status"] = "Ready";

  if (!canExport) {
    status = "Not Ready";
  } else if (warnings.length > 0) {
    status = "Needs Review";
  }

  return {
    canExport,
    score,
    status,
    checks,
    blockingIssues,
    warnings,
  };
}