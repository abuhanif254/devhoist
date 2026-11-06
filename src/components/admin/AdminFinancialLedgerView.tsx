'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';

interface LedgerItem {
  id: string;
  entry_code: string;
  entry_type: string;
  invoice_id?: string;
  user_id?: string;
  gateway: string;
  trx_id?: string;
  gross_amount_bdt: number;
  base_cogs_cost_bdt: number;
  affiliate_commission_bdt: number;
  promo_discount_bdt: number;
  owner_net_profit_bdt: number;
  notes?: string;
  created_at: string;
}

interface LedgerMetrics {
  totalGrossCollected: number;
  totalServerBuyCost: number;
  totalAffiliateAllocated: number;
  netOwnerProfit: number;
  profitMarginPercent: string;
}

export default function AdminFinancialLedgerView() {
  const { requireSudo } = useSudoGate();
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [metrics, setMetrics] = useState<LedgerMetrics>({
    totalGrossCollected: 0,
    totalServerBuyCost: 0,
    totalAffiliateAllocated: 0,
    netOwnerProfit: 0,
    profitMarginPercent: '0.0',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [refundAmount, setRefundAmount] = useState<number>(450);
  const [refundReason, setRefundReason] = useState('Customer request within 30-day money-back guarantee');

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/ledger');
      const data = await res.json();
      if (data.success) {
        setLedger(data.ledger || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.warn('Failed to fetch ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleOpenRefund = (invoiceId: string, amount: number) => {
    setSelectedInvoiceId(invoiceId);
    setRefundAmount(amount);
    setIsRefundModalOpen(true);
  };

  const handleExecuteRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !refundAmount) return;

    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process_refund',
            invoiceId: selectedInvoiceId,
            refundAmountBdt: refundAmount,
            reason: refundReason,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsRefundModalOpen(false);
        fetchLedger();
        alert(data.message || 'Refund executed and affiliate commission clawed back.');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Execute Refund for Invoice ${selectedInvoiceId}`);
  };

  const handleExportCsv = () => {
    if (!ledger.length) return;
    const headers = [
      'Entry Code',
      'Date',
      'Type',
      'Gateway',
      'TrxID',
      'Gross Amount (BDT)',
      'COGS Buy Cost (BDT)',
      'Affiliate Cut (BDT)',
      'Net Profit (BDT)',
      'Notes',
    ];

    const rows = ledger.map((row) => [
      row.entry_code,
      new Date(row.created_at).toLocaleDateString(),
      row.entry_type,
      row.gateway,
      row.trx_id || 'N/A',
      row.gross_amount_bdt,
      row.base_cogs_cost_bdt,
      row.affiliate_commission_bdt,
      row.owner_net_profit_bdt,
      `"${(row.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DevHost_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLedger = ledger.filter((row) => {
    const matchesSearch =
      row.entry_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.trx_id && row.trx_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (row.notes && row.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || row.entry_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 4-Pillar Executive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Pillar 1: Gross Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>1. Gross Collections</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ৳{metrics.totalGrossCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Total bKash, Nagad &amp; Card sales</div>
        </div>

        {/* Pillar 2: COGS Recovered */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>2. COGS Buy Cost (কেনা দাম)</span>
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            ৳{metrics.totalServerBuyCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Server slot &amp; registrar base expense</div>
        </div>

        {/* Pillar 3: Affiliate Pool */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>3. Affiliate Commission</span>
            <ArrowUpRight className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            ৳{metrics.totalAffiliateAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Marketer earnings pool</div>
        </div>

        {/* Pillar 4: Owner Net Profit */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-emerald-500/20 shadow-xs space-y-2 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <span>4. Owner Net Profit (আপনার নিট লাভ)</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ৳{metrics.netOwnerProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600/80 font-bold">
            Locked Margin: {metrics.profitMarginPercent}%
          </div>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Immutable Double-Entry Financial Profit Ledger</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                {ledger.length} Entries
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Unit economics breakdown mathematically enforced by PostgreSQL generated columns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLedger}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 cursor-pointer"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by entry code, trxID, or notes..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
          >
            <option value="all">All Transaction Types</option>
            <option value="hosting_sale">Hosting Sales</option>
            <option value="domain_registration">Domain Registrations</option>
            <option value="customer_refund">Customer Refunds</option>
            <option value="server_infrastructure_expense">Server Node Leases</option>
          </select>
        </div>

        {/* Ledger Master Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/5">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-zinc-950/70 text-slate-500 border-b border-slate-200 dark:border-white/5 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Entry Code</th>
                <th className="py-2.5 px-3">Type / Gateway</th>
                <th className="py-2.5 px-3">Gross (৳)</th>
                <th className="py-2.5 px-3">COGS Buy (৳)</th>
                <th className="py-2.5 px-3">Affiliate (৳)</th>
                <th className="py-2.5 px-3 text-right">Owner Profit (৳)</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No transactions match the search filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => {
                  const gross = Number(row.gross_amount_bdt) || 0;
                  const cogs = Number(row.base_cogs_cost_bdt) || 0;
                  const aff = Number(row.affiliate_commission_bdt) || 0;
                  const profit = Number(row.owner_net_profit_bdt) || 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/30">
                      <td className="py-2.5 px-3">
                        <strong className="text-slate-900 dark:text-white font-bold">{row.entry_code}</strong>
                        <div className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold uppercase">
                          {row.entry_type.replace('_', ' ')}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{row.gateway} • {row.trx_id || 'System'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {gross >= 0 ? `৳${gross.toLocaleString()}` : `-৳${Math.abs(gross).toLocaleString()}`}
                      </td>
                      <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">
                        ৳{cogs.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">
                        ৳{aff.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          {profit >= 0 ? `৳${profit.toLocaleString()}` : `-৳${Math.abs(profit).toLocaleString()}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {row.entry_type === 'hosting_sale' && gross > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenRefund(row.invoice_id || row.id, gross)}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-rose-50 hover:text-rose-600 text-slate-600 dark:text-zinc-300 text-[10px] font-semibold cursor-pointer"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sudo-Guarded Refund Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in font-mono text-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <strong className="text-sm font-bold text-rose-600 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>Issue Customer Refund &amp; Clawback Commission</span>
              </strong>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRefundSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-bold">Invoice / Transaction Reference:</label>
                <input
                  type="text"
                  readOnly
                  value={selectedInvoiceId}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Refund Amount (BDT):</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 font-bold text-rose-600"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Reason for Refund:</label>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] space-y-1">
                <strong>Clawback Protection:</strong>
                <div>
                  Executing this refund will automatically reverse any affiliate commission allocated to referring marketers, reducing their pending payout balance.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shadow-md"
                >
                  Execute Refund (Sudo Verified)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
