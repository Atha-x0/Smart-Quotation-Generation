import type { BillData } from "../types/billTypes";

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    confidenceScore: number;
}

function isMissingOrInvalid(value: number | undefined | null): boolean {
    return value === undefined || value === null || Number.isNaN(value) || value <= 0;
}

export function validateBills(bills: BillData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!bills || bills.length === 0) {
        errors.push("No bill data entered.");

        return {
            isValid: false,
            errors,
            warnings,
            confidenceScore: 0,
        };
    }

    if (bills.length < 12) {
        warnings.push("Less than 12 months data available. Trend analysis may be limited.");
    }

    bills.forEach((bill, index) => {
        const label = bill.month?.trim() || `Row ${index + 1}`;

        if (!bill.month || bill.month.trim() === "") {
            warnings.push(`Row ${index + 1}: Month is missing.`);
        }

        if (isMissingOrInvalid(bill.contractDemandKVA)) {
            errors.push(`${label}: Contract demand is missing or invalid.`);
        }

        if (isMissingOrInvalid(bill.actualDemandKVA)) {
            warnings.push(`${label}: Actual demand is missing or invalid.`);
        }

        if (isMissingOrInvalid(bill.kWh)) {
            errors.push(`${label}: kWh consumption is missing or invalid.`);
        }

        if (isMissingOrInvalid(bill.kVAh)) {
            errors.push(`${label}: kVAh consumption is missing or invalid.`);
        }

        if (bill.kWh > 0 && bill.kVAh > 0 && bill.kWh > bill.kVAh) {
            warnings.push(`${label}: kWh is greater than kVAh. Please check whether kWh and kVAh are swapped.`);
        }

        if (bill.powerFactor <= 0 || bill.powerFactor > 1) {
            warnings.push(`${label}: Power factor must be between 0 and 1.`);
        }

        if (bill.powerFactor > 0 && bill.powerFactor < 0.5) {
            warnings.push(`${label}: Power factor is unusually low. Please verify the value.`);
        }

        if (isMissingOrInvalid(bill.demandCharge)) {
            warnings.push(`${label}: Demand charge is missing or invalid.`);
        }

        if (isMissingOrInvalid(bill.energyCharge)) {
            warnings.push(`${label}: Energy charge is missing or invalid.`);
        }

        if (isMissingOrInvalid(bill.totalBillAmount)) {
            errors.push(`${label}: Total bill amount is missing or invalid.`);
        }

        const componentTotal =
            (bill.demandCharge || 0) +
            (bill.energyCharge || 0) +
            (bill.pfPenalty || 0) -
            (bill.pfIncentive || 0) +
            (bill.todCharges || 0) +
            (bill.otherCharges || 0);

        if (
            bill.totalBillAmount > 0 &&
            componentTotal > 0 &&
            Math.abs(componentTotal - bill.totalBillAmount) > bill.totalBillAmount * 0.25
        ) {
            warnings.push(
                `${label}: Bill component total differs from total bill amount by more than 25%. Please verify extracted values.`
            );
        }

        if (
            bill.billingDemandKVA &&
            bill.minBillingDemandKVA &&
            bill.billingDemandKVA < bill.minBillingDemandKVA
        ) {
            warnings.push(`${label}: Billing demand is lower than minimum billing demand. Please verify.`);
        }

        if (
            bill.contractDemandKVA > 0 &&
            bill.actualDemandKVA > bill.contractDemandKVA * 1.2
        ) {
            warnings.push(`${label}: Actual demand is more than 120% of contract demand.`);
        }
    });

    const possibleChecks = bills.length * 10;
    const issueCount = errors.length + warnings.length;

    const confidenceScore = Math.max(
        0,
        Math.min(100, Math.round(100 - (issueCount / possibleChecks) * 100))
    );

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        confidenceScore,
    };
}