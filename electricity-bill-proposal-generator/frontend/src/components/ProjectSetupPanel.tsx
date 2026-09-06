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
    <section className="dashboard-section project-setup-section no-print">
      {/* DASHBOARD UI PHASE 2 - PROJECT SETUP HEADER */}
      <div className="dashboard-section-header">
        <div>
          <p className="dashboard-section-kicker">Step 1</p>
          <h2>Project Setup & File Upload</h2>
          <p>
            Enter client details and upload electricity bills or connected load
            files from one compact workspace.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          {isOpen ? "Collapse Setup" : "Open Setup"}
        </button>
      </div>

      {/* DASHBOARD UI PHASE 2 - COMPACT STATUS STRIP */}
      <div className="setup-status-strip setup-status-strip-compact">
        <div>
          <span>Client</span>
          <strong>{client.companyName || "Not entered"}</strong>
        </div>

        <div>
          <span>Bill Data</span>
          <strong>{hasBillData ? `${bills.length} row(s)` : "Pending"}</strong>
        </div>
      </div>

      {/* DASHBOARD UI PHASE 2 - COLLAPSIBLE SETUP CONTENT */}
      {isOpen && (
        <div className="project-setup-grid">
          <div className="project-setup-main">
            <UniversalFileUploader
              onBillsLoaded={onBillsChange}
              onConnectedLoadsLoaded={onConnectedLoadsChange}
            />
          </div>

          

          <div className="project-setup-side">
            <ClientDetailsForm client={client} onChange={onClientChange} />
          </div>
        </div>
      )}
    </section>
  );
}

export default ProjectSetupPanel;