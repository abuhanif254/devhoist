'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  Cloud,
  CloudOff,
  Search,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Shield,
  Server,
  Mail,
  RefreshCw,
  X,
  Check,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { DnsRecord } from '@/context/PortalContext';
import {
  validateDnsRecord,
  exportBindZone,
  parseBindZone,
  getGoogleWorkspacePreset,
  getZohoMailPreset,
  getEmailSecurityShieldPreset,
  getDevHostServerPreset,
} from '@/lib/dnsEngine';

interface DnsZoneManagerProps {
  domainId: string;
  domainName: string;
  serverIp?: string;
  initialRecords?: DnsRecord[];
  onRecordsChange?: (records: DnsRecord[]) => void;
}

export default function DnsZoneManager({
  domainId,
  domainName,
  serverIp = '103.151.102.45',
  initialRecords = [],
  onRecordsChange,
}: DnsZoneManagerProps) {
  const [records, setRecords] = useState<DnsRecord[]>(initialRecords);
  const [loading, setLoading] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordType, setRecordType] = useState<DnsRecord['type']>('A');
  const [recordName, setRecordName] = useState('@');
  const [recordContent, setRecordContent] = useState('');
  const [recordTtl, setRecordTtl] = useState(3600);
  const [recordPriority, setRecordPriority] = useState<number | undefined>(10);
  const [recordProxied, setRecordProxied] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // BIND Import Modal State
  const [isBindImportOpen, setIsBindImportOpen] = useState(false);
  const [bindImportText, setBindImportText] = useState('');
  const [importCount, setImportCount] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  // Fetch live records from API on mount
  useEffect(() => {
    if (!domainId) return;
    let isMounted = true;
    async function fetchDns() {
      try {
        setLoading(true);
        const res = await fetch(`/api/domains/dns?domainId=${encodeURIComponent(domainId)}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.records) && data.records.length > 0) {
          setRecords(data.records);
          onRecordsChange?.(data.records);
        }
      } catch (err) {
        console.warn('Failed to load live DNS records, using fallback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchDns();
    return () => {
      isMounted = false;
    };
  }, [domainId]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesType = selectedTypeFilter === 'ALL' || r.type === selectedTypeFilter;
      const matchesSearch =
        searchQuery === '' ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [records, selectedTypeFilter, searchQuery]);

  // Open modal for new record
  const handleOpenAddModal = (type: DnsRecord['type'] = 'A') => {
    setEditingRecordId(null);
    setRecordType(type);
    setRecordName('@');
    setRecordContent(type === 'A' ? serverIp : '');
    setRecordTtl(3600);
    setRecordPriority(type === 'MX' ? 10 : undefined);
    setRecordProxied(['A', 'AAAA', 'CNAME'].includes(type));
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing record
  const handleOpenEditModal = (r: DnsRecord) => {
    setEditingRecordId(r.id);
    setRecordType(r.type);
    setRecordName(r.name);
    setRecordContent(r.content);
    setRecordTtl(r.ttl);
    setRecordPriority(r.priority);
    setRecordProxied(Boolean(r.proxied));
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Submit Save Record (POST or PUT to API)
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const recordData: Partial<DnsRecord> = {
      type: recordType,
      name: recordName.trim(),
      content: recordContent.trim(),
      ttl: recordTtl,
      priority: recordType === 'MX' || recordType === 'SRV' ? Number(recordPriority) : undefined,
      proxied: ['A', 'AAAA', 'CNAME'].includes(recordType) ? recordProxied : false,
    };

    // Client-side RFC 1035 / 2181 Validation
    const validation = validateDnsRecord(recordData, records, editingRecordId || undefined);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid DNS record.');
      return;
    }

    try {
      if (editingRecordId) {
        // Update
        const res = await fetch('/api/domains/dns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: editingRecordId,
            domainId,
            record: recordData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update record');

        setRecords((prev) =>
          prev.map((r) => (r.id === editingRecordId ? ({ ...r, ...recordData } as DnsRecord) : r))
        );
        showToast(`Record ${recordType} for ${recordName} updated successfully.`);
      } else {
        // Insert
        const res = await fetch('/api/domains/dns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_record',
            domainId,
            domainName,
            record: recordData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add record');

        const newRecord: DnsRecord = {
          id: data.recordId || `dns_${Date.now()}`,
          ...(recordData as any),
        };
        setRecords((prev) => [...prev, newRecord]);
        showToast(`Record ${recordType} for ${recordName} added to zone.`);
      }

      setIsModalOpen(false);
      onRecordsChange?.(records);
    } catch (err: any) {
      setValidationError(err.message || 'Operation failed.');
    }
  };

  // Delete Record
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this DNS record? This may disrupt traffic.')) return;

    try {
      await fetch(`/api/domains/dns?recordId=${encodeURIComponent(recordId)}&domainId=${encodeURIComponent(domainId)}`, {
        method: 'DELETE',
      });
      const updated = records.filter((r) => r.id !== recordId);
      setRecords(updated);
      onRecordsChange?.(updated);
      showToast('DNS record deleted.');
    } catch (err) {
      showToast('Record deleted locally.');
      const updated = records.filter((r) => r.id !== recordId);
      setRecords(updated);
      onRecordsChange?.(updated);
    }
  };

  // Toggle Proxy Status (Cloudflare orange cloud toggle)
  const handleToggleProxy = async (record: DnsRecord) => {
    if (!['A', 'AAAA', 'CNAME'].includes(record.type)) return;
    const newProxied = !record.proxied;

    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, proxied: newProxied } : r))
    );

    try {
      await fetch('/api/domains/dns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          domainId,
          record: { ...record, proxied: newProxied },
        }),
      });
      showToast(`Edge Proxy is now ${newProxied ? 'ACTIVE (Orange Cloud)' : 'BYPASS (DNS Only)'}`);
    } catch {
      showToast(`Proxy status updated to ${newProxied ? 'Active' : 'DNS Only'}.`);
    }
  };

  // 1-Click Point to Hosting IP
  const handlePointToHosting = async () => {
    if (!confirm(`Point apex (@), www, and mail DNS records to DevHost Node (${serverIp})?`)) return;

    try {
      const res = await fetch('/api/domains/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'point_to_hosting',
          domainId,
          domainName,
          serverIp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const presets = getDevHostServerPreset(domainName, serverIp);
      const newItems: DnsRecord[] = presets.map((p, idx) => ({
        id: `srv_${Date.now()}_${idx}`,
        ...p,
      }));
      setRecords((prev) => [...prev, ...newItems]);
      showToast('Domain successfully pointed to DevHost server node!');
    } catch (err: any) {
      showToast(err.message || 'Updated DNS records.');
    }
  };

  // 1-Click Apply Email Presets
  const handleApplyPreset = async (presetType: 'google' | 'zoho' | 'shield') => {
    try {
      const res = await fetch('/api/domains/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_preset',
          domainId,
          domainName,
          presetType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let presetItems: Array<Omit<DnsRecord, 'id'>> = [];
      if (presetType === 'google') presetItems = getGoogleWorkspacePreset(domainName);
      else if (presetType === 'zoho') presetItems = getZohoMailPreset(domainName);
      else presetItems = getEmailSecurityShieldPreset(domainName);

      const newItems: DnsRecord[] = presetItems.map((p, idx) => ({
        id: `preset_${Date.now()}_${idx}`,
        ...p,
      }));
      setRecords((prev) => [...prev, ...newItems]);
      showToast(`${presetType.toUpperCase()} security records appended to zone.`);
    } catch (err: any) {
      showToast(err.message || 'Preset applied.');
    }
  };

  // Export BIND Zone file
  const handleExportBind = () => {
    const bindText = exportBindZone(domainName, records);
    const blob = new Blob([bindText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${domainName}.zone.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('RFC 1035 BIND Zone file downloaded!');
  };

  // Import BIND Zone file
  const handleImportBind = async () => {
    if (!bindImportText.trim()) return;
    try {
      const res = await fetch('/api/domains/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_bind_zone',
          domainId,
          domainName,
          bindText: bindImportText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const parsed = parseBindZone(bindImportText, domainName);
      setRecords((prev) => [...prev, ...parsed]);
      setImportCount(parsed.length);
      setIsBindImportOpen(false);
      setBindImportText('');
      showToast(`Successfully imported ${parsed.length} records into zone!`);
    } catch (err: any) {
      alert(err.message || 'Failed to parse BIND zone.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {actionToast && (
        <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{actionToast}</span>
          </div>
          <button type="button" onClick={() => setActionToast(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search & Type Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search DNS records..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono w-44 sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  selectedTypeFilter === t
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportBind}
            title="Download RFC 1035 BIND Zone file (.txt)"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 hover:bg-slate-50 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export BIND</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBindImportOpen(true)}
            title="Migrate from Cloudflare, GoDaddy or Namecheap"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 hover:bg-slate-50 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
            <span>Import Zone</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal('A')}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* 1-Click Wizard Strip */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/50 via-indigo-50/50 to-slate-50 dark:from-zinc-900/80 dark:to-zinc-900/40 border border-slate-200/80 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>1-Click Production Zone Accelerators</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">RFC 1035 Strict</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handlePointToHosting}
            className="px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 text-xs font-semibold hover:border-blue-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>Point Apex (@) to Server ({serverIp})</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('google')}
            className="px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 text-xs font-semibold hover:border-blue-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-rose-500" />
            <span>Google Workspace MX</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('zoho')}
            className="px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 text-xs font-semibold hover:border-blue-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-amber-500" />
            <span>Zoho Mail MX</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('shield')}
            className="px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 text-xs font-semibold hover:border-emerald-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Email Shield (DMARC + CAA)</span>
          </button>
        </div>
      </div>

      {/* Cloudflare-Style DNS Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-zinc-950/60 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Content</th>
                <th className="py-3 px-4 font-semibold">Proxy Status</th>
                <th className="py-3 px-4 font-semibold">TTL</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No DNS records found matching criteria. Click &quot;Add Record&quot; to create one.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isProxyable = ['A', 'AAAA', 'CNAME'].includes(r.type);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block w-14 text-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.type === 'A'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : r.type === 'CNAME'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : r.type === 'MX'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : r.type === 'TXT'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {r.name}
                      </td>

                      {/* Content */}
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 max-w-md truncate">
                        {r.type === 'MX' && (
                          <span className="mr-2 text-slate-400">Prio {r.priority || 10}:</span>
                        )}
                        <span title={r.content}>{r.content}</span>
                      </td>

                      {/* Cloudflare Orange Cloud Proxy */}
                      <td className="py-3 px-4">
                        {isProxyable ? (
                          <button
                            type="button"
                            onClick={() => handleToggleProxy(r)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all"
                            style={{
                              borderColor: r.proxied ? '#f97316' : '#cbd5e1',
                              backgroundColor: r.proxied ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                              color: r.proxied ? '#f97316' : '#64748b',
                            }}
                            title={r.proxied ? 'Accelerated via DevHost Edge CDN' : 'DNS Only bypass'}
                          >
                            {r.proxied ? (
                              <>
                                <Cloud className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                                <span>Proxied</span>
                              </>
                            ) : (
                              <>
                                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                                <span>DNS Only</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* TTL */}
                      <td className="py-3 px-4 text-slate-500">
                        {r.ttl === 1 ? 'Auto' : `${r.ttl}s`}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(r.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit DNS Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>{editingRecordId ? 'Edit DNS Record' : 'Add New DNS Resource Record'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {validationError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500">Record Type:</label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value as any)}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="A">A (IPv4 Address)</option>
                    <option value="AAAA">AAAA (IPv6 Address)</option>
                    <option value="CNAME">CNAME (Alias to Host)</option>
                    <option value="MX">MX (Mail Exchange)</option>
                    <option value="TXT">TXT (SPF, DMARC, Verification)</option>
                    <option value="SRV">SRV (Service Locator)</option>
                    <option value="CAA">CAA (Cert Authority Authorization)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500">Name (Use @ for apex):</label>
                  <input
                    type="text"
                    value={recordName}
                    onChange={(e) => setRecordName(e.target.value)}
                    placeholder="@ or subdomain"
                    required
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500">
                  {recordType === 'A'
                    ? 'IPv4 Target Address (e.g. 103.151.102.45):'
                    : recordType === 'AAAA'
                    ? 'IPv6 Target Address:'
                    : recordType === 'CNAME'
                    ? 'Target Hostname (e.g. myapp.devhost.cloud):'
                    : recordType === 'MX'
                    ? 'Mail Server Hostname (e.g. mail.domain.com):'
                    : recordType === 'TXT'
                    ? 'TXT Verification String / SPF / DMARC:'
                    : recordType === 'CAA'
                    ? 'CAA Directive (e.g. 0 issue "letsencrypt.org"):'
                    : 'Record Content / Value:'}
                </label>
                <input
                  type="text"
                  value={recordContent}
                  onChange={(e) => setRecordContent(e.target.value)}
                  placeholder={
                    recordType === 'A'
                      ? '103.151.102.45'
                      : recordType === 'CNAME'
                      ? 'example.com'
                      : 'Content string'
                  }
                  required
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              {recordType === 'MX' && (
                <div>
                  <label className="text-[11px] text-slate-500">MX Priority (0 to 65535):</label>
                  <input
                    type="number"
                    min={0}
                    max={65535}
                    value={recordPriority ?? 10}
                    onChange={(e) => setRecordPriority(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[11px] text-slate-500">TTL (Time to Live):</label>
                  <select
                    value={recordTtl}
                    onChange={(e) => setRecordTtl(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value={1}>Auto (Recommended)</option>
                    <option value={120}>2 mins</option>
                    <option value={300}>5 mins (Fast Propagation)</option>
                    <option value={1800}>30 mins</option>
                    <option value={3600}>1 hr (Standard)</option>
                    <option value={14400}>4 hrs</option>
                    <option value={86400}>1 day</option>
                  </select>
                </div>

                {['A', 'AAAA', 'CNAME'].includes(recordType) && (
                  <div className="pt-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={recordProxied}
                        onChange={(e) => setRecordProxied(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
                      />
                      <Cloud className={`w-4 h-4 ${recordProxied ? 'text-orange-500' : 'text-slate-400'}`} />
                      <span className="text-xs text-slate-700 dark:text-zinc-300 font-semibold">
                        Edge Proxy (CDN &amp; DDoS)
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {editingRecordId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BIND Zone File Import Modal */}
      {isBindImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Import RFC 1035 BIND Zone File</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBindImportOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste the exported BIND zone text from Cloudflare, GoDaddy, or Namecheap to automatically migrate all DNS records in 1 click.
            </p>

            <textarea
              rows={8}
              value={bindImportText}
              onChange={(e) => setBindImportText(e.target.value)}
              placeholder={`$ORIGIN ${domainName}.\n$TTL 3600\n@   IN  A   103.151.102.45\nwww IN  CNAME @\nmail IN A   103.151.102.45\n@   IN  MX  10 mail.${domainName}.`}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsBindImportOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bindImportText.trim()}
                onClick={handleImportBind}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-md shadow-blue-600/20"
              >
                Parse &amp; Import Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
