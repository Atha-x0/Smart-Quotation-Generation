import type { ChangeEvent } from "react";
import type { BillData, ClientDetails } from "../types/billTypes";
import type { ConnectedLoadData } from "../types/loadTypes";

interface ProjectDataFile {
  version: string;
  savedAt: string;
  client: ClientDetails;
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
}

interface ProjectDataManagerProps {
  client: ClientDetails;
  bills: BillData[];
  connectedLoads: ConnectedLoadData[];
  onClientLoad: (client: ClientDetails) => void;
  onBillsLoad: (bills: BillData[]) => void;
  onConnectedLoadsLoad: (connectedLoads: ConnectedLoadData[]) => void;
}

function ProjectDataManager({
  client,
  bills,
  connectedLoads,
  onClientLoad,
  onBillsLoad,
  onConnectedLoadsLoad,
}: ProjectDataManagerProps) {
  function saveProjectData() {
    const projectData: ProjectDataFile = {
      version: "1.0",
      savedAt: new Date().toISOString(),
      client,
      bills,
      connectedLoads,
    };

    const fileContent = JSON.stringify(projectData, null, 2);
    const blob = new Blob([fileContent], {
      type: "application/json",
    });

    const safeClientName =
      client.companyName?.trim().replace(/[^a-z0-9]/gi, "_") || "client";

    const fileName = `${safeClientName}_electricity_bill_project.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
  }

  function loadProjectData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsedData = JSON.parse(text) as ProjectDataFile;

        if (!parsedData.client || !Array.isArray(parsedData.bills)) {
          alert("Invalid project file. Client or bill data is missing.");
          return;
        }

        onClientLoad(parsedData.client);
        onBillsLoad(parsedData.bills);
        onConnectedLoadsLoad(parsedData.connectedLoads || []);

        alert("Project data loaded successfully.");
      } catch (error) {
        console.error(error);
        alert("Unable to load project file. Please select a valid saved JSON file.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 project-data-panel no-print">
      <div>
        <h2>Project Data Save / Load</h2>
        <p className="section-note">
          Save extracted bill data, client details, and connected load data as a
          project file. Reload it later without uploading all PDF and Excel files
          again.
        </p>
      </div>

      <div className="action-buttons">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center" type="button" onClick={saveProjectData}>
          Save Project Data
        </button>

        <label className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors text-xs flex items-center justify-center file-button">
          Load Project Data
          <input type="file" accept=".json" onChange={loadProjectData} />
        </label>
      </div>
    </section>
  );
}

export default ProjectDataManager;