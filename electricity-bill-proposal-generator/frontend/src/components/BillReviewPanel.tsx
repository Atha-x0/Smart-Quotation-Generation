import type { ChangeEvent } from "react";
import type { BillData } from "../types/billTypes";
import { formatINR, formatKVA, formatKWh } from "../lib/formatter";

interface BillReviewPanelProps {
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

function isMsedclBill(bill: BillData): boolean {
  return (
    bill.detectedBillFormat === "MSEDCL_HT" ||
    bill.parser === "msedcl_ht_bill_parser" ||
    bill.discom === "MSEDCL"
  );
}

function BillReviewPanel({ bills, onChange }: BillReviewPanelProps) {
  function updateTextField(index: number, field: "month", value: string) {
    const updatedBills = bills.map((bill, billIndex) => {
      if (billIndex !== index) {
        return bill;
      }

      return {
        ...bill,
        [field]: value,
      };
    });

    onChange(updatedBills);
  }

  function updateNumberField(
    index: number,
    field: NumericBillField,
    value: string
  ) {
    const numericValue = Number(value);

    const updatedBills = bills.map((bill, billIndex) => {
      if (billIndex !== index) {
        return bill;
      }

      return {
        ...bill,
        [field]: Number.isFinite(numericValue) ? numericValue : 0,
      };
    });

    onChange(updatedBills);
  }

  function handleTextChange(
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    field: "month"
  ) {
    updateTextField(index, field, event.target.value);
  }

  function handleNumberChange(
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    field: NumericBillField
  ) {
    updateNumberField(index, field, event.target.value);
  }

  if (bills.length === 0) {
    return (
      <section className="panel bill-review-panel">
        <h2>Extracted Bill Review</h2>
        <p className="section-note">
          No bill data loaded yet. Upload a bill PDF or Excel bill file to review
          extracted values.
        </p>
      </section>
    );
  }

  return (
    <section className="panel bill-review-panel">
      <div className="panel-header">
        <div>
          <h2>Extracted Bill Review</h2>
          <p className="section-note">
            Review and correct extracted bill values before savings calculation.
          </p>
        </div>

        <span className="badge success">{bills.length} bill row(s)</span>
      </div>

      <div className="bill-review-grid">
        {bills.map((bill, index) => (
          <div className="bill-review-card" key={`${bill.month}-${index}`}>
            <div className="bill-review-card-header">
              <div>
                <h3>Bill Row {index + 1}</h3>
                <p>{bill.sourceFile || bill.month || "PDF Bill"}</p>
              </div>

              <strong>{bill.month || "PDF Bill"}</strong>
            </div>

            <div className="bill-review-summary">
              <div>
                <span>Total Bill</span>
                <strong>{formatINR(bill.totalBillAmount || 0)}</strong>
              </div>

              <div>
                <span>kWh</span>
                <strong>{formatKWh(bill.kWh || 0, 0)}</strong>
              </div>

              <div>
                <span>Actual Demand</span>
                <strong>{formatKVA(bill.actualDemandKVA || 0)}</strong>
              </div>

              <div>
                <span>PF</span>
                <strong>{Number(bill.powerFactor || 0).toFixed(3)}</strong>
              </div>
            </div>

            {bill.extractionWarnings && bill.extractionWarnings.length > 0 && (
              <div className="alert warning extraction-warning-box">
                <h3>Extraction Warnings</h3>
                <ul>
                  {bill.extractionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {isMsedclBill(bill) && (
              <div className="parser-quality-box">
                <div>
                  <span>MSEDCL Consumer No.</span>
                  <strong>{bill.consumerNumber || "Not available"}</strong>
                </div>

                <div>
                  <span>Consumer Name</span>
                  <strong>{bill.consumerName || "Not available"}</strong>
                </div>

                <div>
                  <span>DISCOM</span>
                  <strong>{bill.discom || "MSEDCL"}</strong>
                </div>

                <div>
                  <span>Tariff Category</span>
                  <strong>{bill.tariffCategory || "Not available"}</strong>
                </div>

                <div>
                  <span>Sanctioned Load</span>
                  <strong>{(bill.sanctionedLoadKW || 0).toFixed(2)} kW</strong>
                </div>

                <div>
                  <span>Connected Load</span>
                  <strong>{(bill.connectedLoadKW || 0).toFixed(2)} kW</strong>
                </div>

                <div>
                  <span>Solar Capacity</span>
                  <strong>{(bill.solarCapacityKW || 0).toFixed(2)} kW</strong>
                </div>

                <div>
                  <span>Actual Demand kW</span>
                  <strong>{(bill.actualDemandKW || 0).toFixed(2)} kW</strong>
                </div>

                <div>
                  <span>Solar Adjustment</span>
                  <strong>{formatKWh(bill.solarAdjustmentKWH || 0, 0)}</strong>
                </div>

                <div>
                  <span>FAC</span>
                  <strong>{formatINR(bill.facCharge || 0)}</strong>
                </div>

                <div>
                  <span>Wheeling Charge</span>
                  <strong>{formatINR(bill.wheelingCharge || 0)}</strong>
                </div>

                <div>
                  <span>Electricity Duty</span>
                  <strong>{formatINR(bill.electricityDuty || 0)}</strong>
                </div>

                <div>
                  <span>Tax on Sale</span>
                  <strong>{formatINR(bill.taxOnSale || 0)}</strong>
                </div>

                <div>
                  <span>Grid Support Charge</span>
                  <strong>{formatINR(bill.gridSupportCharge || 0)}</strong>
                </div>

                <div>
                  <span>Prompt Payment Discount</span>
                  <strong>{formatINR(bill.promptPaymentDiscount || 0)}</strong>
                </div>

                <div>
                  <span>Government Subsidy</span>
                  <strong>{formatINR(bill.govtSubsidy || 0)}</strong>
                </div>
              </div>
            )}

            <div className="form-grid bill-review-form">
              <label>
                Month
                <input
                  value={bill.month || ""}
                  onChange={(event) => handleTextChange(event, index, "month")}
                />
              </label>

              <label>
                Contract Demand kVA
                <input
                  type="number"
                  value={bill.contractDemandKVA || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "contractDemandKVA")
                  }
                />
              </label>

              <label>
                Actual Demand kVA
                <input
                  type="number"
                  value={bill.actualDemandKVA || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "actualDemandKVA")
                  }
                />
              </label>

              <label>
                Billing Demand kVA
                <input
                  type="number"
                  value={bill.billingDemandKVA || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "billingDemandKVA")
                  }
                />
              </label>

              <label>
                Minimum Billing Demand kVA
                <input
                  type="number"
                  value={bill.minBillingDemandKVA || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "minBillingDemandKVA")
                  }
                />
              </label>

              <label>
                kWh
                <input
                  type="number"
                  value={bill.kWh || 0}
                  onChange={(event) => handleNumberChange(event, index, "kWh")}
                />
              </label>

              <label>
                kVAh
                <input
                  type="number"
                  value={bill.kVAh || 0}
                  onChange={(event) => handleNumberChange(event, index, "kVAh")}
                />
              </label>

              <label>
                Power Factor
                <input
                  type="number"
                  step="0.001"
                  value={bill.powerFactor || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "powerFactor")
                  }
                />
              </label>

              <label>
                Demand Charge
                <input
                  type="number"
                  value={bill.demandCharge || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "demandCharge")
                  }
                />
              </label>

              <label>
                Energy Charge
                <input
                  type="number"
                  value={bill.energyCharge || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "energyCharge")
                  }
                />
              </label>

              <label>
                PF Penalty
                <input
                  type="number"
                  value={bill.pfPenalty || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "pfPenalty")
                  }
                />
              </label>

              <label>
                PF Incentive
                <input
                  type="number"
                  value={bill.pfIncentive || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "pfIncentive")
                  }
                />
              </label>

              <label>
                TOD Charges
                <input
                  type="number"
                  value={bill.todCharges || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "todCharges")
                  }
                />
              </label>

              <label>
                Other Charges
                <input
                  type="number"
                  value={bill.otherCharges || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "otherCharges")
                  }
                />
              </label>

              <label>
                Total Bill Amount
                <input
                  type="number"
                  value={bill.totalBillAmount || 0}
                  onChange={(event) =>
                    handleNumberChange(event, index, "totalBillAmount")
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default BillReviewPanel;