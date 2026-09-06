import type { BillData } from "../types/billTypes";

interface DataActionsProps {
    bills: BillData[];
    defaultBills: BillData[];
    onChange: (bills: BillData[]) => void;
}

function createEmptyBill(monthName: string, contractDemandKVA = 0): BillData {
    return {
        month: monthName,
        contractDemandKVA,
        actualDemandKVA: 0,
        billingDemandKVA: 0,
        minBillingDemandKVA: 0,
        kWh: 0,
        kVAh: 0,
        powerFactor: 0,
        demandCharge: 0,
        energyCharge: 0,
        pfPenalty: 0,
        pfIncentive: 0,
        todCharges: 0,
        otherCharges: 0,
        totalBillAmount: 0,
    };
}

function DataActions({ bills, defaultBills, onChange }: DataActionsProps) {
    function resetSampleData() {
        onChange(defaultBills);
    }

    function clearAllData() {
        const contractDemandKVA = bills[0]?.contractDemandKVA || 0;

        const emptyBills: BillData[] = [
            createEmptyBill("Month 1", contractDemandKVA),
            createEmptyBill("Month 2", contractDemandKVA),
            createEmptyBill("Month 3", contractDemandKVA),
            createEmptyBill("Month 4", contractDemandKVA),
            createEmptyBill("Month 5", contractDemandKVA),
            createEmptyBill("Month 6", contractDemandKVA),
            createEmptyBill("Month 7", contractDemandKVA),
            createEmptyBill("Month 8", contractDemandKVA),
            createEmptyBill("Month 9", contractDemandKVA),
            createEmptyBill("Month 10", contractDemandKVA),
            createEmptyBill("Month 11", contractDemandKVA),
            createEmptyBill("Month 12", contractDemandKVA),
        ];

        onChange(emptyBills);
    }

    function duplicateLastMonth() {
        const lastBill = bills[bills.length - 1];

        if (!lastBill) {
            onChange([createEmptyBill("Month 1")]);
            return;
        }

        const duplicateBill: BillData = {
            ...lastBill,
            month: `Month ${bills.length + 1}`,
        };

        onChange([...bills, duplicateBill]);
    }

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 action-panel">
            <div>
                <h2>Data Actions</h2>
                <p className="section-note">
                    Use these controls to quickly prepare or reset monthly bill data.
                </p>
            </div>

            <div className="action-buttons">
                <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" onClick={duplicateLastMonth}>
                    Duplicate Last Month
                </button>

                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" onClick={resetSampleData}>
                    Reset Sample Data
                </button>

                <button type="button" className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs" onClick={clearAllData}>
                    Clear All Data
                </button>
            </div>
        </section>
    );
}

export default DataActions;