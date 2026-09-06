import type { ProposalReadinessResult } from "../lib/proposalReadiness";

interface ProposalReadinessPanelProps {
  readiness: ProposalReadinessResult;
}

function ProposalReadinessPanel({ readiness }: ProposalReadinessPanelProps) {
  // PROPOSAL READINESS SECTION - STATUS CLASS
  const statusClass =
    readiness.status === "Ready"
      ? "ready"
      : readiness.status === "Needs Review"
      ? "review"
      : "not-ready";

  return (
    <section className="dashboard-section proposal-readiness-section no-print">
      {/* PROPOSAL READINESS SECTION - HEADER */}
      <div className="dashboard-section-header">
        <div>
          <p className="dashboard-section-kicker">Final Check</p>
          <h2>Proposal Readiness Check</h2>
          <p>
            This section checks whether the proposal has enough data and quality
            to be exported safely.
          </p>
        </div>

        <div className={`proposal-readiness-score ${statusClass}`}>
          <span>{readiness.status}</span>
          <strong>{readiness.score}%</strong>
        </div>
      </div>

      {/* PROPOSAL READINESS SECTION - SUMMARY */}
      <div className="proposal-readiness-summary">
        <div>
          <span>Export Status</span>
          <strong>{readiness.canExport ? "Allowed" : "Blocked"}</strong>
        </div>

        <div>
          <span>Blocking Issues</span>
          <strong>{readiness.blockingIssues.length}</strong>
        </div>

        <div>
          <span>Warnings</span>
          <strong>{readiness.warnings.length}</strong>
        </div>

        <div>
          <span>Total Checks</span>
          <strong>{readiness.checks.length}</strong>
        </div>
      </div>

      {/* PROPOSAL READINESS SECTION - CHECK LIST */}
      <div className="proposal-readiness-check-list">
        {readiness.checks.map((check) => (
          <div
            className={`proposal-readiness-check ${check.status.toLowerCase()}`}
            key={check.title}
          >
            <div>
              <strong>{check.title}</strong>
              <p>{check.message}</p>
            </div>

            <span>{check.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProposalReadinessPanel;