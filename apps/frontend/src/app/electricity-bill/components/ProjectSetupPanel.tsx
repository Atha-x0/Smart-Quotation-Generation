import { useState } from "react";
import type { BillData, ClientDetails } from "../types/billTypes";
import type { ConnectedLoadData } from "../types/loadTypes";
import ClientDetailsForm from "./ClientDetailsForm";
import UniversalFileUploader from "./UniversalFileUploader";


interface ProjectSetupPanelProps {
  client: ClientDetails;
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
  onClientChange: (client: ClientDetails) => void;
  onBillsChange: (bills: BillData[]) => void;
  onConnectedLoadsChange: (connectedLoads: ConnectedLoadData[]) => void;
}

function ProjectSetupPanel({
  client,
  bills,
  connectedLoads,
  onClientChange,
  onBillsChange,
  onConnectedLoadsChange,
}: ProjectSetupPanelProps) {
  // DASHBOARD UI PHASE 2 - PROJECT SETUP COLLAPSE STATE
  const [isOpen, setIsOpen] = useState(true);

  const hasBillData = bills.length > 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 no-print">
      {/* DASHBOARD UI PHASE 2 - PROJECT SETUP HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Step 1</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Project Setup & File Upload</h2>
          <p className="text-sm text-slate-500">
            Enter client details and upload electricity bills or connected load
            files from one compact workspace.
          </p>
        </div>

        <button
          className="mt-4 sm:mt-0 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center"
          type="button"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          {isOpen ? "Collapse Setup" : "Open Setup"}
        </button>
      </div>

      {/* DASHBOARD UI PHASE 2 - COMPACT STATUS STRIP */}
      <div className="flex items-center space-x-8 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client</span>
          <strong className="text-sm font-semibold text-slate-900">{client.companyName || "Not entered"}</strong>
        </div>

        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bill Data</span>
          <strong className="text-sm font-semibold text-slate-900">{hasBillData ? `${bills.length} row(s)` : "Pending"}</strong>
        </div>
      </div>

      {/* DASHBOARD UI PHASE 2 - COLLAPSIBLE SETUP CONTENT */}
      {isOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UniversalFileUploader
              onBillsLoaded={onBillsChange}
              onConnectedLoadsLoaded={onConnectedLoadsChange}
            />
          </div>

          <div className="lg:col-span-1">
            <ClientDetailsForm client={client} onChange={onClientChange} />
          </div>
        </div>
      )}
    </section>
  );
}

export default ProjectSetupPanel;