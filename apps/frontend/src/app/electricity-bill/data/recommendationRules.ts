import type { CalculatedMetrics } from "../types/metricsTypes";
import type { ConnectedLoadData } from "../types/loadTypes";

export type RecommendationPriority = "High" | "Medium" | "Low";

export interface Recommendation {
  title: string;
  category: string;
  priority: RecommendationPriority;
  description: string;
  expectedImpact: string;
}

interface RecommendationContext {
  connectedLoads?: ConnectedLoadData[];
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round((value || 0) * factor) / factor;
}

function formatIndianNumber(value: number): string {
  return round(value, 0).toLocaleString("en-IN");
}

function getMetricNumber(
  metrics: CalculatedMetrics,
  keys: string[],
  fallback = 0
): number {
  const source = metrics as unknown as Record<string, unknown>;

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

function getMetricString(
  metrics: CalculatedMetrics,
  keys: string[],
  fallback = ""
): string {
  const source = metrics as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getTotalConnectedKW(connectedLoads: ConnectedLoadData[]): number {
  return connectedLoads.reduce((sum, item) => sum + (item.connectedKW || 0), 0);
}

function getAnnualSpend(metrics: CalculatedMetrics): number {
  const annualSpend = getMetricNumber(metrics, [
    "annualBillAmount",
    "estimatedAnnualizedSpend",
    "annualElectricitySpend",
    "totalAnnualBill",
  ]);

  if (annualSpend > 0) {
    return annualSpend;
  }

  const avgMonthlyBill = getMetricNumber(metrics, [
    "avgMonthlyBill",
    "averageMonthlyBill",
    "avgBillAmount",
  ]);

  return avgMonthlyBill > 0 ? avgMonthlyBill * 12 : 0;
}

function getAverageMonthlyConsumption(metrics: CalculatedMetrics): number {
  const avgMonthlyKWh = getMetricNumber(metrics, [
    "avgKWh",
    "averageKWh",
    "avgMonthlyKWh",
    "averageMonthlyConsumptionKWh",
    "avgMonthlyConsumption",
  ]);

  if (avgMonthlyKWh > 0) {
    return avgMonthlyKWh;
  }

  const totalKWh = getMetricNumber(metrics, [
    "totalKWh",
    "annualKWh",
    "totalConsumptionKWh",
  ]);

  const analysedMonths = getMetricNumber(metrics, [
    "analysedMonths",
    "billCount",
    "monthsAnalysed",
  ]);

  if (totalKWh > 0 && analysedMonths > 0) {
    return totalKWh / analysedMonths;
  }

  return 0;
}

function getAverageTariff(metrics: CalculatedMetrics): number {
  const averageTariff = getMetricNumber(metrics, [
    "averageTariff",
    "avgTariff",
    "averageRatePerKWh",
    "effectiveTariff",
  ]);

  if (averageTariff > 0) {
    return averageTariff;
  }

  const annualSpend = getAnnualSpend(metrics);
  const averageMonthlyConsumption = getAverageMonthlyConsumption(metrics);
  const annualConsumption = averageMonthlyConsumption * 12;

  if (annualSpend > 0 && annualConsumption > 0) {
    return annualSpend / annualConsumption;
  }

  return 0;
}

function getContractDemandKVA(metrics: CalculatedMetrics): number {
  return getMetricNumber(metrics, [
    "contractDemandKVA",
    "contractDemand",
    "sanctionedDemandKVA",
  ]);
}

function getHighestRecordedMDKVA(metrics: CalculatedMetrics): number {
  return getMetricNumber(metrics, [
    "maxActualDemandKVA",
    "highestRecordedMDKVA",
    "maximumDemandKVA",
    "maxDemandKVA",
    "actualDemandKVA",
    "maxBillingDemandKVA",
  ]);
}

function getBillingDemandKVA(metrics: CalculatedMetrics): number {
  return getMetricNumber(metrics, [
    "maxBillingDemandKVA",
    "billingDemandKVA",
    "maximumBillingDemandKVA",
  ]);
}

function estimateDemandSavings(
  metrics: CalculatedMetrics,
  demandReductionKVA: number
): number {
  const demandRate = getMetricNumber(metrics, [
    "demandChargeRate",
    "demandRatePerKVA",
    "demandChargePerKVA",
  ]);

  if (demandRate > 0 && demandReductionKVA > 0) {
    return demandReductionKVA * demandRate * 12;
  }

  const annualSpend = getAnnualSpend(metrics);

  if (annualSpend > 0 && demandReductionKVA > 0) {
    return annualSpend * 0.03;
  }

  return 0;
}

function addHtLtConversionRecommendation(
  recommendations: Recommendation[],
  metrics: CalculatedMetrics
) {
  const tariffCategory = getMetricString(metrics, [
    "tariffCategory",
    "tariff",
    "consumerTariff",
  ]).toUpperCase();

  const supplyType = getMetricString(metrics, [
    "supplyType",
    "consumerSupplyType",
    "voltageCategory",
  ]).toUpperCase();

  const contractDemandKVA = getContractDemandKVA(metrics);
  const highestRecordedMDKVA = getHighestRecordedMDKVA(metrics);
  const annualSpend = getAnnualSpend(metrics);

  const hasRequiredValues =
    (tariffCategory.length > 0 || supplyType.length > 0) &&
    contractDemandKVA > 0 &&
    highestRecordedMDKVA > 0 &&
    annualSpend > 0;

  if (!hasRequiredValues) {
    return;
  }

  const appearsHT =
    tariffCategory.includes("HT") ||
    supplyType.includes("HT") ||
    contractDemandKVA >= 100;

  const appearsLT =
    tariffCategory.includes("LT") ||
    supplyType.includes("LT") ||
    contractDemandKVA < 100;

  const lowHTUtilization =
    appearsHT && highestRecordedMDKVA / contractDemandKVA < 0.55;

  const possibleLTToHTCase =
    appearsLT && (highestRecordedMDKVA >= 75 || contractDemandKVA >= 75);

  if (!lowHTUtilization && !possibleLTToHTCase) {
    return;
  }

  const preliminarySaving = annualSpend * 0.03;

  recommendations.push({
    title: "HT ↔️ LT Conversion Feasibility",
    category: "Tariff Optimization",
    priority: "Medium",
    description: lowHTUtilization
      ? `The consumer appears to be operating on HT supply with low demand utilization. Contract Demand is ${round(
          contractDemandKVA,
          0
        )} kVA and Highest Recorded MD is ${round(
          highestRecordedMDKVA,
          0
        )} kVA. A detailed HT versus LT tariff comparison should be carried out to check whether fixed demand charges, billing demand rules, and energy tariff difference justify conversion. Preliminary annual saving potential may be around ₹${formatIndianNumber(
          preliminarySaving
        )}, subject to DISCOM rules, connected load limits, metering changes, and security deposit impact.`
      : `The consumer appears to be near the LT/HT decision range. Contract Demand is ${round(
          contractDemandKVA,
          0
        )} kVA and Highest Recorded MD is ${round(
          highestRecordedMDKVA,
          0
        )} kVA. A detailed LT versus HT feasibility review can identify whether changing supply category reduces energy charges, demand charges, penalties, or future expansion risk. Preliminary annual saving potential may be around ₹${formatIndianNumber(
          preliminarySaving
        )}, subject to tariff order and DISCOM approval.`,
    expectedImpact:
      "Useful for selecting the most economical supply category and avoiding unnecessary tariff cost due to wrong HT/LT classification.",
  });
}

function addContractDemandRecommendation(
  recommendations: Recommendation[],
  metrics: CalculatedMetrics
) {
  const contractDemandKVA = getContractDemandKVA(metrics);
  const highestRecordedMDKVA = getHighestRecordedMDKVA(metrics);
  const billingDemandKVA = getBillingDemandKVA(metrics);

  if (contractDemandKVA <= 0 || highestRecordedMDKVA <= 0) {
    return;
  }

  const cdUtilizationPct = (highestRecordedMDKVA / contractDemandKVA) * 100;
  const isOverContracted = cdUtilizationPct < 80;
  const isStrongReductionOpportunity = cdUtilizationPct < 60;
  const isUnderContracted = cdUtilizationPct > 100;

  if (!isOverContracted && !isUnderContracted) {
    return;
  }

  const demandForRecommendation =
    billingDemandKVA > 0 ? billingDemandKVA : highestRecordedMDKVA;

  const suggestedContractDemandKVA = Math.ceil(demandForRecommendation * 1.1);
  const demandReductionKVA = Math.max(
    0,
    contractDemandKVA - suggestedContractDemandKVA
  );

  const annualSavings = isOverContracted
    ? estimateDemandSavings(metrics, demandReductionKVA)
    : 0;

  recommendations.push({
    title: "Contract Demand Optimization",
    category: "Demand Optimization",
    priority: isStrongReductionOpportunity || isUnderContracted ? "High" : "Medium",
    description: isOverContracted
      ? `${
          isStrongReductionOpportunity
            ? "Strong contract demand reduction opportunity is indicated."
            : "Contract demand reduction evaluation is indicated."
        } CD Utilization is ${round(
          cdUtilizationPct,
          1
        )}% based on Highest Recorded MD of ${round(
          highestRecordedMDKVA,
          0
        )} kVA against Contract Demand of ${round(
          contractDemandKVA,
          0
        )} kVA. Since Contract Demand is more than 1.25 times the Highest Recorded MD, the existing CD appears higher than actual requirement. Preliminary optimum Contract Demand can be reviewed around ${round(
          suggestedContractDemandKVA,
          0
        )} kVA after checking 6 to 12 months of demand trend, production plan, seasonal load, and expansion requirement. ${
          annualSavings > 0
            ? `Estimated annual saving from demand charge reduction may be around ₹${formatIndianNumber(
                annualSavings
              )}.`
            : "Annual savings should be calculated using the applicable demand charge rate."
        }`
      : `CD Utilization is ${round(
          cdUtilizationPct,
          1
        )}%, which indicates that Highest Recorded MD is higher than the Contract Demand. Existing Contract Demand is ${round(
          contractDemandKVA,
          0
        )} kVA and Highest Recorded MD is ${round(
          highestRecordedMDKVA,
          0
        )} kVA. Contract Demand enhancement or peak load control should be evaluated to reduce excess demand penalty risk.`,
    expectedImpact: isOverContracted
      ? "Useful for reducing fixed demand charges by aligning Contract Demand with actual recorded maximum demand."
      : "Useful for avoiding excess demand penalties and improving demand planning.",
  });
}

function addPowerFactorRecommendation(
  recommendations: Recommendation[],
  metrics: CalculatedMetrics
) {
  const avgPowerFactor = getMetricNumber(metrics, [
    "avgPowerFactor",
    "averagePowerFactor",
    "powerFactor",
  ]);

  const minPowerFactor = getMetricNumber(metrics, [
    "minPowerFactor",
    "minimumPowerFactor",
  ]);

  const pfPenaltyMonths = getMetricNumber(metrics, ["pfPenaltyMonths"]);

  const requiredAPFCKVAR = getMetricNumber(metrics, [
    "requiredAPFCKVAR",
    "requiredApfcKvar",
    "additionalKVAR",
  ]);

  const annualPfPenalty = getMetricNumber(metrics, [
    "annualPfPenalty",
    "pfPenaltyAnnual",
    "annualPFCharges",
  ]);

  if (avgPowerFactor <= 0) {
    return;
  }

  const hasPfIssue =
    avgPowerFactor < 0.98 ||
    minPowerFactor < 0.98 ||
    pfPenaltyMonths > 0 ||
    annualPfPenalty > 0;

  if (!hasPfIssue) {
    return;
  }

  recommendations.push({
    title: "Power Factor (PF) Improvement",
    category: "Power Factor",
    priority: avgPowerFactor < 0.95 || pfPenaltyMonths > 0 ? "High" : "Medium",
    description: `Average power factor is ${avgPowerFactor.toFixed(3)}${
      minPowerFactor > 0
        ? ` and minimum power factor is ${minPowerFactor.toFixed(3)}`
        : ""
    }. This indicates scope to improve billing performance by maintaining target PF close to 0.99. Existing capacitor banks, APFC relay settings, capacitor health, harmonic conditions, and kVAh billing impact should be checked. ${
      requiredAPFCKVAR > 0
        ? `Preliminary additional compensation requirement is approximately ${round(
            requiredAPFCKVAR,
            0
          )} kVAR. `
        : ""
    }${
      annualPfPenalty > 0
        ? `Estimated annual penalty reduction potential is around ₹${formatIndianNumber(
            annualPfPenalty
          )}.`
        : "Savings can come from PF penalty reduction, PF incentive improvement, and better kVAh billing."
    }`,
    expectedImpact:
      "Useful for reducing PF penalty, improving PF incentive, reducing kVAh billing impact, and improving electrical system efficiency.",
  });
}

function addTodRecommendation(
  recommendations: Recommendation[],
  metrics: CalculatedMetrics
) {
  const todSavingsAnnual = getMetricNumber(metrics, [
    "todSavingsAnnual",
    "annualTodSavings",
    "todPotentialSavings",
  ]);

  const todCharges = getMetricNumber(metrics, [
    "todCharges",
    "todPenalty",
    "todPeakCharges",
    "todCost",
  ]);

  const peakConsumptionKWh = getMetricNumber(metrics, [
    "peakHourKWh",
    "todPeakKWh",
    "peakZoneConsumptionKWh",
  ]);

  const offPeakConsumptionKWh = getMetricNumber(metrics, [
    "offPeakKWh",
    "todOffPeakKWh",
    "offPeakZoneConsumptionKWh",
  ]);

  const hasRequiredTodValues =
    todSavingsAnnual > 0 ||
    todCharges > 0 ||
    peakConsumptionKWh > 0 ||
    offPeakConsumptionKWh > 0;

  if (!hasRequiredTodValues) {
    return;
  }

  const hasTodOpportunity =
    todSavingsAnnual > 0 ||
    todCharges > 0 ||
    (peakConsumptionKWh > 0 && peakConsumptionKWh > offPeakConsumptionKWh);

  if (!hasTodOpportunity) {
    return;
  }

  recommendations.push({
    title: "Time of Day (TOD) Utilization Optimization",
    category: "TOD Optimization",
    priority: todSavingsAnnual > 0 || todCharges > 0 ? "Medium" : "Low",
    description: `TOD data indicates possible opportunity for tariff optimization. ${
      peakConsumptionKWh > 0
        ? `Peak-hour consumption is ${formatIndianNumber(
            peakConsumptionKWh
          )} kWh. `
        : ""
    }Non-critical loads should be reviewed for shifting from peak tariff periods to off-peak or incentive periods wherever process permits. ${
      todCharges > 0
        ? `TOD-related charges identified are approximately ₹${formatIndianNumber(
            todCharges
          )}. `
        : ""
    }${
      todSavingsAnnual > 0
        ? `Estimated annual saving potential is around ₹${formatIndianNumber(
            todSavingsAnnual
          )}.`
        : "Savings should be calculated after reviewing TOD-wise monthly consumption from bill, meter, or AMR data."
    }`,
    expectedImpact:
      "Useful for reducing peak-period energy cost and improving use of off-peak tariff incentives without major capital investment.",
  });
}

function addRooftopSolarRecommendation(
  recommendations: Recommendation[],
  metrics: CalculatedMetrics,
  connectedLoads: ConnectedLoadData[]
) {
  const averageMonthlyConsumption = getAverageMonthlyConsumption(metrics);
  const annualConsumptionKWh = averageMonthlyConsumption * 12;
  const averageTariff = getAverageTariff(metrics);
  const annualSpend = getAnnualSpend(metrics);
  const highestRecordedMDKVA = getHighestRecordedMDKVA(metrics);
  const totalConnectedKW = getTotalConnectedKW(connectedLoads);

  const existingSolarKW = getMetricNumber(metrics, [
    "solarCapacityKW",
    "existingSolarKW",
    "rooftopSolarKW",
  ]);

  const exportKWh = getMetricNumber(metrics, [
    "solarExportKWh",
    "exportKWh",
    "netExportKWh",
  ]);

  const importKWh = getMetricNumber(metrics, [
    "importKWh",
    "netImportKWh",
    "gridImportKWh",
  ]);

  const hasRequiredSolarValues =
    annualConsumptionKWh > 0 ||
    annualSpend > 0 ||
    existingSolarKW > 0 ||
    exportKWh > 0 ||
    importKWh > 0;

  if (!hasRequiredSolarValues) {
    return;
  }

  const hasEnoughConsumptionForSolar =
    annualConsumptionKWh >= 50000 || annualSpend >= 500000;

  const hasSolarData = existingSolarKW > 0 || exportKWh > 0 || importKWh > 0;

  if (!hasEnoughConsumptionForSolar && !hasSolarData) {
    return;
  }

  const capacityFromConsumption =
    annualConsumptionKWh > 0 ? annualConsumptionKWh / 1400 : 0;

  const capacityFromDemand =
    highestRecordedMDKVA > 0 ? highestRecordedMDKVA * 0.7 : 0;

  const capacityFromConnectedLoad =
    totalConnectedKW > 0 ? totalConnectedKW * 0.5 : 0;

  const possibleCapacities = [
    capacityFromConsumption,
    capacityFromDemand,
    capacityFromConnectedLoad,
  ].filter((value) => value > 0);

  const recommendedCapacityKW =
    possibleCapacities.length > 0 ? Math.min(...possibleCapacities) : 0;

  const annualGenerationKWh =
    recommendedCapacityKW > 0 ? recommendedCapacityKW * 1400 : 0;

  const annualSolarSavings =
    annualGenerationKWh > 0 && averageTariff > 0
      ? annualGenerationKWh * averageTariff
      : 0;

  recommendations.push({
    title: "Rooftop Solar Utilization Assessment",
    category: "Renewable Energy",
    priority: existingSolarKW > 0 ? "Medium" : "Low",
    description: `${
      existingSolarKW > 0
        ? `Existing solar capacity of approximately ${round(
            existingSolarKW,
            0
          )} kW is indicated in the bill data. Solar import/export and self-consumption should be reviewed to improve utilization. `
        : "Electricity consumption is high enough to evaluate rooftop solar feasibility. "
    }${
      annualConsumptionKWh > 0
        ? `Estimated annual consumption is around ${formatIndianNumber(
            annualConsumptionKWh
          )} kWh. `
        : ""
    }${
      recommendedCapacityKW > 0
        ? `Preliminary recommended rooftop solar capacity for assessment is around ${round(
            recommendedCapacityKW,
            0
          )} kW, with expected annual generation of approximately ${formatIndianNumber(
            annualGenerationKWh
          )} kWh. `
        : "Recommended capacity should be calculated after reviewing connected load, roof area, sanctioned load, and consumption profile. "
    }${
      annualSolarSavings > 0
        ? `Estimated annual electricity cost saving may be around ₹${formatIndianNumber(
            annualSolarSavings
          )}.`
        : "Annual saving should be calculated using applicable tariff, net-metering rules, and self-consumption ratio."
    }`,
    expectedImpact:
      "Useful for reducing grid energy purchase, improving renewable energy share, and lowering annual electricity cost where roof area and DISCOM rules permit.",
  });
}

function prioritizeRecommendations(
  recommendations: Recommendation[]
): Recommendation[] {
  const priorityRank: Record<RecommendationPriority, number> = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return recommendations.sort((a, b) => {
    const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.category.localeCompare(b.category);
  });
}

export function generateRecommendations(
  metrics: CalculatedMetrics,
  context: RecommendationContext = {}
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const connectedLoads = context.connectedLoads || [];

  addHtLtConversionRecommendation(recommendations, metrics);
  addContractDemandRecommendation(recommendations, metrics);
  addPowerFactorRecommendation(recommendations, metrics);
  addTodRecommendation(recommendations, metrics);
  addRooftopSolarRecommendation(recommendations, metrics, connectedLoads);

  return prioritizeRecommendations(recommendations);
}