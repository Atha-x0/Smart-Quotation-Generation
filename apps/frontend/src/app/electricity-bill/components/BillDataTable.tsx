import type { BillData } from "../types/billTypes";

interface BillDataTableProps {
    bills: BillData[];
    onChange: (bills: BillData[]) => void;
}

type NumericBillField =
    | "contractDemandKVA"
    | "actualDemandKVA"
    | "billingDemandKVA"
    | "minBillingDemandKVA"
    | "kWh"
    | "kVAh"
    | "powerFactor"
    | "demandCharge"
    | "energyCharge"
    | "pfPenalty"
    | "pfIncentive"
    | "todCharges"
    | "otherCharges"
    | "totalBillAmount";

function BillDataTable({ bills, onChange }: BillDataTableProps) {
    function updateTextField(index: number, field: "month", value: string) {
        const updatedBills = bills.map((bill, billIndex) => {
            if (billIndex !== index) return bill;

            return {
                ...bill,
                [field]: value,
            };
        });

        onChange(updatedBills);
    }

    function updateNumberField(index: number, field: NumericBillField, value: string) {
        const numericValue = value === "" ? 0 : Number(value);

        const updatedBills = bills.map((bill, billIndex) => {
            if (billIndex !== index) return bill;

            return {
                ...bill,
                [field]: Number.isNaN(numericValue) ? 0 : numericValue,
            };
        });

        onChange(updatedBills);
    }

    function addMonth() {
        const newBill: BillData = {
            month: `Month ${bills.length + 1}`,
            contractDemandKVA: bills[0]?.contractDemandKVA || 0,
            actualDemandKVA: 0,
            billingDemandKVA: 0,
            kWh: 0,
            kVAh: 0,
            powerFactor: 0,
            demandCharge: 0,
            energyCharge: 0,
            pfPenalty: 0,
            otherCharges: 0,
            totalBillAmount: 0,
        };

        onChange([...bills, newBill]);
    }

    function removeMonth(index: number) {
        const updatedBills = bills.filter((_, billIndex) => billIndex !== index);
        onChange(updatedBills);
    }

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Monthly Bill Data Input</h2>
                    <p className="text-sm text-slate-500">
                        Edit the billing values below. Dashboard and proposal will update automatically.
                    </p>
                </div>

                <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" onClick={addMonth}>
                    + Add Month
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mt-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50/80 text-slate-400 text-[10px] uppercase tracking-wider font-bold border-b border-slate-200">
                            <th className="px-4 py-3">Month</th>
                            <th className="px-4 py-3">CD kVA</th>
                            <th className="px-4 py-3">Actual Demand</th>
                            <th className="px-4 py-3">Billing Demand</th>
                            <th className="px-4 py-3">kWh</th>
                            <th className="px-4 py-3">kVAh</th>
                            <th className="px-4 py-3">PF</th>
                            <th className="px-4 py-3">Demand Charge</th>
                            <th className="px-4 py-3">Energy Charge</th>
                            <th className="px-4 py-3">PF Penalty</th>
                            <th className="px-4 py-3">Other Charges</th>
                            <th className="px-4 py-3">Total Bill</th>
                            <th className="px-4 py-3">Action</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-sm">
                        {bills.map((bill, index) => (
                            <tr key={`${bill.month}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3">
                                    <input
                                        className="table-input text-input"
                                        type="text"
                                        value={bill.month}
                                        onChange={(event) =>
                                            updateTextField(index, "month", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.contractDemandKVA}
                                        onChange={(event) =>
                                            updateNumberField(index, "contractDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.actualDemandKVA}
                                        onChange={(event) =>
                                            updateNumberField(index, "actualDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.billingDemandKVA || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "billingDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.kWh}
                                        onChange={(event) =>
                                            updateNumberField(index, "kWh", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.kVAh}
                                        onChange={(event) =>
                                            updateNumberField(index, "kVAh", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input small-input"
                                        type="number"
                                        step="0.001"
                                        value={bill.powerFactor}
                                        onChange={(event) =>
                                            updateNumberField(index, "powerFactor", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.demandCharge}
                                        onChange={(event) =>
                                            updateNumberField(index, "demandCharge", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.energyCharge}
                                        onChange={(event) =>
                                            updateNumberField(index, "energyCharge", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.pfPenalty || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "pfPenalty", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.otherCharges || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "otherCharges", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.totalBillAmount}
                                        onChange={(event) =>
                                            updateNumberField(index, "totalBillAmount", event.target.value)
                                        }
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <button
                                        type="button"
                                        className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs"
                                        onClick={() => removeMonth(index)}
                                        disabled={bills.length === 1}
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
        </section>
    );
}

export default BillDataTable;