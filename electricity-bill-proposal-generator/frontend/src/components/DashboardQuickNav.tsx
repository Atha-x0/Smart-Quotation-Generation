import ExportButtons from "./ExportButtons";

function DashboardQuickNav() {
  return (
    <div className="dashboard-nav-sticky no-print">
      <nav className="dashboard-quick-nav">
        <a href="#setup">Setup</a>
        <a href="#kpis">KPIs</a>
        <a href="#trends">Trends</a>
        <a href="#recommendations">Recommendations</a>
        <a href="#proposal">Proposal</a>
      </nav>

      <div className="dashboard-nav-export">
        <ExportButtons />
      </div>
    </div>
  );
}

export default DashboardQuickNav;