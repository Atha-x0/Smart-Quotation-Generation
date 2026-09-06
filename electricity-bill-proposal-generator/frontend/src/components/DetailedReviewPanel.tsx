import type { BillData } from "../types/billTypes";
import BillReviewPanel from "./BillReviewPanel";
import BillDataTable from "./BillDataTable";

interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  errors: string[];
  warnings: string[];
}

interface DetailedReviewPanelProps {
  bills: BillData[];
  defaultBills: BillData[];
  validation: ValidationResult;
  onBillsChange: (bills: BillData[]) => void;
}

function DetailedReviewPanel({ bills, onBillsChange }: DetailedReviewPanelProps) {
  return (
    <section className="dashboard-section detailed-review-section no-print">
      <div className="detailed-review-clean-header">
        <div>
          <p className="dashboard-section-kicker">Accuracy Review</p>
          <h2>Detailed Review & Testing Tools</h2>
          <p>
            Review extracted bill values and make manual corrections wherever
            required before generating the final proposal.
          </p>
        </div>
      </div>

      <div className="detailed-review-content detailed-review-clean-content">
        <BillReviewPanel bills={bills} onChange={onBillsChange} />

        <BillDataTable bills={bills} onChange={onBillsChange} />
      </div>
    </section>
  );
}

export default DetailedReviewPanel;