import { useState } from "react";
import PDFDebugViewer from "./PDFDebugViewer";
import ExcelDebugViewer from "./ExcelDebugViewer";

function DeveloperTestingTools() {
  // DEVELOPER TOOLS SECTION - COLLAPSE STATE
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="dashboard-section developer-tools-section no-print">
      {/* DEVELOPER TOOLS SECTION - HEADER */}
      <div className="dashboard-section-header">
        <div>
          <p className="dashboard-section-kicker">Testing & Accuracy Tools</p>
          <h2>Developer Testing Tools</h2>
          <p>
            Use these tools only during testing to verify PDF extraction, Excel
            parsing, raw backend response, and parser confidence.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          {isOpen ? "Hide Testing Tools" : "Show Testing Tools"}
        </button>
      </div>

      {/* DEVELOPER TOOLS SECTION - COLLAPSIBLE CONTENT */}
      {isOpen && (
        <div className="developer-tools-grid">
          <PDFDebugViewer />
          <ExcelDebugViewer />
        </div>
      )}
    </section>
  );
}

export default DeveloperTestingTools;