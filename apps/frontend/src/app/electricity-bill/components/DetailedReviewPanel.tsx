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
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 no-print">
      <div className="flex flex-col mb-6 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Accuracy Review</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Detailed Review & Testing Tools</h2>
          <p className="text-sm text-slate-500">
            Review extracted bill values and make manual corrections wherever
            required before generating the final proposal.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <BillReviewPanel bills={bills} onChange={onBillsChange} />
        <BillDataTable bills={bills} onChange={onBillsChange} />
      </div>
    </section>
  );
}

export default DetailedReviewPanel;