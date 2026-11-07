'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Cpu,
  Layers,
  Copy,
  Check,
  Shield,
  Activity,
  DollarSign,
  Edit2,
  X,
  ExternalLink,
  Zap,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';
import AdminNodeBalancerCard from '@/components/admin/AdminNodeBalancerCard';

interface ServerNodeItem {
  id: string;
  node_code: string;
  node_name: string;
  datacenter_location: string;
  ipv4_address: string;
  whm_hostname: string;
  whm_username: string;
  primary_nameserver?: string;
  secondary_nameserver?: string;
  monthly_node_cost_bdt: number;
  max_cpanel_slots: number;
  used_cpanel_slots: number;
  max_disk_gb: number;
  allocated_disk_gb: number;
  actual_physical_disk_gb: number;
  auto_provision_enabled: boolean;
  is_healthy: boolean;
  status_message: string;
}

export default function AdminServerNodesView() {
  const { requireSudo } = useSudoGate();
  const [nodes, setNodes] = useState<ServerNodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Automated WHM Package Splitting & Zero-Touch Testing States
  const [isSyncingPackages, setIsSyncingPackages] = useState(false);
  const [syncPackagesStatus, setSyncPackagesStatus] = useState<string | null>(null);
  const [isTestingProvisioning, setIsTestingProvisioning] = useState(false);
  const [testProvisioningResult, setTestProvisioningResult] = useState<any | null>(null);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<Partial<ServerNodeItem> | null>(null);

  // Form State
  const [nodeCode, setNodeCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [datacenterLocation, setDatacenterLocation] = useState('Singapore (Equinix SG1)');
  const [ipv4Address, setIpv4Address] = useState('');
  const [whmHostname, setWhmHostname] = useState('');
  const [whmUsername, setWhmUsername] = useState('root');
  const [whmApiToken, setWhmApiToken] = useState('');
  const [monthlyCostBdt, setMonthlyCostBdt] = useState(3500);
  const [maxSlots, setMaxSlots] = useState(50);
  const [maxDiskGb, setMaxDiskGb] = useState(100);

  const fetchNodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/nodes-crm');
      const data = await res.json();
      if (data.success && data.nodes) {
        setNodes(data.nodes);
      }
    } catch (err) {
      console.warn('Failed to load server nodes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const triggerCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingNode(null);
    setNodeCode(`sg${nodes.length + 1}-nvme-0${nodes.length + 1}`);
    setNodeName('Singapore Enterprise NVMe Cluster');
    setDatacenterLocation('Singapore (Equinix SG1)');
    setIpv4Address('');
    setWhmHostname('');
    setWhmUsername('root');
    setWhmApiToken('');
    setMonthlyCostBdt(3500);
    setMaxSlots(50);
    setMaxDiskGb(100);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (node: ServerNodeItem) => {
    setEditingNode(node);
    setNodeCode(node.node_code);
    setNodeName(node.node_name);
    setDatacenterLocation(node.datacenter_location);
    setIpv4Address(node.ipv4_address);
    setWhmHostname(node.whm_hostname);
    setWhmUsername(node.whm_username);
    setWhmApiToken('');
    setMonthlyCostBdt(Number(node.monthly_node_cost_bdt) || 3500);
    setMaxSlots(node.max_cpanel_slots);
    setMaxDiskGb(Number(node.max_disk_gb) || 100);
    setIsModalOpen(true);
  };

  const handleSaveNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/nodes-crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_node',
            sudoVerified: true,
            nodeData: {
              nodeCode,
              nodeName,
              datacenterLocation,
              ipv4Address,
              whmHostname,
              whmUsername,
              whmApiToken,
              monthlyCostBdt,
              maxSlots,
              maxDiskGb,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsModalOpen(false);
        fetchNodes();
        alert(data.message || 'Server node saved successfully!');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Save WHM Cluster Node ${nodeCode}`);
  };

  const handleToggleProvision = async (node: ServerNodeItem) => {
    try {
      const res = await fetch('/api/admin/nodes-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_provision',
          nodeId: node.id,
          autoProvisionEnabled: !node.auto_provision_enabled,
          isHealthy: node.is_healthy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, auto_provision_enabled: !n.auto_provision_enabled } : n))
        );
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncPackages = async () => {
    setIsSyncingPackages(true);
    setSyncPackagesStatus(null);
    try {
      const res = await fetch('/api/whm/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_packages' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncPackagesStatus(`✓ Successfully synced ${data.packagesSynced || 3} hosting packages via WHM addpkg/editpkg! Exact CloudLinux RAM, CPU & Quotas configured.`);
      } else {
        setSyncPackagesStatus(`WHM Sync Notice: ${data.message || 'Packages registered'}`);
      }
    } catch (err: any) {
      setSyncPackagesStatus(`Sync Error: ${err.message}`);
    } finally {
      setIsSyncingPackages(false);
      setTimeout(() => setSyncPackagesStatus(null), 10000);
    }
  };

  const handleTestZeroTouchPipeline = async () => {
    setIsTestingProvisioning(true);
    setTestProvisioningResult(null);
    try {
      const res = await fetch('/api/whm/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_provisioning' }),
      });
      const data = await res.json();
      setTestProvisioningResult(data);
    } catch (err: any) {
      setTestProvisioningResult({
        success: false,
        message: err.message,
      });
    } finally {
      setIsTestingProvisioning(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <span>Multi-Node Server Cluster &amp; WHM Watchdog</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
              {nodes.length} Active Nodes
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Capacity management, physical NVMe storage distribution &amp; reseller cost economics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click Sync Packages Button */}
          <button
            type="button"
            disabled={isSyncingPackages}
            onClick={handleSyncPackages}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Automatically create/split packages on WHM server with addpkg/editpkg"
          >
            <Layers className={`w-3.5 h-3.5 ${isSyncingPackages ? 'animate-spin' : ''}`} />
            <span>{isSyncingPackages ? 'Syncing...' : '1-Click Sync WHM Packages (addpkg)'}</span>
          </button>

          {/* Zero-Touch Provisioning Test Button */}
          <button
            type="button"
            disabled={isTestingProvisioning}
            onClick={handleTestZeroTouchPipeline}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Execute test of full 5-step zero-touch provisioning pipeline"
          >
            <Zap className={`w-3.5 h-3.5 ${isTestingProvisioning ? 'animate-bounce text-amber-500' : 'text-emerald-600'}`} />
            <span>{isTestingProvisioning ? 'Testing...' : '⚡ Zero-Touch Pipeline Test'}</span>
          </button>

          <button
            type="button"
            onClick={fetchNodes}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
            title="Refresh Cluster State"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reseller Server Node</span>
          </button>
        </div>
      </div>

      {/* Package Sync Status Feedback */}
      {syncPackagesStatus && (
        <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{syncPackagesStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncPackagesStatus(null)}
            className="text-purple-500 hover:text-purple-700 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Zero-Touch Provisioning Diagnostic Modal / Card */}
      {testProvisioningResult && (
        <div className="p-5 rounded-2xl bg-zinc-950 border border-emerald-500/30 text-white shadow-xl space-y-3 font-mono text-xs animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <strong className="text-sm font-bold text-emerald-400">
                Zero-Touch Provisioning Pipeline Diagnostic
              </strong>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                {testProvisioningResult.diagnostic?.durationMs}ms Execution
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTestProvisioningResult(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 block text-[10px]">Domain:</span>
              <span className="font-bold text-white">{testProvisioningResult.diagnostic?.domain}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 block text-[10px]">cPanel User:</span>
              <span className="font-bold text-emerald-400">{testProvisioningResult.diagnostic?.cpanelUsername}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 block text-[10px]">Server Node:</span>
              <span className="font-bold text-blue-400">{testProvisioningResult.diagnostic?.serverNode} ({testProvisioningResult.diagnostic?.serverIp})</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <span className="text-slate-400 block text-[10px]">SSL Status:</span>
              <span className="font-bold text-purple-400">{testProvisioningResult.diagnostic?.sslStatus}</span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Autonomous Pipeline Steps Executed:
            </span>
            <div className="space-y-1">
              {testProvisioningResult.diagnostic?.stepsCompleted?.map((step: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Smart Multi-Node Bin-Packing Load Balancer Card */}
      <AdminNodeBalancerCard nodes={nodes} />

      {/* Cluster Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nodes.map((node) => {
          const slotPct = Math.min(100, Math.round((node.used_cpanel_slots / node.max_cpanel_slots) * 100));
          const diskPct = Math.min(100, Math.round((node.allocated_disk_gb / node.max_disk_gb) * 100));
          const estMonthlyRev = node.used_cpanel_slots * 420; // Average ARPU ~৳420
          const netNodeProfit = estMonthlyRev - Number(node.monthly_node_cost_bdt);

          return (
            <div
              key={node.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs"
            >
              {/* Node Title & Health */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-slate-900 dark:text-white">
                      {node.node_name}
                    </strong>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold">
                      {node.node_code}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {node.datacenter_location} • WHM: <span className="text-blue-500 font-bold">{node.whm_hostname}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    node.is_healthy
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                      : 'bg-rose-50 dark:bg-rose-950 text-rose-500'
                  }`}>
                    {node.is_healthy ? 'HEALTHY' : 'DEGRADED'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(node)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    title="Edit Node Settings"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* IP & Nameservers */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Dedicated IPv4:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200">
                    <span>{node.ipv4_address}</span>
                    <button
                      type="button"
                      onClick={() => triggerCopy(node.ipv4_address, `ip-${node.id}`)}
                      className="text-slate-400 hover:text-blue-600"
                    >
                      {copiedKey === `ip-${node.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Primary NS:</span>
                  <span className="text-slate-700 dark:text-zinc-300">{node.primary_nameserver || 'ns1.devhost.cloud'}</span>
                </div>
              </div>

              {/* Progress 1: cPanel Account Slots */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>cPanel Account Capacity:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {node.used_cpanel_slots} / {node.max_cpanel_slots} Slots ({slotPct}%)
                  </strong>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      slotPct > 85 ? 'bg-rose-500' : slotPct > 60 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${slotPct}%` }}
                  />
                </div>
              </div>

              {/* Progress 2: Storage Allocation */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Allocated Quota vs Physical NVMe:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {node.allocated_disk_gb} GB / {node.max_disk_gb} GB ({diskPct}%)
                  </strong>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${diskPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Physical NVMe Raw In-Use: {node.actual_physical_disk_gb} GB</span>
                  <span>{100 - diskPct}% Unallocated</span>
                </div>
              </div>

              {/* Node Financial Breakdown */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
                  <span className="text-[10px] text-slate-400">Monthly Lease</span>
                  <div className="font-bold text-rose-500">৳{Number(node.monthly_node_cost_bdt).toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
                  <span className="text-[10px] text-slate-400">Tenant Rev</span>
                  <div className="font-bold text-emerald-500">৳{estMonthlyRev.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
                  <span className="text-[10px] text-slate-400">Net Node Profit</span>
                  <div className={`font-bold ${netNodeProfit >= 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                    ৳{netNodeProfit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Auto-Provision Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 text-[11px]">Auto-Provision New Checkouts:</span>
                <button
                  type="button"
                  onClick={() => handleToggleProvision(node)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                    node.auto_provision_enabled
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'
                  }`}
                >
                  {node.auto_provision_enabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Node Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <strong className="text-base text-slate-900 dark:text-white font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                <span>{editingNode ? `Edit ${editingNode.node_code}` : 'Register New WHM Server Node'}</span>
              </strong>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNodeSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Node Unique Code:</label>
                  <input
                    type="text"
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value)}
                    placeholder="sg2-nvme-02"
                    disabled={!!editingNode}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Node Display Name:</label>
                  <input
                    type="text"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    placeholder="Singapore Enterprise Cluster"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Datacenter Location:</label>
                  <input
                    type="text"
                    value={datacenterLocation}
                    onChange={(e) => setDatacenterLocation(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">IPv4 Address:</label>
                  <input
                    type="text"
                    value={ipv4Address}
                    onChange={(e) => setIpv4Address(e.target.value)}
                    placeholder="103.151.102.45"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">WHM Hostname:</label>
                  <input
                    type="text"
                    value={whmHostname}
                    onChange={(e) => setWhmHostname(e.target.value)}
                    placeholder="sg1.devhost.cloud"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">WHM Username:</label>
                  <input
                    type="text"
                    value={whmUsername}
                    onChange={(e) => setWhmUsername(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">WHM API Token (Optional / Encrypted):</label>
                <input
                  type="password"
                  value={whmApiToken}
                  onChange={(e) => setWhmApiToken(e.target.value)}
                  placeholder="whm_api_token_..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Monthly Cost (৳):</label>
                  <input
                    type="number"
                    value={monthlyCostBdt}
                    onChange={(e) => setMonthlyCostBdt(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Max Slots:</label>
                  <input
                    type="number"
                    value={maxSlots}
                    onChange={(e) => setMaxSlots(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Max Disk (GB):</label>
                  <input
                    type="number"
                    value={maxDiskGb}
                    onChange={(e) => setMaxDiskGb(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Save Cluster Node (Sudo Verified)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
