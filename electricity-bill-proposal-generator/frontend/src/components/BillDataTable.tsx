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
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2>Monthly Bill Data Input</h2>
                    <p className="section-note">
                        Edit the billing values below. Dashboard and proposal will update automatically.
                    </p>
                </div>

                <button type="button" className="primary-button" onClick={addMonth}>
                    + Add Month
                </button>
            </div>

            <div className="table-wrap">
                <table className="editable-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>CD kVA</th>
                            <th>Actual Demand</th>
                            <th>Billing Demand</th>
                            <th>kWh</th>
                            <th>kVAh</th>
                            <th>PF</th>
                            <th>Demand Charge</th>
                            <th>Energy Charge</th>
                            <th>PF Penalty</th>
                            <th>Other Charges</th>
                            <th>Total Bill</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {bills.map((bill, index) => (
                            <tr key={`${bill.month}-${index}`}>
                                <td>
                                    <input
                                        className="table-input text-input"
                                        type="text"
                                        value={bill.month}
                                        onChange={(event) =>
                                            updateTextField(index, "month", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.contractDemandKVA}
                                        onChange={(event) =>
                                            updateNumberField(index, "contractDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.actualDemandKVA}
                                        onChange={(event) =>
                                            updateNumberField(index, "actualDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.billingDemandKVA || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "billingDemandKVA", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.kWh}
                                        onChange={(event) =>
                                            updateNumberField(index, "kWh", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.kVAh}
                                        onChange={(event) =>
                                            updateNumberField(index, "kVAh", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
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

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.demandCharge}
                                        onChange={(event) =>
                                            updateNumberField(index, "demandCharge", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.energyCharge}
                                        onChange={(event) =>
                                            updateNumberField(index, "energyCharge", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.pfPenalty || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "pfPenalty", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.otherCharges || 0}
                                        onChange={(event) =>
                                            updateNumberField(index, "otherCharges", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <input
                                        className="table-input"
                                        type="number"
                                        value={bill.totalBillAmount}
                                        onChange={(event) =>
                                            updateNumberField(index, "totalBillAmount", event.target.value)
                                        }
                                    />
                                </td>

                                <td>
                                    <button
                                        type="button"
                                        className="danger-button"
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
        </section>
    );
}

export default BillDataTable;