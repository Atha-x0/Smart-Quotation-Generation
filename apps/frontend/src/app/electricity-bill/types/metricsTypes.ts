export interface MonthlyLoadFactor {
  month: string;
  loadFactor: number;
}

export interface CalculatedMetrics {
  totalAnnualSpend: number;
  avgMonthlyBill: number;
  maxMonthlyBill: number;

  contractDemandKVA: number;
  avgActualDemandKVA: number;
  maxActualDemandKVA: number;
  highestRecordedMDKVA: number;
  maxBillingDemandKVA: number;
  contractDemandUtilizationPct: number;
  suggestedContractDemandKVA: number;
  demandChargeRate: number;
  demandSavingsAnnual: number;

  avgPowerFactor: number;
  minPowerFactor: number;
  pfPenaltyMonths: number;
  requiredAPFCKVAR: number;
  pfSavingsAnnual: number;

  monthlyLoadFactors: MonthlyLoadFactor[];
  avgLoadFactor: number;
  loadFactorRating: "Low" | "Moderate" | "High";

  todSavingsAnnual: number;

  totalAnnualSavings: number;
  estimatedInvestment: number;
  paybackMonths: number;

  monthlyTrend: "Increasing" | "Decreasing" | "Stable";
  anomalies: string[];
}