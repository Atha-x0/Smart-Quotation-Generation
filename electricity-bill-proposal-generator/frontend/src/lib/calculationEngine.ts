import type { BillData } from "../types/billTypes";
import type { CalculatedMetrics, MonthlyLoadFactor } from "../types/metricsTypes";

function safeNumber(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }

  return Number(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function max(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values.map((value) => safeNumber(value)));
}

function min(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values.map((value) => safeNumber(value)));
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(safeNumber(value) * factor) / factor;
}

function getTrend(values: number[]): "Increasing" | "Decreasing" | "Stable" {
  if (values.length < 3) {
    return "Stable";
  }

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.ceil(values.length / 2));

  const firstAverage = average(firstHalf);
  const secondAverage = average(secondHalf);

  if (firstAverage <= 0) {
    return "Stable";
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

function calculateMonthlyLoadFactor(bill: BillData): number {
  const kWh = safeNumber(bill.kWh);
  const actualDemandKVA = safeNumber(bill.actualDemandKVA);
  const powerFactor = safeNumber(bill.powerFactor);

  if (kWh <= 0 || actualDemandKVA <= 0 || powerFactor <= 0) {
    return 0;
  }

  const estimatedKW = actualDemandKVA * powerFactor;
  const monthlyHours = 30 * 24;

  if (estimatedKW <= 0) {
    return 0;
  }

  return (kWh / (estimatedKW * monthlyHours)) * 100;
}

function getLoadFactorRating(
  avgLoadFactor: number
): "Low" | "Moderate" | "High" {
  if (avgLoadFactor < 45) {
    return "Low";
  }

  if (avgLoadFactor < 65) {
    return "Moderate";
  }

  return "High";
}

function estimateRequiredAPFCKVAR(bills: BillData[]): number {
  const targetPF = 0.99;

  const requiredValues = bills.map((bill) => {
    const kWh = safeNumber(bill.kWh);
    const kVAh = safeNumber(bill.kVAh);
    const pf = safeNumber(bill.powerFactor);

    if (kWh <= 0 || kVAh <= 0 || pf <= 0 || pf >= targetPF) {
      return 0;
    }

    const avgKW = kWh / (30 * 24);
    const presentAngle = Math.acos(Math.min(Math.max(pf, 0.01), 0.999));
    const targetAngle = Math.acos(targetPF);

    const requiredKVAR =
      avgKW * (Math.tan(presentAngle) - Math.tan(targetAngle));

    return Math.max(0, requiredKVAR);
  });

  return max(requiredValues);
}

function detectAnomalies(bills: BillData[]): string[] {
  const anomalies: string[] = [];

  bills.forEach((bill) => {
    const month = bill.month || "Unknown month";
    const contractDemand = safeNumber(bill.contractDemandKVA);
    const actualDemand = safeNumber(bill.actualDemandKVA);
    const billingDemand = safeNumber(bill.billingDemandKVA);
    const kWh = safeNumber(bill.kWh);
    const kVAh = safeNumber(bill.kVAh);
    const pf = safeNumber(bill.powerFactor);
    const totalBill = safeNumber(bill.totalBillAmount);

    if (contractDemand <= 0) {
      anomalies.push(`${month}: Contract demand is missing or zero.`);
    }

    if (actualDemand <= 0) {
      anomalies.push(`${month}: Actual demand is missing or zero.`);
    }

    if (billingDemand <= 0) {
      anomalies.push(`${month}: Billing demand is missing or zero.`);
    }

    if (kWh <= 0) {
      anomalies.push(`${month}: kWh consumption is missing or zero.`);
    }

    if (kVAh <= 0) {
      anomalies.push(`${month}: kVAh consumption is missing or zero.`);
    }

    if (pf <= 0 || pf > 1) {
      anomalies.push(`${month}: Power factor appears invalid.`);
    }

    if (totalBill <= 0) {
      anomalies.push(`${month}: Total bill amount is missing or zero.`);
    }

    if (contractDemand > 0 && actualDemand > contractDemand * 1.2) {
      anomalies.push(
        `${month}: Actual demand is more than 120% of contract demand.`
      );
    }

    if (kVAh > 0 && kWh > kVAh * 1.02) {
      anomalies.push(`${month}: kWh is higher than kVAh. Please verify values.`);
    }
  });

  return anomalies;
}

function getRepresentativeContractDemand(bills: BillData[]): number {
  const contractDemandValues = bills
    .map((bill) => safeNumber(bill.contractDemandKVA))
    .filter((value) => value > 0);

  if (contractDemandValues.length === 0) {
    return 0;
  }

  return contractDemandValues[0];
}

export function calculateMetrics(bills: BillData[]): CalculatedMetrics {
  if (bills.length === 0) {
    return {
      totalAnnualSpend: 0,
      avgMonthlyBill: 0,
      maxMonthlyBill: 0,

      contractDemandKVA: 0,
      avgActualDemandKVA: 0,
      maxActualDemandKVA: 0,
      highestRecordedMDKVA: 0,
      maxBillingDemandKVA: 0,
      contractDemandUtilizationPct: 0,
      suggestedContractDemandKVA: 0,
      demandChargeRate: 0,
      demandSavingsAnnual: 0,

      avgPowerFactor: 0,
      minPowerFactor: 0,
      pfPenaltyMonths: 0,
      requiredAPFCKVAR: 0,
      pfSavingsAnnual: 0,

      monthlyLoadFactors: [],
      avgLoadFactor: 0,
      loadFactorRating: "Low",

      todSavingsAnnual: 0,

      totalAnnualSavings: 0,
      estimatedInvestment: 0,
      paybackMonths: 0,

      monthlyTrend: "Stable",
      anomalies: [],
    };
  }

  const billAmounts = bills.map((bill) => safeNumber(bill.totalBillAmount));

  const actualDemandValues = bills.map((bill) =>
    safeNumber(bill.actualDemandKVA)
  );

  const billingDemandValues = bills.map((bill) =>
    safeNumber(bill.billingDemandKVA || bill.actualDemandKVA)
  );

  const powerFactorValues = bills.map((bill) => safeNumber(bill.powerFactor));
  const kWhValues = bills.map((bill) => safeNumber(bill.kWh));

  const firstBill = bills[0];

  const avgMonthlyBill = average(billAmounts);
  const maxMonthlyBill = max(billAmounts);
  const totalAnnualSpend = avgMonthlyBill * 12;

  const contractDemandKVA = getRepresentativeContractDemand(bills);

  const avgActualDemandKVA = average(actualDemandValues);

  const maxActualDemandKVA = max(actualDemandValues);

  const highestRecordedMDKVA = maxActualDemandKVA;

  const maxBillingDemandKVA = max(billingDemandValues);

  const contractDemandUtilizationPct =
    contractDemandKVA > 0 && highestRecordedMDKVA > 0
      ? (highestRecordedMDKVA / contractDemandKVA) * 100
      : 0;

  const suggestedContractDemandKVA =
    highestRecordedMDKVA > 0 ? Math.ceil(highestRecordedMDKVA * 1.1) : 0;

  const reducibleDemandKVA =
    contractDemandKVA > 0 && suggestedContractDemandKVA > 0
      ? Math.max(0, contractDemandKVA - suggestedContractDemandKVA)
      : 0;

  const demandChargeRate =
    contractDemandKVA > 0 && safeNumber(firstBill.demandCharge) > 0
      ? safeNumber(firstBill.demandCharge) / contractDemandKVA
      : 0;

  const demandSavingsAnnual = reducibleDemandKVA * demandChargeRate * 12;

  const avgPowerFactor = average(powerFactorValues);
  const minPowerFactor = min(powerFactorValues);

  const pfPenaltyMonths = bills.filter(
    (bill) =>
      safeNumber(bill.powerFactor) > 0 && safeNumber(bill.powerFactor) < 0.95
  ).length;

  const requiredAPFCKVAR = estimateRequiredAPFCKVAR(bills);

  const pfSavingsAnnual =
    bills.length > 0
      ? (sum(bills.map((bill) => safeNumber(bill.pfPenalty))) * 12) /
        bills.length
      : 0;

  const monthlyLoadFactors: MonthlyLoadFactor[] = bills.map((bill) => ({
    month: bill.month,
    loadFactor: round(calculateMonthlyLoadFactor(bill), 2),
  }));

  const avgLoadFactor = average(
    monthlyLoadFactors.map((item) => safeNumber(item.loadFactor))
  );

  const loadFactorRating = getLoadFactorRating(avgLoadFactor);

  const todSavingsAnnual =
    bills.length > 0
      ? sum(bills.map((bill) => Math.max(0, safeNumber(bill.todCharges)))) *
        0.15 *
        (12 / bills.length)
      : 0;

  const totalAnnualSavings =
    safeNumber(demandSavingsAnnual) +
    safeNumber(pfSavingsAnnual) +
    safeNumber(todSavingsAnnual);

  const estimatedInvestment =
    requiredAPFCKVAR > 0
      ? requiredAPFCKVAR * 1200
      : totalAnnualSavings > 0
        ? totalAnnualSavings * 0.45
        : 0;

  const paybackMonths =
    totalAnnualSavings > 0 && estimatedInvestment > 0
      ? (estimatedInvestment / totalAnnualSavings) * 12
      : 0;

  const monthlyTrend = getTrend(kWhValues);
  const anomalies = detectAnomalies(bills);

  return {
    totalAnnualSpend: round(totalAnnualSpend, 2),
    avgMonthlyBill: round(avgMonthlyBill, 2),
    maxMonthlyBill: round(maxMonthlyBill, 2),

    contractDemandKVA: round(contractDemandKVA, 2),
    avgActualDemandKVA: round(avgActualDemandKVA, 2),
    maxActualDemandKVA: round(maxActualDemandKVA, 2),
    highestRecordedMDKVA: round(highestRecordedMDKVA, 2),
    maxBillingDemandKVA: round(maxBillingDemandKVA, 2),
    contractDemandUtilizationPct: round(contractDemandUtilizationPct, 2),
    suggestedContractDemandKVA: round(suggestedContractDemandKVA, 2),
    demandChargeRate: round(demandChargeRate, 2),
    demandSavingsAnnual: round(demandSavingsAnnual, 2),

    avgPowerFactor: round(avgPowerFactor, 3),
    minPowerFactor: round(minPowerFactor, 3),
    pfPenaltyMonths,
    requiredAPFCKVAR: round(requiredAPFCKVAR, 2),
    pfSavingsAnnual: round(pfSavingsAnnual, 2),

    monthlyLoadFactors,
    avgLoadFactor: round(avgLoadFactor, 2),
    loadFactorRating,

    todSavingsAnnual: round(todSavingsAnnual, 2),

    totalAnnualSavings: round(totalAnnualSavings, 2),
    estimatedInvestment: round(estimatedInvestment, 2),
    paybackMonths: round(paybackMonths, 2),

    monthlyTrend,
    anomalies,
  };
}