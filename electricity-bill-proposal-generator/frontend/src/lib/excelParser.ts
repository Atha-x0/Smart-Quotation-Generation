import type { BillData } from "../types/billTypes";

function toNumber(value: unknown): number {
    if (value === undefined || value === null || value === "") return 0;

    if (typeof value === "number") return value;

    const cleaned = String(value)
        .replace(/,/g, "")
        .replace(/₹/g, "")
        .trim();

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function normalizeKey(key: string): string {
    return key
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .replace(/\./g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .replace(/\//g, "");
}

function getValue(row: Record<string, string>, possibleKeys: string[]): string {
    const normalizedRow: Record<string, string> = {};

    Object.keys(row).forEach((key) => {
        normalizedRow[normalizeKey(key)] = row[key];
    });

    for (const key of possibleKeys) {
        const normalizedKey = normalizeKey(key);

        if (normalizedKey in normalizedRow) {
            return normalizedRow[normalizedKey];
        }
    }

    return "";
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}

function parseCSV(text: string): Record<string, string>[] {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length < 2) {
        throw new Error("CSV must contain a header row and at least one data row.");
    }

    const headers = parseCSVLine(lines[0]).map((header) => header.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i += 1) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || "";
        });

        rows.push(row);
    }

    return rows;
}

export async function parseExcelFile(file: File): Promise<BillData[]> {
    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".csv")) {
        throw new Error("Only CSV files are supported in this safe MVP version.");
    }

    const text = await file.text();
    const rows = parseCSV(text);

    const bills: BillData[] = rows
        .map((row, index) => {
            const month =
                toText(
                    getValue(row, [
                        "Month",
                        "Bill Month",
                        "Billing Month",
                        "Period",
                        "Date",
                    ])
                ) || `Month ${index + 1}`;

            const contractDemandKVA = toNumber(
                getValue(row, [
                    "Contract Demand",
                    "Contract Demand KVA",
                    "CD",
                    "CD KVA",
                    "Sanctioned Demand",
                    "Sanctioned Load",
                ])
            );

            const actualDemandKVA = toNumber(
                getValue(row, [
                    "Actual Demand",
                    "Maximum Demand",
                    "MD",
                    "Recorded Demand",
                    "Actual Demand KVA",
                    "Max Demand",
                ])
            );

            const billingDemandKVA = toNumber(
                getValue(row, [
                    "Billing Demand",
                    "Billing Demand KVA",
                    "Bill Demand",
                    "Billed Demand",
                ])
            );

            const kWh = toNumber(
                getValue(row, [
                    "kWh",
                    "KWH",
                    "Units",
                    "Consumption",
                    "Energy Consumption",
                    "kWh Consumption",
                ])
            );

            const kVAh = toNumber(
                getValue(row, [
                    "kVAh",
                    "KVAH",
                    "kVAh Consumption",
                    "Apparent Energy",
                ])
            );

            const directPowerFactor = toNumber(
                getValue(row, ["PF", "Power Factor", "Avg PF", "Average PF"])
            );

            const powerFactor =
                directPowerFactor > 0
                    ? directPowerFactor
                    : kWh > 0 && kVAh > 0
                        ? kWh / kVAh
                        : 0;

            const demandCharge = toNumber(
                getValue(row, [
                    "Demand Charge",
                    "Demand Charges",
                    "MD Charges",
                    "Fixed Charge",
                    "Fixed Charges",
                ])
            );

            const energyCharge = toNumber(
                getValue(row, [
                    "Energy Charge",
                    "Energy Charges",
                    "Consumption Charge",
                    "Consumption Charges",
                    "Variable Charge",
                ])
            );

            const pfPenalty = toNumber(
                getValue(row, [
                    "PF Penalty",
                    "Power Factor Penalty",
                    "Reactive Penalty",
                ])
            );

            const pfIncentive = toNumber(
                getValue(row, ["PF Incentive", "Power Factor Incentive"])
            );

            const todCharges = toNumber(
                getValue(row, ["TOD", "TOD Charges", "Time of Day Charges"])
            );

            const otherCharges = toNumber(
                getValue(row, [
                    "Other Charges",
                    "Other Charge",
                    "Taxes",
                    "Duty",
                    "Electricity Duty",
                    "FAC",
                ])
            );

            const totalBillAmount = toNumber(
                getValue(row, [
                    "Total Bill",
                    "Total Bill Amount",
                    "Bill Amount",
                    "Net Amount",
                    "Total Amount",
                    "Amount Payable",
                ])
            );

            return {
                month,
                contractDemandKVA,
                actualDemandKVA,
                billingDemandKVA,
                kWh,
                kVAh,
                powerFactor,
                demandCharge,
                energyCharge,
                pfPenalty,
                pfIncentive,
                todCharges,
                otherCharges,
                totalBillAmount,
            };
        })
        .filter((bill) => {
            return (
                bill.month ||
                bill.kWh > 0 ||
                bill.kVAh > 0 ||
                bill.totalBillAmount > 0
            );
        });

    return bills;
}