import ExportButtons from "./ExportButtons";

function DashboardQuickNav() {
  return (
    <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm pb-4 pt-4 border-b border-slate-200 no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <nav className="flex bg-slate-100/60 p-1 rounded-xl w-fit">
        <a href="#setup" className="px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700">Setup</a>
        <a href="#kpis" className="px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700">KPIs</a>
        <a href="#trends" className="px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700">Trends</a>
        <a href="#recommendations" className="px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700">Recommendations</a>
        <a href="#proposal" className="px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700">Proposal</a>
      </nav>

      <div>
        <ExportButtons />
      </div>
    </div>
  );
}

export default DashboardQuickNav;