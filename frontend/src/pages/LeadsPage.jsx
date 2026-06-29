import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, Download, Upload, LayoutGrid, List as ListIcon, X, Loader2, RefreshCw, Lock, Globe, AlertTriangle } from 'lucide-react';
import LeadTable from '../components/leads/LeadTable';
import LeadKanban from '../components/leads/LeadKanban';
import LeadDetailPopup from '../components/leads/LeadDetailPopup';
import DailyCallList from '../components/leads/DailyCallList';
import NewLeadModal from '../components/leads/NewLeadModal';
import { useAuth } from '../contexts/AuthContext';

/**
 * Map API lead object → frontend lead object.
 * The child components (LeadTable, LeadKanban, DailyCallList) expect camelCase field names.
 */
function mapApiLead(apiLead) {
  return {
    id: String(apiLead.id),
    company: apiLead.company_name || '',
    website: apiLead.company_website || '',
    country: apiLead.company_country || '',
    industry: apiLead.company_industry || '',
    contactName: apiLead.contact_name || '',
    email: apiLead.contact_email || '',
    phone: apiLead.contact_phone || '',
    mobile: apiLead.contact_mobile || apiLead.contact_phone || '',
    position: apiLead.contact_position || '',
    status: mapStatus(apiLead.status),
    priority: mapPriority(apiLead.priority),
    score: apiLead.ai_score ? Math.round(apiLead.ai_score * 10) : (apiLead.manual_score ? apiLead.manual_score * 10 : 50),
    called: apiLead.is_called || false,
    onDailyList: apiLead.on_daily_list || false,
    lastCall: apiLead.last_called_at ? new Date(apiLead.last_called_at) : null,
    callDuration: 0,
    callCount: apiLead.call_count || 0,
    notes: [],
    documents: [],
    createdAt: apiLead.created_at ? new Date(apiLead.created_at) : new Date(),
    partnerName: apiLead.partner_name || null,
    // Keep raw API data for updates
    _raw: apiLead,
  };
}

function mapStatus(apiStatus) {
  const statusMap = {
    new: 'New',
    contacted: 'Contacted',
    callback: 'Callback',
    interested: 'Interested',
    not_interested: 'Not Interested',
    snoozed: 'Snoozed',
    archived: 'Archived',
    converted: 'Converted',
  };
  return statusMap[apiStatus] || apiStatus || 'New';
}

function mapPriority(apiPriority) {
  const priorityMap = {
    hot: 'Critical',
    warm: 'High',
    cold: 'Medium',
  };
  return priorityMap[apiPriority] || apiPriority || 'Medium';
}

function reverseMapPriority(frontendPriority) {
  const map = {
    'Critical': 'hot',
    'High': 'warm',
    'Medium': 'cold',
    'Low': 'cold',
  };
  return map[frontendPriority] || frontendPriority?.toLowerCase() || 'cold';
}

/** Reverse map: frontend status → API status */
function reverseMapStatus(frontendStatus) {
  const map = {
    'New': 'new',
    'Contacted': 'contacted',
    'Callback': 'callback',
    'Interested': 'interested',
    'Not Interested': 'not_interested',
    'Geen interesse': 'not_interested',
    'Snoozed': 'snoozed',
    'Archived': 'archived',
    'Converted': 'converted',
  };
  return map[frontendStatus] || frontendStatus?.toLowerCase() || 'new';
}

export default function LeadsPage() {
  const { user } = useAuth();
  const isExtern = user?.role === 'extern';

  const [viewMode, setViewMode] = useState('list');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsTab, setLeadsTab] = useState('algemeen'); // 'algemeen' | 'mijn' | 'closed'
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    assignedTo: [],
    dateRange: { from: null, to: null },
  });

  // Open a specific lead when navigated to with ?open=<leadId> (e.g. from the callback agenda)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    (async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const resp = await fetch(`/api/v1/leads/${openId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setSelectedLead(mapApiLead(data));
        }
      } catch { /* ignore */ }
      // Clear the param so the popup doesn't reopen on every render
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Duplicate check state (for new lead form)
  const [dupQuery, setDupQuery] = useState('');
  const [dupResults, setDupResults] = useState([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const dupTimer = useRef(null);

  const checkDuplicates = useCallback(async (q) => {
    if (!q || q.length < 2) { setDupResults([]); return; }
    setCheckingDup(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      // Duplicate check: search ALL leads (incl. locked/other users) — extern users need this too
      const resp = await fetch(`/api/v1/leads/?search=${encodeURIComponent(q)}&page_size=5&dup_check=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setDupResults((data.leads || []).map(mapApiLead));
      }
    } catch { setDupResults([]); }
    finally { setCheckingDup(false); }
  }, []);

  // ─── Fetch leads from API ────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      setError('');
      const token = sessionStorage.getItem('auth_token');
      if (!token) {
        setError('Niet ingelogd');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ page_size: '200' });
      if (searchQuery.trim()) {
        // Search searches ALL leads (both algemeen + mijn)
        params.set('search', searchQuery.trim());
      } else if (leadsTab === 'closed') {
        params.set('status', 'not_interested');
        params.set('all_stages', 'true');
      } else if (isExtern) {
        // Extern users always see only their own leads
        params.set('my_leads', 'true');
      } else {
        // Tab filter only applies when not searching
        params.set('my_leads', leadsTab === 'mijn' ? 'true' : 'false');
      }

      const resp = await fetch(`/api/v1/leads/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        throw new Error(`Fout bij laden: ${resp.status}`);
      }

      const data = await resp.json();
      // API returns { leads: [...], total: N, page: N, page_size: N }
      const apiLeads = data.leads || data || [];
      const mapped = (Array.isArray(apiLeads) ? apiLeads : []).map(mapApiLead);
      setLeads(mapped);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err.message || 'Kon leads niet laden');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, leadsTab]);

  // Fetch on mount and when search changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  // ─── Filter leads locally ────────────────────────
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus = filters.status.length === 0 || filters.status.includes(lead.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(lead.priority);
      return matchesStatus && matchesPriority;
    });
  }, [leads, filters]);

  // ─── Lead actions (API calls) ────────────────────
  const handleToggleDailyList = async (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Optimistic update
    setLeads(leads.map(l =>
      l.id === leadId ? { ...l, onDailyList: !l.onDailyList } : l
    ));

    try {
      const token = sessionStorage.getItem('auth_token');
      let res;
      if (lead.onDailyList) {
        // Remove from daily list — update lead
        res = await fetch(`/api/v1/leads/${leadId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ on_daily_list: false }),
        });
      } else {
        // Add to daily list
        res = await fetch(`/api/v1/leads/${leadId}/to-daily-list`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Daily list toggle failed:', err);
      // Revert on error
      setLeads(leads.map(l =>
        l.id === leadId ? { ...l, onDailyList: lead.onDailyList } : l
      ));
    }
  };

  const handleStatusChange = async (leadId, newFrontendStatus) => {
    // Show churn modal for 'niet interested' status
    if (newFrontendStatus === 'Geen interesse' || newFrontendStatus === 'Not Interested') {
      setChurnModal({ leadId, pendingStatus: newFrontendStatus });
      setChurnData({ reason: '', competitor: '' });
      return; // Don't proceed yet — wait for modal
    }

    const apiStatus = reverseMapStatus(newFrontendStatus);
    const prevLeads = leads; // snapshot for rollback

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: newFrontendStatus } : l
    ));

    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Status update failed:', err);
      setLeads(prevLeads); // revert to snapshot instead of full refetch
    }
  };

  const handleChurnConfirm = async () => {
    if (!churnModal) return;
    const { leadId, pendingStatus } = churnModal;
    const apiStatus = reverseMapStatus(pendingStatus);
    const token = sessionStorage.getItem('auth_token');
    try {
      await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: apiStatus,
          churn_reason: churnData.reason || null,
          churn_to_competitor: churnData.competitor || null,
        }),
      });
      setLeads(prev => prev.filter(l => l.id !== String(leadId)));
      setChurnModal(null);
    } catch (err) { alert('Fout: ' + err.message); }
  };

  const [churnModal, setChurnModal] = useState(null); // { leadId, pendingStatus }
  const [churnData, setChurnData] = useState({ reason: '', competitor: '' });

  const [pinnedIds, setPinnedIds] = useState(new Set());

  // Fetch pinned leads on mount
  useEffect(() => {
    (async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch('/api/v1/leads/pinned/my', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPinnedIds(new Set(data.map(l => String(l.id))));
        }
      } catch (err) {
        console.error('Failed to fetch pinned leads:', err);
      }
    })();
  }, []);

  const handlePinLead = async (leadId) => {
    const isPinned = pinnedIds.has(leadId);
    // Optimistic update
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (isPinned) next.delete(leadId); else next.add(leadId);
      return next;
    });

    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/leads/${leadId}/pin`, {
        method: isPinned ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Pin toggle failed');
    } catch (err) {
      console.error('Pin failed:', err);
      // Revert
      setPinnedIds(prev => {
        const next = new Set(prev);
        if (isPinned) next.add(leadId); else next.delete(leadId);
        return next;
      });
    }
  };

  const handleExport = () => {
    // Export visible leads as CSV
    // Sanitize cells: prefix formula starters (= + - @) with a tab to prevent CSV injection in Excel/Sheets
    const sanitizeCell = (val) => {
      const s = String(val ?? '').replace(/"/g, '""'); // escape existing quotes
      // Neutralise formula injection
      return /^[=+\-@\t]/.test(s) ? `\t${s}` : s;
    };
    const headers = ['Bedrijf', 'Contact', 'Email', 'Telefoon', 'Status', 'Prioriteit', 'Score'];
    const rows = filteredLeads.map(l => [l.company, l.contactName, l.email, l.phone, l.status, l.priority, l.score]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${sanitizeCell(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#f7f8fc]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#e8eaf2] px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#011745]">Sales Leads</h1>
              <p className="text-[#7b859e] text-sm mt-1">
                {loading ? 'Laden...' : (
                  <>{filteredLeads.length} leads • {leads.filter(l => !l.called).length} niet gebeld</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh */}
              <button
                onClick={() => { setLoading(true); fetchLeads(); }}
                className="p-2.5 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#3d61a4]"
                title="Refresh"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
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
                className={`p-2.5 rounded-lg transition-colors ${
                  showFilterPanel || filters.status.length > 0 || filters.priority.length > 0
                    ? 'bg-[#eef2fa] text-[#3d61a4]'
                    : 'hover:bg-[#f7f8fc] text-[#7b859e] hover:text-[#3d61a4]'
                }`}
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

          {/* Tabs: Algemene Leads / Mijn Leads */}
          <div className="flex gap-1 mb-4 bg-[#f3f4f8] rounded-xl p-1 w-fit">
            {!isExtern && (
              <button
                onClick={() => { setLeadsTab('algemeen'); setLoading(true); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  leadsTab === 'algemeen'
                    ? 'bg-white text-[#011745] shadow-sm'
                    : 'text-[#7b859e] hover:text-[#566079]'
                }`}
              >
                <Globe size={15} /> Algemene Leads
              </button>
            )}
            <button
              onClick={() => { setLeadsTab('mijn'); setLoading(true); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                leadsTab === 'mijn' || isExtern
                  ? 'bg-[#011745] text-white shadow-sm'
                  : 'text-[#7b859e] hover:text-[#566079]'
              }`}
            >
              <Lock size={15} /> Mijn Leads
            </button>
            {!isExtern && (
              <button
                onClick={() => { setLeadsTab('closed'); setLoading(true); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
                  leadsTab === 'closed'
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'bg-white text-[#566079] border border-[#e8eaf2] hover:bg-[#f7f8fc]'
                }`}>
                <span className="text-xs">✕</span>
                Closed Leads
              </button>
            )}
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
                placeholder={searchQuery ? 'Zoeken in alle leads (incl. vergrendeld)...' : 'Zoek op bedrijfsnaam, contact, email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] transition-all"
              />
              {searchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  Alle leads
                </span>
              )}
            </div>

            {/* Filter Panel Toggle */}
            {showFilterPanel && (
              <div className="absolute top-24 right-8 bg-white rounded-xl shadow-lg border border-[#e8eaf2] p-4 z-40 w-64">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[#011745]">Filters</h3>
                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="p-1 hover:bg-[#f7f8fc] rounded transition-colors text-[#7b859e] hover:text-[#011745]"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Status Filter */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-[#566079] block mb-2">Status</label>
                  <div className="space-y-2">
                    {['New', 'Contacted', 'Callback', 'Interested', 'Not Interested', 'Snoozed', 'Archived'].map(status => (
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
                    {['Critical', 'High', 'Medium'].map(priority => (
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

                <button
                  onClick={() => setFilters({ status: [], priority: [], assignedTo: [], dateRange: { from: null, to: null } })}
                  className="w-full mt-4 py-2 px-3 bg-[#f7f8fc] hover:bg-[#eef2fa] text-[#3d61a4] text-sm font-medium rounded-lg transition-colors"
                >
                  Reset all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
              <span className="ml-3 text-[#566079]">Leads laden...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-red-500 mb-3">{error}</p>
              <button
                onClick={() => { setLoading(true); fetchLeads(); }}
                className="px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium"
              >
                Opnieuw proberen
              </button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#7b859e]">
              <p className="text-lg font-medium">Geen leads gevonden</p>
              <p className="text-sm mt-1">Voeg een nieuwe lead toe of pas je filters aan</p>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#3d61a4] text-white rounded-lg text-sm font-semibold hover:shadow-md transition-all"
              >
                <Plus size={18} />
                Eerste lead toevoegen
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <LeadTable
              leads={filteredLeads}
              onSelectLead={setSelectedLead}
              onToggleDailyList={handleToggleDailyList}
              onPinLead={handlePinLead}
              pinnedIds={pinnedIds}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <LeadKanban
              leads={filteredLeads}
              onSelectLead={setSelectedLead}
              onToggleDailyList={handleToggleDailyList}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowNewLeadModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:shadow-xl hover:scale-110 z-30"
        title="Nieuwe lead toevoegen"
      >
        <Plus size={24} />
      </button>

      {/* Detail Popup */}
      {selectedLead && (
        <LeadDetailPopup
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updatedFields) => {
            if (updatedFields) {
              setLeads(prev => prev.map(l =>
                l.id === selectedLead?.id
                  ? { ...l, ...updatedFields }
                  : l
              ));
            }
            // Also do a background refresh for complex fields
            fetchLeads();
          }}
        />
      )}

      {/* New Lead Modal */}
      <NewLeadModal
        isOpen={showNewLeadModal}
        onClose={() => setShowNewLeadModal(false)}
        onLeadCreated={() => {
          setShowNewLeadModal(false);
          setLoading(true);
          fetchLeads(); // Refresh the list
        }}
      />

      {/* Churn modal — reden vastleggen bij Geen interesse */}
      {churnModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-2" style={{ color: '#011745' }}>Geen interesse — reden vastleggen</h3>
            <p className="text-sm mb-4" style={{ color: '#7b859e' }}>Optioneel: leg de reden vast voor rapportage</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Reden</label>
                <input value={churnData.reason} onChange={e => setChurnData(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Bijv. budget onvoldoende, te vroeg, verkeerd segment..."
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Concurrent (optioneel)</label>
                <input value={churnData.competitor} onChange={e => setChurnData(p => ({ ...p, competitor: e.target.value }))}
                  placeholder="Welke concurrent kozen ze?"
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleChurnConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: '#dc2626' }}>
                Bevestigen — naar Closed Leads
              </button>
              <button onClick={() => setChurnModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#e8eaf2] text-[#566079]">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
