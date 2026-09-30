import { useState } from "react";
import { ClientDetails, BillData } from "../types/billTypes";

interface ExportButtonsProps {
  proposalData: any;
}

function waitForImageToLoad(imageUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => resolve();

    image.src = imageUrl;
  });
}

async function waitForPrintAssets() {
  await waitForImageToLoad("/seetech-letterhead.png");

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, 500);
  });
}

function ExportButtons({ proposalData }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handlePrintProposal() {
    setIsExporting(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/export-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposalData)
      });
      
      if (!response.ok) throw new Error("Failed to generate PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "electricity-bill-proposal.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Error exporting proposal");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="export-actions no-print">
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2 px-4 shadow-sm transition-colors flex items-center justify-center text-sm disabled:opacity-50"
        type="button"
        onClick={handlePrintProposal}
        disabled={isExporting}
      >
        {isExporting ? "Generating PDF..." : "Export / Print Proposal"}
      </button>
    </div>
  );
}

export default ExportButtons;