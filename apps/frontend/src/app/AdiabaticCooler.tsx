'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Calculator, Users, Settings, LogOut, 
  Snowflake, Eye, FileText, FileSpreadsheet, IndianRupee, Percent 
} from 'lucide-react';
import './adiabatic.css';

interface AdiabaticCoolerProps {
  apiBase: string;
  mode: 'dashboard' | 'survey' | 'customers' | 'settings';
}

export default function AdiabaticCooler({ apiBase, mode }: AdiabaticCoolerProps) {
  const [token, setToken] = useState('active-integrated-session');
  const [user, setUser] = useState({ name: 'System Admin', role: 'admin' });
  
  // Main data state
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [activeRateCard, setActiveRateCard] = useState<any>(null);
  const [configs, setConfigs] = useState<any>({});
  const [pumpModels, setPumpModels] = useState<any[]>([]);
  
  // Rate Card History (Admin panel)
  const [rateCards, setRateCards] = useState<any[]>([]);

  // Survey Form inputs
  const [surveyCustomer, setSurveyCustomer] = useState('');
  const [surveyW, setSurveyW] = useState(2400);
  const [surveyD, setSurveyD] = useState(1500);
  const [surveyH, setSurveyH] = useState(1800);
  const [surveyThickness, setSurveyThickness] = useState(100);
  const [surveyConfigType, setSurveyConfigType] = useState('3-face');
  const [selectedFaces, setSelectedFaces] = useState(['Back', 'Left', 'Right']);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [submitStatusType, setSubmitStatusType] = useState('draft');

  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<any>(null);
  
  // Live Estimate State
  const [liveEstimate, setLiveEstimate] = useState({ 
    totalPads: 0, frameBars: 0, pattiBars: 0, plateSheets: 0, 
    requiredFlowLPH: 0, grandTotal: 0, pumpModelName: 'None' 
  });

  // New Customer Form inputs
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custContact, setCustContact] = useState('');
  const [custEmail, setCustEmail] = useState('');

  // Admin Rate Card Form inputs
  const [rcVersion, setRcVersion] = useState('');
  
  // Evaporative Cooling Pad 7090(NTK)
  const [rcPadH, setRcPadH] = useState(2000);
  const [rcPadW, setRcPadW] = useState(1180);
  const [rcPadD, setRcPadD] = useState(100);
  const [rcPadQty, setRcPadQty] = useState(20);
  const [rcPadCost, setRcPadCost] = useState(3000);

  // Aluminium Frame - Bottom Plate
  const [rcBottomPlateH, setRcBottomPlateH] = useState(1828);
  const [rcBottomPlateW, setRcBottomPlateW] = useState(3048);
  const [rcBottomPlateD, setRcBottomPlateD] = useState(100);
  const [rcBottomPlateQty, setRcBottomPlateQty] = useState(10);
  const [rcBottomPlateCost, setRcBottomPlateCost] = useState(2800);

  // Aluminium Frame - Side Plate
  const [rcSidePlateH, setRcSidePlateH] = useState(1828);
  const [rcSidePlateW, setRcSidePlateW] = useState(3048);
  const [rcSidePlateD, setRcSidePlateD] = useState(100);
  const [rcSidePlateQty, setRcSidePlateQty] = useState(44);
  const [rcSidePlateCost, setRcSidePlateCost] = useState(700);

  // Aluminium Support Patti
  const [rcSupportPattiH, setRcSupportPattiH] = useState(1828);
  const [rcSupportPattiW, setRcSupportPattiW] = useState(8500);
  const [rcSupportPattiD, setRcSupportPattiD] = useState(100);
  const [rcSupportPattiQty, setRcSupportPattiQty] = useState(16);
  const [rcSupportPattiCost, setRcSupportPattiCost] = useState(0);

  const [rcLphMultiplier, setRcLphMultiplier] = useState(4);
  const [adminPumps, setAdminPumps] = useState<any[]>([]);
  const [adminPlumbingBands, setAdminPlumbingBands] = useState<any[]>([]);

  // Fetch API wrapper
  const fetchWithAuth = async (url: string, options: any = {}) => {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, options);
    return response;
  };

  useEffect(() => {
    loadInitialData();
  }, [mode]);

  const loadInitialData = async () => {
    try {
      // 1. Fetch active configs
      let res = await fetchWithAuth(`${apiBase}/configs`);
      const cfg = await res.json();
      setConfigs(cfg);

      // 2. Fetch active rate card
      res = await fetchWithAuth(`${apiBase}/rate-cards/active`);
      const rc = await res.json();
      setActiveRateCard(rc);

      // Initialize admin card edit values
      setRcPadW(parseFloat(cfg.padSheetWidth) || 1180);
      setRcPadH(parseFloat(cfg.padSheetHeight) || 2000);
      setRcPadD(parseFloat(cfg.padSheetDepth) || 100);
      setRcPadQty(parseFloat(cfg.padReqQty) || 20);
      setRcPadCost(rc.cooling_pad_unit_cost || 3000);

      setRcBottomPlateW(parseFloat(cfg.bottomPlateWidth) || 3048);
      setRcBottomPlateH(parseFloat(cfg.bottomPlateHeight) || 1828);
      setRcBottomPlateD(parseFloat(cfg.bottomPlateDepth) || 100);
      setRcBottomPlateQty(parseFloat(cfg.bottomPlateReqQty) || 10);
      setRcBottomPlateCost(rc.plate_cost_per_sheet || 2800);

      setRcSidePlateW(parseFloat(cfg.sidePlateWidth) || 3048);
      setRcSidePlateH(parseFloat(cfg.sidePlateHeight) || 1828);
      setRcSidePlateD(parseFloat(cfg.sidePlateDepth) || 100);
      setRcSidePlateQty(parseFloat(cfg.sidePlateReqQty) || 44);
      setRcSidePlateCost(rc.aluminium_cost_per_bar || 700);

      setRcSupportPattiW(parseFloat(cfg.supportPattiWidth) || 8500);
      setRcSupportPattiH(parseFloat(cfg.supportPattiHeight) || 1828);
      setRcSupportPattiD(parseFloat(cfg.supportPattiDepth) || 100);
      setRcSupportPattiQty(parseFloat(cfg.supportPattiReqQty) || 16);
      setRcSupportPattiCost(rc.support_patti_cost_per_bar || 0);

      setRcLphMultiplier(rc.lph_multiplier || 4);
      setAdminPlumbingBands(rc.plumbingCostBands || []);

      // 3. Fetch active pumps
      res = await fetchWithAuth(`${apiBase}/pump-models`);
      const pumps = await res.json();
      setPumpModels(pumps);
      setAdminPumps(pumps.map((p: any) => ({ modelName: p.modelName, capacityLPH: p.capacityLPH, cost: p.cost })));

      // 4. Load dynamic listings
      loadCustomers();
      loadQuotations();
      loadRateCards();
    } catch (e) {
      console.error("Data load error:", e);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/customers`);
      const data = await res.json();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadQuotations = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/quotations`);
      const data = await res.json();
      setQuotations(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadRateCards = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/rate-cards`);
      const data = await res.json();
      setRateCards(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfigTypeChange = (val: string) => {
    setSurveyConfigType(val);
    if (val === '4-face') {
      setSelectedFaces(['Front', 'Back', 'Left', 'Right']);
    } else if (val === '3-face') {
      setSelectedFaces(['Back', 'Left', 'Right']);
    } else if (val === '2-opposite') {
      setSelectedFaces(['Front', 'Back']);
    } else if (val === '2-adjacent') {
      setSelectedFaces(['Back', 'Left']);
    }
  };

  const toggleFace = (faceName: string) => {
    let list = [...selectedFaces];
    if (list.includes(faceName)) {
      list = list.filter(f => f !== faceName);
    } else {
      list.push(faceName);
    }
    setSelectedFaces(list);

    if (list.length === 4) {
      setSurveyConfigType('4-face');
    } else if (list.length === 3 && list.includes('Left') && list.includes('Right') && list.includes('Back')) {
      setSurveyConfigType('3-face');
    } else if (list.length === 2) {
      const isOpp = (list.includes('Front') && list.includes('Back')) || (list.includes('Left') && list.includes('Right'));
      setSurveyConfigType(isOpp ? '2-opposite' : '2-adjacent');
    }
  };

  // Real-time calculation engine
  useEffect(() => {
    if (selectedFaces.length === 0) return;
    
    const fetchLiveEstimate = async () => {
      try {
        const body = {
          inputSnapshot: {
            H: parseFloat(surveyH as any),
            W: parseFloat(surveyW as any),
            D: parseFloat(surveyD as any),
            faces: selectedFaces,
            faceSelectionType: surveyConfigType,
            thickness: parseFloat(surveyThickness as any)
          }
        };
        const response = await fetchWithAuth(`${apiBase}/quotations/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        if (response.ok && data.outputSnapshot) {
          setLiveEstimate({
            totalPads: data.outputSnapshot.pads?.totalPads || 0,
            frameBars: data.outputSnapshot.frame?.barsNeeded || 0,
            pattiBars: data.outputSnapshot.patti?.barsNeeded || 0,
            plateSheets: data.outputSnapshot.plates?.sheetsNeeded || 0,
            requiredFlowLPH: data.outputSnapshot.pumpPlumbing?.requiredFlowLPH || 0,
            pumpModelName: data.outputSnapshot.pumpPlumbing?.selectedPump?.modelName || 'None',
            grandTotal: data.outputSnapshot.grandTotal || 0
          });
        }
      } catch (err) {
        console.error("Error fetching live estimate:", err);
      }
    };

    const timeoutId = setTimeout(fetchLiveEstimate, 300);
    return () => clearTimeout(timeoutId);
  }, [surveyW, surveyD, surveyH, surveyThickness, surveyConfigType, selectedFaces]);

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyCustomer) return alert("Please select a customer.");
    if (selectedFaces.length === 0) return alert("Please select at least 1 cooling face.");

    const body = {
      customerId: parseInt(surveyCustomer),
      status: submitStatusType,
      inputSnapshot: {
        H: parseFloat(surveyH as any),
        W: parseFloat(surveyW as any),
        D: parseFloat(surveyD as any),
        faces: selectedFaces,
        faceSelectionType: surveyConfigType,
        thickness: parseFloat(surveyThickness as any)
      }
    };

    try {
      const response = await fetchWithAuth(`${apiBase}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      handleOpenQuoteDetails(data.id);
      loadQuotations();
    } catch (err: any) {
      alert("Error generating quote: " + err.message);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetchWithAuth(`${apiBase}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName,
          siteAddress: custAddress,
          contactNumber: custContact,
          email: custEmail
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCustomerModalOpen(false);
      setCustName('');
      setCustAddress('');
      setCustContact('');
      setCustEmail('');
      loadCustomers();
    } catch (err: any) {
      alert("Error adding customer: " + err.message);
    }
  };

  const handleRateCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      versionLabel: rcVersion,
      effectiveDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      coolingPadUnitCost: parseFloat(rcPadCost as any),
      aluminiumCostPerBar: parseFloat(rcSidePlateCost as any),
      plateCostPerSheet: parseFloat(rcBottomPlateCost as any),
      supportPattiCostPerBar: parseFloat(rcSupportPattiCost as any),
      wastageFactor: 0.07,
      lphMultiplier: parseFloat(rcLphMultiplier as any),
      plumbingCostBands: adminPlumbingBands
    };

    try {
      let response = await fetchWithAuth(`${apiBase}/rate-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await fetchWithAuth(`${apiBase}/configs/padSheetWidth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcPadW }) });
      await fetchWithAuth(`${apiBase}/configs/padSheetHeight`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcPadH }) });
      await fetchWithAuth(`${apiBase}/configs/padSheetDepth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcPadD }) });
      await fetchWithAuth(`${apiBase}/configs/padReqQty`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcPadQty }) });

      await fetchWithAuth(`${apiBase}/configs/bottomPlateWidth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcBottomPlateW }) });
      await fetchWithAuth(`${apiBase}/configs/bottomPlateHeight`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcBottomPlateH }) });
      await fetchWithAuth(`${apiBase}/configs/bottomPlateDepth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcBottomPlateD }) });
      await fetchWithAuth(`${apiBase}/configs/bottomPlateReqQty`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcBottomPlateQty }) });

      await fetchWithAuth(`${apiBase}/configs/sidePlateWidth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSidePlateW }) });
      await fetchWithAuth(`${apiBase}/configs/sidePlateHeight`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSidePlateH }) });
      await fetchWithAuth(`${apiBase}/configs/sidePlateDepth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSidePlateD }) });
      await fetchWithAuth(`${apiBase}/configs/sidePlateReqQty`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSidePlateQty }) });

      await fetchWithAuth(`${apiBase}/configs/supportPattiWidth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSupportPattiW }) });
      await fetchWithAuth(`${apiBase}/configs/supportPattiHeight`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSupportPattiH }) });
      await fetchWithAuth(`${apiBase}/configs/supportPattiDepth`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSupportPattiD }) });
      await fetchWithAuth(`${apiBase}/configs/supportPattiReqQty`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSupportPattiQty }) });

      await fetchWithAuth(`${apiBase}/configs/aluminiumStockLength`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: rcSidePlateW }) });
      await fetchWithAuth(`${apiBase}/configs/plateStockSize`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ value: `${rcBottomPlateW}x${rcBottomPlateH}` }) });

      for (const pump of adminPumps) {
        const existing = pumpModels.find(p => p.modelName === pump.modelName);
        if (existing) {
          await fetchWithAuth(`${apiBase}/pump-models/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pump, isActive: true })
          });
        } else {
          await fetchWithAuth(`${apiBase}/pump-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pump, isActive: true })
          });
        }
      }

      alert("Configuration successfully saved & activated!");
      setRcVersion('');
      loadInitialData();
      loadRateCards();
    } catch (err: any) {
      alert("Error saving rate card: " + err.message);
    }
  };

  const handleOpenQuoteDetails = async (quoteId: string) => {
    try {
      const res = await fetchWithAuth(`${apiBase}/quotations/${quoteId}`);
      const data = await res.json();
      setSelectedQuoteDetail(data);
      setQuoteModalOpen(true);
    } catch (e) {
      console.error(e);
      alert("Error fetching quote details");
    }
  };

  const handleDownloadPdf = (quoteId: string) => {
    window.open(`${apiBase}/quotations/${quoteId}/pdf`, '_blank');
  };

  const handleToggleAdminActiveCard = async (cardId: string) => {
    try {
      await fetchWithAuth(`${apiBase}/rate-cards/${cardId}/activate`, { method: 'POST' });
      loadInitialData();
      loadRateCards();
    } catch (e: any) {
      alert("Error activating rate card: " + e.message);
    }
  };

  const handleDuplicateQuote = () => {
    if (!selectedQuoteDetail || !selectedQuoteDetail.inputSnapshot) return;
    const inp = selectedQuoteDetail.inputSnapshot;
    setSurveyCustomer(selectedQuoteDetail.customerId || selectedQuoteDetail.customer_id);
    setSurveyW(inp.W || 0);
    setSurveyD(inp.D || 0);
    setSurveyH(inp.H || 0);
    setSurveyThickness(inp.thickness || 100);
    setSurveyConfigType(inp.faceSelectionType || '3-face');
    setSelectedFaces(inp.faces || []);
    setQuoteModalOpen(false);
  };

  // Filter quotations
  const now = new Date();
  const filteredQuotations = quotations.filter(q => {
    let match = true;
    if (searchQuery && !q.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) match = false;
    if (statusFilter !== 'all' && q.status !== statusFilter) match = false;
    if (dateFilter === 'this-month') {
      const d = new Date(q.created_at);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) match = false;
    }
    return match;
  });

  const quotesThisMonth = quotations.filter(q => {
    const d = new Date(q.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const totalValueThisMonth = quotations
    .filter(q => {
      const d = new Date(q.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && q.status !== 'draft';
    })
    .reduce((sum, q) => sum + (q.outputSnapshot?.grandTotal || 0), 0);

  return (
    <div className="adiabatic-theme w-full">
      {/* VIEW A: DASHBOARD */}
      {mode === 'dashboard' && (
        <section className="animate-fade">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: 'rgba(56, 95, 168, 0.1)', color: '#385FA8' }}><FileSpreadsheet size={24} /></div>
              <div className="metric-info">
                <div className="metric-title">Chiller Quotes This Month</div>
                <div className="metric-value">{quotesThisMonth}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: 'rgba(80, 184, 64, 0.1)', color: '#50B840' }}><IndianRupee size={24} /></div>
              <div className="metric-info">
                <div className="metric-title">Chiller Value This Month</div>
                <div className="metric-value">₹{totalValueThisMonth.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ backgroundColor: 'rgba(77, 77, 77, 0.1)', color: '#4D4D4D' }}><Percent size={24} /></div>
              <div className="metric-info">
                <div className="metric-title">Active Chiller Rate Card</div>
                <div className="metric-value" style={{ fontSize: '1rem' }}>{activeRateCard ? activeRateCard.versionLabel : 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-header-bar flex flex-col md:flex-row gap-3">
              <h2 className="font-bold text-slate-800 text-sm">Recent Chiller Estimates</h2>
              <div className="flex-1 flex gap-2 w-full md:w-auto">
                <input type="text" className="search-box flex-1" placeholder="Search customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <select className="search-box text-xs" style={{ minWidth: '120px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="final">Final</option>
                </select>
                <select className="search-box text-xs" style={{ minWidth: '120px' }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="this-month">This Month</option>
                </select>
              </div>
            </div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Quote ID</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Config Type</th>
                  <th>Status</th>
                  <th>Est. Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No chiller quotations match your filters.</td></tr>
                ) : (
                  filteredQuotations.map(q => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Q-{q.id}</td>
                      <td>{new Date(q.created_at).toLocaleDateString()}</td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{q.customer_name}</td>
                      <td style={{ fontSize: '0.85rem' }}>{q.inputSnapshot?.faceSelectionType} ({(q.inputSnapshot?.faces || []).join(', ')})</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          q.status === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {q.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>₹{(q.outputSnapshot?.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="bg-slate-100 hover:bg-slate-200 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold" onClick={() => handleOpenQuoteDetails(q.id)}>
                            <Eye size={13} /> View
                          </button>
                          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold" onClick={() => handleDownloadPdf(q.id)}>
                            <FileText size={13} /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW B: NEW SURVEY CALCULATOR */}
      {mode === 'survey' && (
        <section className="animate-fade">
          <div className="two-col-grid">
            <div className="table-container p-6 bg-white">
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 700 }} className="text-slate-800">Sizing Inputs</h2>
              <form onSubmit={handleSurveySubmit}>
                
                <div className="form-group">
                  <label>Select Customer</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select className="border border-slate-200 p-2 rounded-xl text-xs flex-1 text-slate-800" value={surveyCustomer} onChange={(e) => setSurveyCustomer(e.target.value)} required>
                      <option value="">-- Choose customer --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs px-3 py-2 rounded-xl font-semibold text-slate-700" onClick={() => setCustomerModalOpen(true)}>+ Add New</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }} className="mb-4">
                  <div className="form-group">
                    <label>Width (W) - mm</label>
                    <input type="number" className="text-slate-800 bg-white" required min="100" value={surveyW} onChange={(e) => setSurveyW(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label>Depth (D) - mm</label>
                    <input type="number" className="text-slate-800 bg-white" required min="100" value={surveyD} onChange={(e) => setSurveyD(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label>Height (H) - mm</label>
                    <input type="number" className="text-slate-800 bg-white" required min="100" value={surveyH} onChange={(e) => setSurveyH(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Pad Thickness</label>
                  <select className="text-slate-800 bg-white" value={surveyThickness} onChange={(e) => setSurveyThickness(parseFloat(e.target.value) || 100)} required>
                    <option value="100">100 mm</option>
                    <option value="150">150 mm</option>
                    <option value="200">200 mm</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Configuration Type</label>
                  <select className="text-slate-800 bg-white" value={surveyConfigType} onChange={(e) => handleConfigTypeChange(e.target.value)} required>
                    <option value="3-face">3 Faces (U-Shape - Open Front)</option>
                    <option value="4-face">4 Faces (Full Wrap)</option>
                    <option value="2-opposite">2 Opposite Faces (Front/Back)</option>
                    <option value="2-adjacent">2 Adjacent Faces (Back/Left)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-secondary border border-slate-200 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setSubmitStatusType('draft')}>Save Draft</button>
                  <button type="submit" className="btn" onClick={() => setSubmitStatusType('final')}>Generate Quotation</button>
                </div>
              </form>
            </div>

            {/* Live Preview Side Column */}
            <div>
              <div className="geometry-preview bg-white">
                <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700 }}>Visual Face Selector</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Click cooling pad face borders to activate or deactivate:</p>
                
                <div className="box-diagram">
                  <div className={`face-element face-front ${selectedFaces.includes('Front') ? 'selected' : ''}`} onClick={() => toggleFace('Front')}>FRONT</div>
                  <div className={`face-element face-back ${selectedFaces.includes('Back') ? 'selected' : ''}`} onClick={() => toggleFace('Back')}>BACK</div>
                  <div className={`face-element face-left ${selectedFaces.includes('Left') ? 'selected' : ''}`} onClick={() => toggleFace('Left')}>LEFT</div>
                  <div className={`face-element face-right ${selectedFaces.includes('Right') ? 'selected' : ''}`} onClick={() => toggleFace('Right')}>RIGHT</div>
                </div>

                <div className="text-xs font-semibold text-slate-600 mt-2">
                  Corner Posts Count: <span className="text-blue-600 font-bold">{surveyConfigType === '2-adjacent' ? 3 : 4}</span>
                </div>
              </div>

              <div className="table-container p-5 bg-white mt-4">
                <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '1rem', textTransform: 'uppercase', fontWeight: 700 }}>Live Estimate</h3>
                <table style={{ width: '100%', fontSize: '0.85rem', lineHeight: 2.2 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Total Cooling Pads:</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.totalPads} sheet(s)</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Aluminium Frame (bars):</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.frameBars} pcs</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Support Patti (bars):</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.pattiBars} pcs</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Plate Sheeting (sheets):</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.plateSheets} sheets</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Flow rate required:</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.requiredFlowLPH.toFixed(0)} LPH</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-secondary)' }}>Selected pump model:</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{liveEstimate.pumpModelName}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border-color)', fontWeight: 700, fontSize: '1rem' }}>
                      <td style={{ color: 'var(--text-primary)', paddingTop: '0.5rem' }}>Estimated Total:</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)', paddingTop: '0.5rem' }}>₹{liveEstimate.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* VIEW C: CUSTOMERS DIRECTORY */}
      {mode === 'customers' && (
        <section className="animate-fade">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-slate-500 font-medium">Listing all registered customers with billing profiles specifically for chiller models.</div>
            <button className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors" onClick={() => setCustomerModalOpen(true)}>+ Add Chiller Customer</button>
          </div>

          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Site Address</th>
                  <th>Contact Phone</th>
                  <th>Email Address</th>
                  <th>Date Added</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No customers registered.</td></tr>
                ) : (
                  customers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                      <td>{c.site_address}</td>
                      <td>{c.contact_number || 'N/A'}</td>
                      <td>{c.email || 'N/A'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW D: ADMIN SETTINGS PANEL */}
      {mode === 'settings' && (
        <section className="animate-fade">
          <div className="two-col-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="table-container p-6 bg-white">
              <h2 style={{ color: 'var(--accent-primary)', fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', textTransform: 'uppercase' }}>Create New Rate Card Version</h2>
              <form onSubmit={handleRateCardSubmit}>
                
                <div className="form-group">
                  <label>Version Label</label>
                  <input type="text" className="text-slate-800 bg-white" required placeholder="e.g. July 2026 Adjustments" value={rcVersion} onChange={(e) => setRcVersion(e.target.value)} />
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  
                  {/* Evaporative Cooling Pad 7090 */}
                  <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Evaporative Cooling Pad 7090(NTK)</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Height (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcPadH} onChange={(e) => setRcPadH(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Width (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcPadW} onChange={(e) => setRcPadW(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Depth (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcPadD} onChange={(e) => setRcPadD(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Req. Qty</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcPadQty} onChange={(e) => setRcPadQty(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Rate (₹)</span>
                        <input type="number" step="0.01" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcPadCost} onChange={(e) => setRcPadCost(parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Bottom Plate */}
                  <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Aluminium Frame - Bottom Plate</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Height (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcBottomPlateH} onChange={(e) => setRcBottomPlateH(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Width (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcBottomPlateW} onChange={(e) => setRcBottomPlateW(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Depth (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcBottomPlateD} onChange={(e) => setRcBottomPlateD(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Req. Qty</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcBottomPlateQty} onChange={(e) => setRcBottomPlateQty(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Rate (₹)</span>
                        <input type="number" step="0.01" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcBottomPlateCost} onChange={(e) => setRcBottomPlateCost(parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Side Plate */}
                  <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Aluminium Frame - Side Plate</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Height (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSidePlateH} onChange={(e) => setRcSidePlateH(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Width (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSidePlateW} onChange={(e) => setRcSidePlateW(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Depth (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSidePlateD} onChange={(e) => setRcSidePlateD(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Req. Qty</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSidePlateQty} onChange={(e) => setRcSidePlateQty(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Rate (₹)</span>
                        <input type="number" step="0.01" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSidePlateCost} onChange={(e) => setRcSidePlateCost(parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Support Patti */}
                  <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Aluminium Support Patti</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Height (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSupportPattiH} onChange={(e) => setRcSupportPattiH(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Width (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSupportPattiW} onChange={(e) => setRcSupportPattiW(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Depth (mm)</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSupportPattiD} onChange={(e) => setRcSupportPattiD(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Req. Qty</span>
                        <input type="number" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSupportPattiQty} onChange={(e) => setRcSupportPattiQty(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group mb-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Rate (₹)</span>
                        <input type="number" step="0.01" className="p-1 text-xs text-slate-800 bg-white border border-slate-200 rounded" required value={rcSupportPattiCost} onChange={(e) => setRcSupportPattiCost(parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="form-group mt-3">
                  <label className="text-slate-700">Required Flow Rate Multiplier (LPH / sqft)</label>
                  <input type="number" className="text-slate-800 bg-white" step="0.1" required value={rcLphMultiplier} onChange={(e) => setRcLphMultiplier(parseFloat(e.target.value) || 0)} />
                </div>

                {/* Pumps edit */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 className="font-bold text-slate-800 text-xs uppercase">Pump Models Database</h3>
                    <button type="button" className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-slate-700 ml-auto" onClick={() => setAdminPumps([...adminPumps, { modelName: '', capacityLPH: 0, cost: 0 }])}>+ Add Pump</button>
                  </div>
                  <table className="app-table text-xs">
                    <thead>
                      <tr>
                        <th>Model Name</th>
                        <th>Capacity (LPH)</th>
                        <th>Cost (₹)</th>
                        <th>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminPumps.map((p, idx) => (
                        <tr key={idx}>
                          <td><input type="text" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={p.modelName} onChange={(e) => {
                            const list = [...adminPumps];
                            list[idx].modelName = e.target.value;
                            setAdminPumps(list);
                          }} required /></td>
                          <td><input type="number" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={p.capacityLPH} onChange={(e) => {
                            const list = [...adminPumps];
                            list[idx].capacityLPH = parseFloat(e.target.value) || 0;
                            setAdminPumps(list);
                          }} required /></td>
                          <td><input type="number" step="0.01" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={p.cost} onChange={(e) => {
                            const list = [...adminPumps];
                            list[idx].cost = parseFloat(e.target.value) || 0;
                            setAdminPumps(list);
                          }} required /></td>
                          <td><button type="button" className="text-red-500 hover:text-red-700 font-bold px-2 py-1 text-sm" onClick={() => setAdminPumps(adminPumps.filter((_, i) => i !== idx))}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Plumbing cost bands */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 className="font-bold text-slate-800 text-xs uppercase">Plumbing Cost Bands</h3>
                    <button type="button" className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-slate-700 ml-auto" onClick={() => setAdminPlumbingBands([...adminPlumbingBands, { minFlowLPH: 0, maxFlowLPH: 0, cost: 0 }])}>+ Add Band</button>
                  </div>
                  <table className="app-table text-xs">
                    <thead>
                      <tr>
                        <th>Min Flow (LPH)</th>
                        <th>Max Flow (LPH)</th>
                        <th>Cost (₹)</th>
                        <th>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminPlumbingBands.map((b, idx) => (
                        <tr key={idx}>
                          <td><input type="number" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={b.minFlowLPH} onChange={(e) => {
                            const list = [...adminPlumbingBands];
                            list[idx].minFlowLPH = parseFloat(e.target.value) || 0;
                            setAdminPlumbingBands(list);
                          }} required /></td>
                          <td><input type="number" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={b.maxFlowLPH} onChange={(e) => {
                            const list = [...adminPlumbingBands];
                            list[idx].maxFlowLPH = parseFloat(e.target.value) || 0;
                            setAdminPlumbingBands(list);
                          }} required /></td>
                          <td><input type="number" step="0.01" className="table-input text-slate-800 bg-slate-50 border border-slate-200 text-xs p-1" value={b.cost} onChange={(e) => {
                            const list = [...adminPlumbingBands];
                            list[idx].cost = parseFloat(e.target.value) || 0;
                            setAdminPlumbingBands(list);
                          }} required /></td>
                          <td><button type="button" className="text-red-500 hover:text-red-700 font-bold px-2 py-1 text-sm" onClick={() => setAdminPlumbingBands(adminPlumbingBands.filter((_, i) => i !== idx))}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button type="submit" className="btn mt-6">Save and Activate Card</button>
              </form>
            </div>

            {/* Version History Column */}
            <div className="table-container p-4 bg-white">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '1.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Version History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rateCards.map(rc => (
                  <div key={rc.id} className="border border-slate-200 p-3 rounded-xl hover:shadow-sm transition-shadow flex justify-between items-center bg-slate-50">
                    <div>
                      <strong className="text-xs text-slate-800">{rc.versionLabel}</strong>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Effective: {rc.effectiveDate}</div>
                    </div>
                    {rc.isActive ? (
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: '600' }}>● Active</span>
                    ) : (
                      <button className="bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-semibold px-2 py-1 rounded text-slate-700" onClick={() => handleToggleAdminActiveCard(rc.id)}>Activate</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --- ADD NEW CUSTOMER MODAL --- */}
      {customerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <button className="modal-close" onClick={() => setCustomerModalOpen(false)}>✖</button>
            <h2 className="font-bold text-slate-800 text-base mb-4">Add New Customer</h2>
            <form onSubmit={handleCustomerSubmit}>
              <div className="form-group">
                <label>Customer/Company Name</label>
                <input type="text" className="text-slate-800 bg-white" required placeholder="e.g. Delta Cooling LLC" value={custName} onChange={(e) => setCustName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Site Delivery Address</label>
                <textarea className="text-slate-800 bg-white" required rows={3} placeholder="Enter physical site address" value={custAddress} onChange={(e) => setCustAddress(e.target.value)}></textarea>
              </div>
              <div className="form-group">
                <label>Contact Phone Number</label>
                <input type="text" className="text-slate-800 bg-white" placeholder="e.g. 555-1234" value={custContact} onChange={(e) => setCustContact(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" className="text-slate-800 bg-white" placeholder="e.g. contact@deltacool.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn mt-2">Register Customer</button>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAILED QUOTATION VIEW MODAL --- */}
      {quoteModalOpen && selectedQuoteDetail && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setQuoteModalOpen(false)}>✖</button>
            
            <div className="quote-view-container flex flex-col gap-4">
              <div className="quote-view-header border-b border-slate-100 pb-2">
                <h2 className="font-bold text-slate-800 text-lg">QUOTE #Q-{selectedQuoteDetail.id}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Date Generated: {new Date(selectedQuoteDetail.created_at).toLocaleDateString()}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Client Details</h3>
                  <ul className="specs-list">
                    <li><span>Name:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.customer_name}</span></li>
                    <li><span>Site Address:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.site_address}</span></li>
                    <li><span>Contact:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.contact_number || 'N/A'}</span></li>
                  </ul>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Cooler Specifications</h3>
                  <ul className="specs-list">
                    <li><span>Dimensions (H x W x D):</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.inputSnapshot?.W}x{selectedQuoteDetail.inputSnapshot?.D}x{selectedQuoteDetail.inputSnapshot?.H} mm</span></li>
                    <li><span>Faces Selected:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.inputSnapshot?.faceSelectionType} ({(selectedQuoteDetail.inputSnapshot?.faces || []).join(', ')})</span></li>
                    <li><span>Pad Thickness:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>{selectedQuoteDetail.inputSnapshot?.thickness} mm</span></li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>Line-Item Price Breakdown</h3>
                <table className="app-table text-xs">
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th style={{ textAlign: 'center' }}>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ textAlign: 'right' }}>Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuoteDetail.outputSnapshot && (
                      <>
                        <tr>
                          <td>Evaporative Cooling Pads</td>
                          <td style={{ textAlign: 'center' }}>{selectedQuoteDetail.outputSnapshot.pads?.totalPads}</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.rates?.coolingPadUnitCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.pads?.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td>Bottom Plate & Side Plates</td>
                          <td style={{ textAlign: 'center' }}>{selectedQuoteDetail.outputSnapshot.plates?.sheetsNeeded}</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.rates?.plateCostPerSheet || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.plates?.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td>Aluminium Outer Frame Channels</td>
                          <td style={{ textAlign: 'center' }}>{selectedQuoteDetail.outputSnapshot.frame?.barsNeeded}</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.rates?.aluminiumCostPerBar || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.frame?.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td>Support Patti joint channels</td>
                          <td style={{ textAlign: 'center' }}>{selectedQuoteDetail.outputSnapshot.patti?.barsNeeded}</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.rates?.supportPattiCostPerBar || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.patti?.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td>Plumbing Pipeline Sizing Fittings</td>
                          <td style={{ textAlign: 'center' }}>1</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.outputSnapshot.pumpPlumbing?.plumbingCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.pumpPlumbing?.plumbingCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td>Water pump model: {selectedQuoteDetail.outputSnapshot.pumpPlumbing?.selectedPump?.modelName || 'N/A'}</td>
                          <td style={{ textAlign: 'center' }}>1</td>
                          <td style={{ textAlign: 'right' }}>₹{(selectedQuoteDetail.outputSnapshot.pumpPlumbing?.selectedPump?.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(selectedQuoteDetail.outputSnapshot.pumpPlumbing?.pumpCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="quote-total-banner border border-slate-200 mt-2 p-4 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                  <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Grand Total Sizing Estimate</p>
                  <h2 className="text-xl font-bold text-blue-600">₹{(selectedQuoteDetail.outputSnapshot?.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs px-3 py-2 rounded-xl font-semibold text-slate-700" onClick={handleDuplicateQuote}>Duplicate Sizing</button>
                  {selectedQuoteDetail.status === 'final' && (
                    <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-xl font-semibold shadow-md shadow-blue-500/10" onClick={() => handleDownloadPdf(selectedQuoteDetail.id)}>Download PDF</button>
                  )}
                </div>
              </div>

              {/* Engineering details */}
              {selectedQuoteDetail.outputSnapshot && (
                <div className="eng-specs-panel mt-3 bg-slate-50">
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontWeight: 700 }} className="mb-2">Engineering Specs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="eng-group">
                      <h4>Pads Detail</h4>
                      <ul>
                        <li>Total pads: <strong>{selectedQuoteDetail.outputSnapshot.pads?.totalPads} sheet(s)</strong></li>
                        {selectedQuoteDetail.outputSnapshot.pads?.breakdown?.map((fd: any, i: number) => (
                          <li key={i} style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>• {fd.name}: {fd.padsAcrossWidth}W x {fd.padsAcrossHeight}H ({fd.padsForFace} pads)</li>
                        ))}
                      </ul>
                    </div>
                    <div className="eng-group">
                      <h4>Outer Framing</h4>
                      <ul>
                        <li>Total Length: <strong>{selectedQuoteDetail.outputSnapshot.frame?.totalLength?.toFixed(0)} mm</strong></li>
                        <li>Bars: <strong>{selectedQuoteDetail.outputSnapshot.frame?.barsNeeded} pcs</strong> ({selectedQuoteDetail.rates?.alu_stock_length}mm)</li>
                      </ul>
                    </div>
                    <div className="eng-group">
                      <h4>Plates & Patti</h4>
                      <ul>
                        <li>Patti verticals: <strong>{selectedQuoteDetail.outputSnapshot.patti?.postsCount} posts</strong> ({selectedQuoteDetail.outputSnapshot.patti?.barsNeeded} bars)</li>
                        <li>Plate sheets: <strong>{selectedQuoteDetail.outputSnapshot.plates?.sheetsNeeded} sheets</strong></li>
                      </ul>
                    </div>
                    <div className="eng-group">
                      <h4>Pumps & plumbing</h4>
                      <ul>
                        <li>Flow rate required: <strong>{selectedQuoteDetail.outputSnapshot.pumpPlumbing?.requiredFlowLPH?.toFixed(0)} LPH</strong></li>
                        <li>Pump capacity: <strong>{selectedQuoteDetail.outputSnapshot.pumpPlumbing?.selectedPump?.capacityLPH} LPH</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
