export interface BillData {
  month: string;

  contractDemandKVA: number;
  actualDemandKVA: number;
  billingDemandKVA?: number;
  minBillingDemandKVA?: number;

  kWh: number;
  kVAh: number;
  powerFactor: number;

  demandCharge: number;
  energyCharge: number;
  pfPenalty?: number;
  pfIncentive?: number;
  todCharges?: number;
  otherCharges?: number;

  totalBillAmount: number;

  sourceFile?: string;
  detectedBillFormat?: string;
  parser?: string;
  extractionConfidence?: number;
  extractionWarnings?: string[];

  supplyVoltageKV?: number;
  multiplyingFactor?: number;
  securityDepositCash?: number;
  electricityTax?: number;

  /* =========================================================
     MSEDCL HT BILL EXTRA FIELDS
     These fields come from msedcl_ht_bill_parser.
     They are optional so PGVCL / generic parser will not break.
     ========================================================= */

  consumerNumber?: string;
  consumerName?: string;
  discom?: string;
  tariffCategory?: string;

  connectedLoadKW?: number;
  sanctionedLoadKW?: number;
  solarCapacityKW?: number;
  actualDemandKW?: number;
  solarAdjustmentKWH?: number;

  facCharge?: number;
  wheelingCharge?: number;
  taxOnSale?: number;
  gridSupportCharge?: number;
  promptPaymentDiscount?: number;
  govtSubsidy?: number;
}

export interface ClientDetails {
  companyName: string;
  location?: string;
  industryType?: string;
  discom?: string;
  tariffCategory?: string;
  contactPerson?: string;
}

export type ProposalType =
  | "BILL_ANALYSIS"
  | "APFC_PROPOSAL"
  | "CONTRACT_DEMAND_OPTIMIZATION"
  | "ENERGY_SAVING_PROPOSAL";

export interface AuditInput {
  client: ClientDetails;
  proposalType: ProposalType;
  bills: BillData[];
}