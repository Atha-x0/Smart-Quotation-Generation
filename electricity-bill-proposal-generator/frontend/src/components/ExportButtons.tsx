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

function ExportButtons() {
  async function handlePrintProposal() {
    await waitForPrintAssets();
    window.print();
  }

  return (
    <div className="export-actions no-print">
      <button
        className="primary-button export-large-button"
        type="button"
        onClick={handlePrintProposal}
      >
        Export / Print Proposal
      </button>
    </div>
  );
}

export default ExportButtons;