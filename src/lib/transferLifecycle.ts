// ==============================================================================
// DEVHOST CLOUD - AUTHENTIC REGISTRAR DOMAIN TRANSFER LIFECYCLE & POLLING
// Synchronizes `domain_transfers` rows directly with Namecheap / ResellerClub /
// BTCL state machines and activates `public.domains` + Cloudflare zone on Step 5.
// ==============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getDomainTransferStatusWithRegistrar,
  isBdManualTld,
  transferDomainWithRegistrar,
} from '@/lib/registrarClient';
import { ensureCloudflareZone, isCloudflareConfigured } from '@/lib/cloudflareClient';
import { decryptEppCode } from '@/lib/dnsEngine';

export interface SerializedTransferRecord {
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

export function serializeTransferRow(row: Record<string, unknown>): SerializedTransferRecord {
  return {
    id: String(row.id || ''),
    domainName: String(row.domain_name || ''),
    tld: String(row.tld || '.com'),
    transferPriceBDT: Number(row.transfer_price_bdt || 0),
    currentStep: Number(row.current_step || 1),
    status: (String(row.status || 'pending_payment') as SerializedTransferRecord['status']),
    statusMessage: row.status_message ? String(row.status_message) : undefined,
    eppStatus: row.epp_status ? String(row.epp_status) : null,
    registrarProvider: row.registrar_provider ? String(row.registrar_provider) : null,
    registrarTransferId: row.registrar_transfer_id ? String(row.registrar_transfer_id) : null,
    lastPolledAt: row.last_polled_at ? String(row.last_polled_at) : null,
    initiatedAt: row.initiated_at
      ? String(row.initiated_at).replace('T', ' ').slice(0, 16)
      : new Date().toISOString().replace('T', ' ').slice(0, 16),
  };
}

export interface TransferPollSummary {
  checked: number;
  updated: number;
  completed: number;
  failed: number;
  transfers: SerializedTransferRecord[];
  errors: string[];
}

/**
 * Polls active inbound domain transfers against the wholesale registrar and
 * advances `domain_transfers` + promotes completed transfers to Active `domains`.
 */
export async function syncDomainTransferStatuses(
  db: SupabaseClient,
  options?: { userId?: string; transferId?: string; limit?: number }
): Promise<TransferPollSummary> {
  let query = db
    .from('domain_transfers')
    .select('*')
    .in('status', ['pending_payment', 'verifying_epp', 'awaiting_losing_registrar'])
    .order('initiated_at', { ascending: false });

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (options?.transferId) {
    query = query.eq('id', options.transferId);
  }
  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data: rows, error } = await query;
  if (error || !Array.isArray(rows)) {
    return {
      checked: 0,
      updated: 0,
      completed: 0,
      failed: 0,
      transfers: [],
      errors: error ? [error.message] : [],
    };
  }

  const summary: TransferPollSummary = {
    checked: 0,
    updated: 0,
    completed: 0,
    failed: 0,
    transfers: [],
    errors: [],
  };

  for (const rawRow of rows as Array<Record<string, unknown>>) {
    const id = String(rawRow.id || '');
    const domain = String(rawRow.domain_name || '').trim().toLowerCase();
    const rowStatus = String(rawRow.status || 'pending_payment');
    const registrarTransferId = rawRow.registrar_transfer_id
      ? String(rawRow.registrar_transfer_id)
      : '';
    const invoiceId = rawRow.invoice_id ? String(rawRow.invoice_id) : '';
    const nowIso = new Date().toISOString();

    if (!domain) continue;
    summary.checked += 1;

    // 1. If transfer is still `pending_payment` without a registrar ID, check whether its invoice is paid now
    if (rowStatus === 'pending_payment' && !registrarTransferId) {
      if (!invoiceId) {
        summary.transfers.push(serializeTransferRow(rawRow));
        continue;
      }

      const { data: inv } = await db
        .from('invoices')
        .select('id, status')
        .eq('id', invoiceId)
        .maybeSingle();

      if (!inv || inv.status !== 'paid') {
        summary.transfers.push(serializeTransferRow(rawRow));
        continue;
      }

      const encEpp = String(rawRow.epp_code_encrypted || '');
      const plainEpp = encEpp ? await decryptEppCode(encEpp) : '';
      if (!plainEpp || plainEpp === 'PENDING-EPP') {
        summary.transfers.push(serializeTransferRow(rawRow));
        continue;
      }

      const subRes = await transferDomainWithRegistrar({ domain, eppCode: plainEpp });
      if (subRes.ok) {
        const nextStep = subRes.mode === 'manual_btcl_queue' ? 1 : 2;
        const nextStatus = subRes.mode === 'manual_btcl_queue' ? 'pending_payment' : 'verifying_epp';
        const patch = {
          current_step: nextStep,
          status: nextStatus,
          registrar_transfer_id: subRes.orderId || null,
          registrar_provider: subRes.provider,
          epp_status: subRes.mode,
          status_message: subRes.message,
          last_polled_at: nowIso,
          updated_at: nowIso,
        };
        await db.from('domain_transfers').update(patch).eq('id', id);
        summary.updated += 1;
        summary.transfers.push(serializeTransferRow({ ...rawRow, ...patch }));
      } else {
        summary.errors.push(`${domain}: ${subRes.error || subRes.message}`);
        summary.transfers.push(serializeTransferRow(rawRow));
      }
      continue;
    }

    // 2. Skip polling if there is still no external registrar reference
    if (!registrarTransferId) {
      summary.transfers.push(serializeTransferRow(rawRow));
      continue;
    }

    // 3. Poll real wholesale registrar transfer status
    const statusRes = await getDomainTransferStatusWithRegistrar({
      domain,
      registrarTransferId,
    });

    if (!statusRes.ok || !statusRes.data) {
      await db
        .from('domain_transfers')
        .update({ last_polled_at: nowIso, updated_at: nowIso })
        .eq('id', id);
      summary.errors.push(`${domain}: ${statusRes.error || statusRes.message}`);
      summary.transfers.push(serializeTransferRow({ ...rawRow, last_polled_at: nowIso }));
      continue;
    }

    const next = statusRes.data;
    const patch: Record<string, unknown> = {
      current_step: next.currentStep,
      status: next.status,
      epp_status: next.eppStatus,
      status_message: next.statusMessage,
      registrar_provider: statusRes.provider,
      last_polled_at: nowIso,
      updated_at: nowIso,
      completed_at: next.completed ? nowIso : null,
    };

    await db.from('domain_transfers').update(patch).eq('id', id);
    summary.updated += 1;
    if (next.status === 'rejected_invalid_epp' || next.status === 'locked_at_source') {
      summary.failed += 1;
    }

    // 4. Promote completed transfer (Step 5) to active `domains` + ensure Cloudflare Zone
    if (next.completed) {
      summary.completed += 1;
      const tld = String(rawRow.tld || (domain.includes('.') ? `.${domain.split('.').slice(1).join('.')}` : '.com'));
      const ownerId = rawRow.user_id ? String(rawRow.user_id) : null;

      let cfZoneId: string | null = null;
      let cfZoneStatus = 'pending';
      let cfNameservers: string[] = [];

      if (isCloudflareConfigured()) {
        const zone = await ensureCloudflareZone(domain);
        if (zone.ok && zone.zoneId) {
          cfZoneId = zone.zoneId;
          cfZoneStatus = zone.status || 'pending';
          cfNameservers = zone.nameServers || [];
        }
      }

      const { data: existingDom } = await db
        .from('domains')
        .select('id, expiry_date')
        .eq('domain_name', domain)
        .maybeSingle();

      const baseMs = existingDom?.expiry_date
        ? Math.max(Date.now(), new Date(String(existingDom.expiry_date)).getTime())
        : Date.now();
      const newExpiryDate = new Date(baseMs + 365 * 86400000).toISOString().split('T')[0];

      await db.from('domains').upsert(
        {
          user_id: ownerId,
          domain_name: domain,
          tld,
          status: isBdManualTld(domain) ? 'Pending' : 'Active',
          registrar_lock: true,
          whois_privacy: true,
          auto_renew: true,
          nameservers: cfNameservers.length >= 2 ? cfNameservers : ['ns1.devhost.net', 'ns2.devhost.net'],
          registrar_provider: statusRes.provider,
          registrar_order_id: registrarTransferId,
          cloudflare_zone_id: cfZoneId,
          cloudflare_zone_status: cfZoneStatus,
          cloudflare_nameservers: cfNameservers,
          expiry_date: newExpiryDate,
          updated_at: nowIso,
        },
        { onConflict: 'domain_name' }
      );
    }

    summary.transfers.push(serializeTransferRow({ ...rawRow, ...patch }));
  }

  return summary;
}
