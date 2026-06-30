import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, Download, LayoutGrid, List as ListIcon, X, Phone, RefreshCw, Loader2, User } from 'lucide-react';
import ProspectTable from '../components/prospects/ProspectTable';
import ProspectKanban from '../components/prospects/ProspectKanban';
import ProspectDetailPopup from '../components/prospects/ProspectDetailPopup';
import { useAuth } from '../contexts/AuthContext';

/* ─── API field mapping ─── */
function mapApiProspect(api) {
  const pd = api.prospect_data || {};
  return {
    id: String(api.id),
    company: api.company_name || '',
    website: api.company_website || '',
    country: api.company_country || '',
    industry: api.company_industry || '',
    contactName: api.contact_name || '',
    email: api.contact_email || '',
    phone: api.contact_phone || '',
    mobile: api.contact_mobile || api.contact_phone || '',
    position: api.contact_position || '',
    status: mapProspectStatus(api.status),
    priority: mapPriority(api.priority),
    // No fabricated default: null when no AI/manual score so the UI shows "—".
    score: api.ai_score ? Math.round(api.ai_score * 10) : (api.manual_score ? api.manual_score * 10 : null),
    broker: pd.broker || api.broker || '',
    strategy: pd.strategy_notes || '',
    taperPayActive: pd.taperpay_active || false,
    taperTradeActive: pd.tapertrade_active || false,
    fxVolume: pd.fx_estimated_volume || 0,
    tfVolume: pd.tf_estimated_volume || 0,
    revenuePotential: (pd.fx_estimated_revenue || 0) + (pd.tf_estimated_revenue || 0),
    onCallList: api.on_daily_list || false,
    notes: [],
    documents: [],
    fxDetails: (pd.fx_estimated_volume || pd.fx_estimated_margin_pct) ? {
      volume: pd.fx_estimated_volume || 0,
      currencies: (pd.currencies || []).map(c => ({
        inCountry: c.value,
        outCountry: '',
        buyingCurrency: c.currency_type === 'buying_currency' ? c.value : '',
        sellingCurrency: c.currency_type === 'selling_currency' ? c.value : '',
        volume: c.volume || 0,
      })),
      margin: pd.fx_estimated_margin_pct ? pd.fx_estimated_margin_pct / 100 : 0,
    } : null,
    tfDetails: (pd.tf_debtor_finance || pd.tf_portfolio_finance || pd.tf_voorraad_finance || pd.tf_estimated_volume || pd.tf_total_financing_need) ? {
      debtorFinance: pd.tf_debtor_finance || false,
      portfolioBasedFinance: pd.tf_portfolio_finance || false,
      voorraadFinancing: pd.tf_voorraad_finance || false,
      volume: pd.tf_estimated_volume || 0,
      totalFacilityAmount: pd.tf_total_financing_need || 0,
      additionalInfo: pd.tf_additional_info || '',
      margin: pd.tf_estimated_margin_pct ? pd.tf_estimated_margin_pct / 100 : 0,
    } : null,
    callbacks: [],
    meetings: [],
    createdAt: api.created_at ? new Date(api.created_at) : new Date(),
    _raw: api,
  };
}

function mapProspectStatus(apiStatus) {
  const map = {
    discovery: 'Discovery',
    in_negotiation: 'In Negotiation',
    proposal_sent: 'Proposal Sent',
    onboarding: 'Onboarding',
    converted: 'In Negotiation',
    new: 'Discovery',
    contacted: 'Discovery',
    qualified: 'In Negotiation',
    snoozed: 'Discovery',
    lost: 'Discovery',
  };
  return map[apiStatus] || apiStatus || 'Discovery';
}

function mapPriority(apiPriority) {
  const map = {
    critical: 'Critical',
    hot: 'Critical',
    warm: 'High',
    cold: 'Medium',
    low: 'Low',
  };
  return map[apiPriority] || apiPriority || 'Medium';
}

function reverseMapStatus(uiStatus) {
  const map = {
    'Discovery': 'discovery',
    'In Negotiation': 'in_negotiation',
    'Proposal Sent': 'proposal_sent',
    'Onboarding': 'onboarding',
  };
  return map[uiStatus] || 'discovery';
}

export default function ProspectsPage() {
  const { user } = useAuth();
  const isSalesOnly = user && ['sales', 'extern'].includes(user.role) && !user.is_teamleader;
  const [viewMode, setViewMode] = useState('list');
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Open a specific prospect when navigated to with ?open=<leadId> (e.g. from the callback agenda)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    (async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const resp = await fetch(`/api/v1/prospects/${openId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setSelectedProspect(mapApiProspect(data));
        }
      } catch { /* ignore */ }
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    taperPayActive: null,
    taperTradeActive: null,
  });

  const getToken = () => sessionStorage.getItem('auth_token');

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page_size: '200' });
      if (searchQuery) params.set('search', searchQuery);
      if (filters.taperPayActive !== null) params.set('taperpay', String(filters.taperPayActive));
      if (filters.taperTradeActive !== null) params.set('tapertrade', String(filters.taperTradeActive));

      const res = await fetch(`/api/v1/prospects/?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = (data.prospects || []).map(mapApiProspect);
      setProspects(mapped);
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters.taperPayActive, filters.taperTradeActive]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // Debounce search
  const [searchTimer, setSearchTimer] = useState(null);
  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimer) clearTimeout(searchTimer);
    // search triggers via useEffect/fetchProspects dependency
  }

  // Call list
  const callListProspects = useMemo(() => {
    return prospects.filter(p => p.onCallList);
  }, [prospects]);

  // Filter prospects client-side for status & priority (server doesn't support these)
  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      const matchesStatus = filters.status.length === 0 || filters.status.includes(prospect.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(prospect.priority);
      return matchesStatus && matchesPriority;
    });
  }, [prospects, filters.status, filters.priority]);

  const handleExport = () => {
    const csv = [
      ['Bedrijf', 'Contact', 'Email', 'Telefoon', 'Status', 'Prioriteit', 'FX Volume', 'TF Volume', 'Revenue Potentieel'].join(','),
      ...filteredProspects.map(p =>
        [p.company, p.contactName, p.email, p.mobile, p.status, p.priority,
          p.fxVolume, p.tfVolume, p.revenuePotential].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilters({
      status: [],
      priority: [],
      taperPayActive: null,
      taperTradeActive: null,
    });
  };

  const handleStatusChange = async (prospectId, newStatus) => {
    // Optimistic update
    setProspects(prev => prev.map(p =>
      p.id === prospectId ? { ...p, status: newStatus } : p
    ));
    // API update
    try {
      const numId = parseInt(prospectId);
      const res = await fetch(`/api/v1/leads/${numId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: reverseMapStatus(newStatus) }),
      });
      if (!res.ok) throw new Error('Status update mislukt');
    } catch (err) {
      console.error('Status update failed:', err);
      fetchProspects(); // rollback
    }
  };

  const handleToggleCallList = async (prospectId, currentlyOnList) => {
    setProspects(prev => prev.map(p =>
      p.id === prospectId ? { ...p, onCallList: !currentlyOnList } : p
    ));
    try {
      const numId = parseInt(prospectId);
      if (currentlyOnList) {
        await fetch(`/api/v1/leads/${numId}/from-daily-list`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      } else {
        await fetch(`/api/v1/leads/${numId}/to-daily-list`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      }
    } catch (err) {
      console.error('Toggle call list failed:', err);
      fetchProspects();
    }
  };

  const handleRemoveFromCallList = async (prospectId) => {
    setProspects(prev => prev.map(p =>
      p.id === prospectId ? { ...p, onCallList: false } : p
    ));
    try {
      const numId = parseInt(prospectId);
      await fetch(`/api/v1/leads/${numId}/from-daily-list`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch (err) {
      console.error('Remove from call list failed:', err);
      fetchProspects();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaf2] px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[#011745]">Prospects</h1>
              {isSalesOnly ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#eef2fa] text-[#3d61a4]">
                  <User size={12} /> Mijn prospects
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#f3f4f8] text-[#7b859e]">
                  Alle prospects
                </span>
              )}
            </div>
            <p className="text-[#7b859e] text-sm mt-1">
              {loading ? 'Laden...' : `${filteredProspects.length} prospects • ${prospects.filter(p => p.taperPayActive || p.taperTradeActive).length} active`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh */}
            <button
              onClick={fetchProspects}
              disabled={loading}
              className="p-2.5 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#3d61a4]"
              title="Ververs"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            </button>

            {/* View Toggle */}
            <div className="bg-[#f7f8fc] rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-[#3d61a4] shadow-sm'
                    : 'text-[#7b859e] hover:text-[#3d61a4]'
                }`}
                title="List view"
              >
                <ListIcon size={20} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-white text-[#3d61a4] shadow-sm'
                    : 'text-[#7b859e] hover:text-[#3d61a4]'
                }`}
                title="Kanban view"
              >
                <LayoutGrid size={20} />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="p-2.5 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#3d61a4]"
              title="Filter"
            >
              <Filter size={20} />
            </button>
            <button
              onClick={handleExport}
              className="p-2.5 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#3d61a4]"
              title="Export CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a4abbe]"
            />
            <input
              type="text"
              placeholder="Zoek prospects op bedrijf, contact, e-mail..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] transition-all"
            />
          </div>

          {/* Filter Panel Toggle */}
          {showFilterPanel && (
            <div className="absolute top-24 right-8 bg-white rounded-xl shadow-lg border border-[#e8eaf2] p-4 z-40 w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#011745]">Filters</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetFilters}
                    className="text-xs px-2 py-1 text-[#3d61a4] hover:bg-[#eef2fa] rounded transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="text-[#7b859e] hover:text-[#011745] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <label className="text-sm font-medium text-[#566079] block mb-2">Status</label>
                <div className="space-y-2">
                  {['Discovery', 'In Negotiation', 'Proposal Sent', 'Onboarding'].map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, status: [...filters.status, status] });
                          } else {
                            setFilters({ ...filters, status: filters.status.filter(s => s !== status) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-[#566079]">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="mb-4">
                <label className="text-sm font-medium text-[#566079] block mb-2">Prioriteit</label>
                <div className="space-y-2">
                  {['Critical', 'High', 'Medium', 'Low'].map(priority => (
                    <label key={priority} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, priority: [...filters.priority, priority] });
                          } else {
                            setFilters({ ...filters, priority: filters.priority.filter(p => p !== priority) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-[#566079]">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* TaperPay Filter */}
              <div className="mb-4">
                <label className="text-sm font-medium text-[#566079] block mb-2">TaperPay</label>
                <select
                  value={filters.taperPayActive === null ? '' : filters.taperPayActive}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : e.target.value === 'true';
                    setFilters({ ...filters, taperPayActive: value });
                  }}
                  className="w-full px-3 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] text-sm text-[#566079]"
                >
                  <option value="">Alle</option>
                  <option value="true">Actief</option>
                  <option value="false">Inactief</option>
                </select>
              </div>

              {/* TaperTrade Filter */}
              <div>
                <label className="text-sm font-medium text-[#566079] block mb-2">TaperTrade</label>
                <select
                  value={filters.taperTradeActive === null ? '' : filters.taperTradeActive}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : e.target.value === 'true';
                    setFilters({ ...filters, taperTradeActive: value });
                  }}
                  className="w-full px-3 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] text-sm text-[#566079]"
                >
                  <option value="">Alle</option>
                  <option value="true">Actief</option>
                  <option value="false">Inactief</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {loading && prospects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
              <p className="text-sm" style={{ color: '#7b859e' }}>Prospects laden...</p>
            </div>
          ) : error && prospects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchProspects}
                className="text-sm font-medium px-4 py-2 rounded-lg"
                style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>
                Opnieuw proberen
              </button>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-base font-semibold" style={{ color: '#011745' }}>Geen prospects gevonden</p>
              <p className="text-sm" style={{ color: '#7b859e' }}>
                {searchQuery ? 'Probeer een andere zoekterm' : 'Converteer leads naar prospect om te beginnen'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <ProspectTable
              prospects={filteredProspects}
              onSelectProspect={setSelectedProspect}
            />
          ) : (
            <ProspectKanban
              prospects={filteredProspects}
              onSelectProspect={setSelectedProspect}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {/* Detail Popup */}
      {selectedProspect && (
        <ProspectDetailPopup
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onToggleCallList={handleToggleCallList}
          onUpdate={(updatedProspect) => {
            if (updatedProspect.status === 'Onboarding') {
              // Moved to onboarding — remove from prospects list and close popup
              setProspects(prev => prev.filter(p => p.id !== updatedProspect.id));
              setSelectedProspect(null);
              fetchProspects();
            } else {
              setProspects(prev => prev.map(p => (p.id === updatedProspect.id ? updatedProspect : p)));
              setSelectedProspect(updatedProspect);
            }
          }}
        />
      )}
    </div>
  );
}
