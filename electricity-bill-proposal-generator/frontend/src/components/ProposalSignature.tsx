import { useState } from "react";

function ProposalSignature() {
  // SIGNATURE SECTION - AUTO DATE FOR SEE-TECH SIDE
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // SIGNATURE SECTION - EDITABLE CLIENT ACCEPTANCE FIELDS
  // These fields can be typed directly before exporting the proposal.
  const [clientSignerName, setClientSignerName] = useState("");
  const [clientSignerDesignation, setClientSignerDesignation] = useState("");
  const [clientAcceptanceDate, setClientAcceptanceDate] = useState(today);

  return (
    <section className="proposal-signature-section">
      {/* SIGNATURE SECTION - CLOSE NOTE */}
      <h3>20. Signature & Close</h3>

      <p>
        We thank you for the opportunity to review the electricity bill and
        connected load details. The above analysis is prepared based on the
        uploaded electricity bill and machine detail data. Final savings and
        implementation recommendations should be validated after detailed site
        study, operating pattern review, and measurement-based verification.
      </p>

      <div className="signature-grid">
        {/* SIGNATURE SECTION - SEE-TECH SIDE */}
        <div className="signature-card">
          <p>
            <strong>For SEE-Tech Solutions</strong>
          </p>

          <div className="signature-space"></div>

          <p>
            <strong>Milind Chittawar</strong>
            <br />
            Authorized Signatory
          </p>

          <p>Date: {today}</p>
        </div>

        {/* SIGNATURE SECTION - CLIENT SIDE */}
        <div className="signature-card">
          <p>
            <strong>Client Acceptance / Acknowledgement</strong>
          </p>

          <div className="signature-space"></div>

          <label className="signature-field">
            <span>Name</span>
            <input
              type="text"
              value={clientSignerName}
              onChange={(event) => setClientSignerName(event.target.value)}
              placeholder="Enter client name"
            />
          </label>

          <label className="signature-field">
            <span>Designation</span>
            <input
              type="text"
              value={clientSignerDesignation}
              onChange={(event) =>
                setClientSignerDesignation(event.target.value)
              }
              placeholder="Enter designation"
            />
          </label>

          <label className="signature-field">
            <span>Date</span>
            <input
              type="text"
              value={clientAcceptanceDate}
              onChange={(event) => setClientAcceptanceDate(event.target.value)}
              placeholder="Enter date"
            />
          </label>
        </div>
      </div>

      {/* SIGNATURE SECTION - FOOTNOTE */}
      <p className="proposal-close-note">
        This proposal preview is generated using SEE-Tech Solutions Electricity
        Bill Proposal Generator and is intended for preliminary technical and
        commercial discussion.
      </p>
    </section>
  );
}

export default ProposalSignature;