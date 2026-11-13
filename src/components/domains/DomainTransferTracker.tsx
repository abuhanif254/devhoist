'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export interface TransferRecord {
  id: string;
  domainName: string;
  tld: string;
  transferPriceBDT: number;
  currentStep: number;
  status:
    | 'pending_payment'
    | 'verifying_epp'
    | 'awaiting_losing_registrar'
    | 'completed'
    | 'rejected_invalid_epp'
    | 'locked_at_source';
  statusMessage?: string;
  eppStatus?: string | null;
  registrarProvider?: string | null;
  registrarTransferId?: string | null;
  lastPolledAt?: string | null;
  initiatedAt: string;
}

interface DomainTransferTrackerProps {
  transfers?: TransferRecord[];
  onRefresh?: () => Promise<void> | void;
  onPollTransfers?: () => Promise<void> | void;
  onResubmitEpp?: (
    transferId: string,
    eppCode: string
  ) => Promise<{ ok: boolean; error?: string; message?: string; currentStep?: number; status?: string }>;
}

const TRANSFER_STEPS = [
  { step: 1, title: 'Transfer Ordered', desc: 'Order placed & invoice verified' },
  { step: 2, title: 'EPP Validation', desc: 'AES-GCM Auth code verified' },
  { step: 3, title: 'Registrar Handshake', desc: 'Awaiting losing registrar FOA release' },
  { step: 4, title: 'Registry Migration', desc: 'Root zone nameservers switching' },
  { step: 5, title: 'Transfer Completed', desc: 'Active on DevHost with +1 yr renewal' },
];

export default function DomainTransferTracker({
  transfers = [],
  onRefresh,
  onPollTransfers,
  onResubmitEpp,
}: DomainTransferTrackerProps) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<TransferRecord>>>({});
  const [polledList, setPolledList] = useState<TransferRecord[] | null>(null);
  const [eppInputs, setEppInputs] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const sourceList = polledList && transfers.length === 0 ? polledList : transfers;
  const activeTransfers = sourceList.map((t) =>
    localOverrides[t.id] ? { ...t, ...localOverrides[t.id] } : t
  );

  const handlePollRefresh = async () => {
    setIsPolling(true);
    setFeedback(null);
    try {
      if (onPollTransfers) {
        await onPollTransfers();
      } else if (onRefresh) {
        await onRefresh();
      } else {
        const res = await fetch('/api/domains/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll_transfers' }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          transfers?: TransferRecord[];
          checked?: number;
          updated?: number;
          error?: string;
        };
        if (!res.ok || !json.success) {
          setFeedback({ type: 'error', message: json.error || 'Failed to poll registrar transfer status.' });
        } else if (Array.isArray(json.transfers)) {
          setPolledList(json.transfers);
          setFeedback({
            type: 'success',
            message: `Synced ${json.checked ?? json.transfers.length} transfer(s) with upstream registrar.`,
          });
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error while syncing transfer status.' });
    } finally {
      setIsPolling(false);
    }
  };

  const handleUpdateEppCode = async (transferId: string) => {
    const code = (eppInputs[transferId] || '').trim();
    if (!code) return;
    setUpdatingId(transferId);
    setFeedback(null);
    try {
      let json: {
        success?: boolean;
        ok?: boolean;
        message?: string;
        error?: string;
        currentStep?: number;
        status?: TransferRecord['status'];
        registrarTransferId?: string | null;
      };

      if (onResubmitEpp) {
        const result = await onResubmitEpp(transferId, code);
        json = {
          success: result.ok,
          message: result.message,
          error: result.error,
          currentStep: result.currentStep,
          status: result.status as TransferRecord['status'] | undefined,
        };
      } else {
        const res = await fetch('/api/domains/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resubmit_transfer_epp',
            transferId,
            eppCode: code,
          }),
        });
        json = (await res.json().catch(() => ({}))) as typeof json;
        if (!res.ok) json.success = false;
      }

      if (!json.success) {
        setFeedback({
          type: 'error',
          message: json.error || 'Registrar rejected resubmitted EPP code.',
        });
        return;
      }

      setLocalOverrides((prev) => ({
        ...prev,
        [transferId]: {
          currentStep: json.currentStep ?? 2,
          status: json.status ?? 'verifying_epp',
          statusMessage:
            json.message || 'Updated EPP code accepted. Re-submitted to upstream registrar.',
          registrarTransferId: json.registrarTransferId ?? prev[transferId]?.registrarTransferId,
        },
      }));
      setEppInputs((prev) => ({ ...prev, [transferId]: '' }));
      setFeedback({
        type: 'success',
        message: json.message || 'EPP code re-submitted to registrar successfully.',
      });
      await onRefresh?.();
    } catch {
      setFeedback({ type: 'error', message: 'Network error re-submitting EPP code.' });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-600" />
            <span>Inbound Domain Transfer Progress (5-Step State Machine)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time ICANN registrar handshakes, losing registrar releases, and automated DNS preservation.
          </p>
        </div>
        <button
          type="button"
          disabled={isPolling}
          onClick={handlePollRefresh}
          title="Poll upstream registrar for live transfer updates"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
          <span>{isPolling ? 'Syncing...' : 'Sync Registrar'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-mono border ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {activeTransfers.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] text-center text-xs font-mono text-slate-400">
          No inbound domain transfers recorded yet. Click &ldquo;Transfer In Existing Domain&rdquo; above to migrate a domain to DevHost.
        </div>
      ) : (
        <div className="space-y-4">
          {activeTransfers.map((item) => {
            const isDone = item.currentStep === 5 || item.status === 'completed';
            const isFailed = item.status === 'rejected_invalid_epp' || item.status === 'locked_at_source';
            const currentInput = eppInputs[item.id] || '';

          return (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.domainName}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : isFailed
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-600'
                        : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isDone
                      ? 'Completed & Active'
                      : isFailed
                      ? 'Action Required'
                      : `In Progress (Step ${item.currentStep}/5)`}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">
                  Fee: ৳{item.transferPriceBDT.toLocaleString()} BDT • Started: {item.initiatedAt}
                </div>
              </div>

              {/* Status Message */}
              {item.statusMessage && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/60 dark:border-white/5 flex items-start gap-2 text-slate-600 dark:text-zinc-300">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{item.statusMessage}</span>
                </div>
              )}

              {/* 5-Step Horizontal Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                {TRANSFER_STEPS.map((s) => {
                  const stepFinished = item.currentStep >= s.step;
                  const isCurrent = item.currentStep === s.step;

                  return (
                    <div
                      key={s.step}
                      className={`p-2.5 rounded-xl border text-center space-y-1 transition-all ${
                        isCurrent
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                          : stepFinished
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-50 dark:bg-zinc-950/20 border-slate-200 dark:border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 font-bold">
                        {stepFinished ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-zinc-800 text-[10px] flex items-center justify-center text-slate-600">
                            {s.step}
                          </span>
                        )}
                        <span
                          className={
                            isCurrent
                              ? 'text-blue-700 dark:text-blue-300'
                              : stepFinished
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-500'
                          }
                        >
                          {s.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">{s.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Action Needed box if rejected */}
              {isFailed && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Losing Registrar Rejected Transfer Code</span>
                  </div>
                  <p className="text-slate-600 dark:text-zinc-400">
                    Your previous registrar reported that the domain is locked or the EPP code expired. Please log into your old registrar, unlock the domain, generate a fresh EPP code, and update it below:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentInput}
                      onChange={(e) =>
                        setEppInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Enter new EPP code from losing registrar"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={updatingId === item.id || !currentInput.trim()}
                      onClick={() => handleUpdateEppCode(item.id)}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
                    >
                      {updatingId === item.id ? 'Re-submitting...' : 'Update & Retry'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
