'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Edit2,
  Wallet,
  Shield,
  Server,
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'client' | 'admin';
  wallet_balance_bdt: number;
  created_at: string;
  servicesCount?: number;
  services?: any[];
}

interface ServerNodeItem {
  id: string;
  node_code: string;
  node_name: string;
  datacenter_location: string;
}

export default function AdminCustomerCrmView() {
  const { requireSudo } = useSudoGate();
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [nodes, setNodes] = useState<ServerNodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Quota Override Modal State
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [diskLimit, setDiskLimit] = useState(10);
  const [ramLimit, setRamLimit] = useState(2048);
  const [inodeLimit, setInodeLimit] = useState(250000);
  const [targetNode, setTargetNode] = useState('sg1-nvme-01');
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  // Wallet Adjustment Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [walletAmount, setWalletAmount] = useState<number>(500);
  const [walletReason, setWalletReason] = useState('Promotional credit from Admin Founder');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/nodes-crm');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
        setNodes(data.nodes || []);
      }
    } catch (err) {
      console.warn('Failed to load CRM data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenQuota = (service: any) => {
    setSelectedService(service);
    setDiskLimit(Number(service.disk_limit_gb) || 10);
    setRamLimit(Number(service.ram_limit_mb) || 2048);
    setInodeLimit(Number(service.inode_limit) || 250000);
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuotaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/nodes-crm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'override_quota',
            serviceId: selectedService.id,
            diskLimitGb: diskLimit,
            ramLimitMb: ramLimit,
            inodeLimit: inodeLimit,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsQuotaModalOpen(false);
        fetchData();
        alert(data.message || 'Quotas updated!');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Override Quota for ${selectedService.domain}`);
  };

  const handleMigrateNodeSubmit = () => {
    if (!selectedService) return;
    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/nodes-crm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'migrate_node',
            serviceId: selectedService.id,
            targetNodeCode: targetNode,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsQuotaModalOpen(false);
        fetchData();
        alert(`Service migrated to node ${targetNode}!`);
      } catch (err: any) {
        alert(err.message);
      }
    }, `Migrate ${selectedService.domain} to ${targetNode}`);
  };

  const handleOpenWallet = (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setWalletAmount(500);
    setIsWalletModalOpen(true);
  };

  const handleSaveWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/nodes-crm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'adjust_wallet',
            userId: selectedCustomer.id,
            amountBdt: walletAmount,
            reason: walletReason,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsWalletModalOpen(false);
        fetchData();
        alert(data.message || 'Wallet adjusted successfully!');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Adjust Wallet Balance for ${selectedCustomer.full_name}`);
  };

  const handleToggleRole = (customer: CustomerProfile) => {
    const newRole = customer.role === 'admin' ? 'client' : 'admin';
    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/nodes-crm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'toggle_role',
            userId: customer.id,
            newRole,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        fetchData();
        alert(`Role updated to ${newRole}!`);
      } catch (err: any) {
        alert(err.message);
      }
    }, `Change User Role to ${newRole}`);
  };

  const handleImpersonate = (customer: CustomerProfile) => {
    requireSudo(() => {
      sessionStorage.setItem('devhost_impersonate', JSON.stringify({
        id: customer.id,
        name: customer.full_name,
        email: customer.email,
        returnUrl: '/admin',
      }));
      window.location.href = '/dashboard';
    }, `Impersonate Client ${customer.full_name}`);
  };

  const filteredCustomers = customers.filter((c) => {
    return (
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Customer 360° CRM &amp; God-Mode Quota Overrides</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
              {customers.length} Accounts
            </span>
          </h2>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Resource limits customization, cross-node migration, wallet balance adjustments &amp; client impersonation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 cursor-pointer"
            title="Refresh CRM"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer name, email, or phone..."
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
        />
      </div>

      {/* Customer Master List */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No customers found matching search.</div>
        ) : (
          filteredCustomers.map((cust) => (
            <div key={cust.id} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-slate-900 dark:text-white">
                      {cust.full_name}
                    </strong>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cust.role === 'admin'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      {cust.role.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {cust.email} {cust.phone && `• ${cust.phone}`} • Joined: {new Date(cust.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 text-right mr-2">
                    <span className="text-[10px] text-slate-400 block">Wallet Balance</span>
                    <strong className="text-emerald-600 font-bold">৳{Number(cust.wallet_balance_bdt || 0).toLocaleString()}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenWallet(cust)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-100 text-[11px] font-semibold cursor-pointer"
                  >
                    Adjust ৳
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleRole(cust)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                  >
                    {cust.role === 'admin' ? 'Demote' : 'Make Admin'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleImpersonate(cust)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                  >
                    Impersonate ↗
                  </button>
                </div>
              </div>

              {/* Customer Hosting Services & Quotas */}
              {cust.services && cust.services.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Active Hosting Services ({cust.services.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cust.services.map((srv) => (
                      <div
                        key={srv.id}
                        className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <strong className="text-slate-900 dark:text-white font-bold">{srv.domain}</strong>
                          <div className="text-[10px] text-slate-400">
                            {srv.package_name} • {srv.disk_limit_gb}GB Disk • {srv.ram_limit_mb}MB RAM • {srv.inode_limit} Inodes
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenQuota(srv)}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold cursor-pointer hover:bg-blue-100"
                        >
                          Override Quotas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quota Override & Cross-Node Migration Modal */}
      {isQuotaModalOpen && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <strong className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Override Quotas: {selectedService.domain}</span>
              </strong>
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuotaSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-bold">NVMe Disk Limit (GB):</label>
                <input
                  type="number"
                  value={diskLimit}
                  onChange={(e) => setDiskLimit(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">CloudLinux RAM (MB):</label>
                  <input
                    type="number"
                    value={ramLimit}
                    onChange={(e) => setRamLimit(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-bold">Max Inodes Limit:</label>
                  <input
                    type="number"
                    value={inodeLimit}
                    onChange={(e) => setInodeLimit(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                <label className="text-[11px] text-slate-500 font-bold">Migrate Tenant to Another Cluster Node:</label>
                <div className="flex gap-2">
                  <select
                    value={targetNode}
                    onChange={(e) => setTargetNode(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.node_code}>
                        {n.node_code} ({n.datacenter_location})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleMigrateNodeSubmit}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
                  >
                    Migrate Node
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-md"
                >
                  Save Quotas (Sudo Verified)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Customer Wallet Balance Modal */}
      {isWalletModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <strong className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Adjust Wallet: {selectedCustomer.full_name}</span>
              </strong>
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWalletSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-bold">Adjustment Amount (BDT):</label>
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(Number(e.target.value))}
                  placeholder="+500 or -200"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 font-bold text-emerald-600 text-sm"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Use positive numbers to add balance, negative numbers to deduct.</span>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Administrative Reason / Ledger Note:</label>
                <textarea
                  rows={2}
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-md"
                >
                  Adjust Balance (Sudo Verified)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
