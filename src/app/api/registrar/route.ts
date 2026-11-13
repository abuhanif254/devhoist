import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, requireDomainAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { verifyPaidDomainEntitlement } from '@/lib/billingEntitlements';
import { validateDnsRecord } from '@/lib/dnsEngine';
import type { DnsRecord } from '@/context/PortalContext';
import { sendTelegramAlert } from '@/lib/adminNotifier';
import {
  addRegistrarChildNameserver,
  getRegistrarConfig,
  isBdManualTld,
  registerDomainWithRegistrar,
  renewDomainWithRegistrar,
  setRegistrarNameservers,
  transferDomainWithRegistrar,
} from '@/lib/registrarClient';
import {
  ensureCloudflareZone,
  getCloudflareZoneByName,
  isCloudflareConfigured,
  upsertCloudflareDnsRecord,
} from '@/lib/cloudflareClient';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const rawDomain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';

    if (!action || !rawDomain) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'action and domain are required' },
        { status: 400 }
      );
    }

    let ownerUserId: string;
    let actorRole = 'client';
    if (action === 'register') {
      const auth = await requireUser(request);
      if (!auth.ok) return auth.response;
      ownerUserId = auth.user.id;
      actorRole = auth.role;
    } else {
      const access = await requireDomainAccess(request, { domainName: rawDomain });
      if (!access.ok) return access.response;
      ownerUserId = access.user.id;
      actorRole = access.role || (access.isAdmin ? 'admin' : 'client');
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Domain Registrar Gateway');
    }

    const invoiceNumber =
      typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : null;

    // 1. UPDATE NAMESERVERS
    if (action === 'update_nameservers') {
      const nameservers = Array.isArray(body.nameservers)
        ? body.nameservers.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        : [];
      if (nameservers.length < 2) {
        return NextResponse.json(
          { error: 'Invalid nameservers', message: 'At least 2 nameservers are required' },
          { status: 400 }
        );
      }

      const regRes = await setRegistrarNameservers(rawDomain, nameservers);
      if (!regRes.ok) {
        return NextResponse.json(
          { error: regRes.error || 'Registrar nameserver update failed', message: regRes.message },
          { status: regRes.statusCode || 502 }
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        await supabase
          .from('domains')
          .update({
            nameservers,
            registrar_provider: regRes.provider,
            updated_at: new Date().toISOString(),
          })
          .eq('domain_name', rawDomain);
      }

      return NextResponse.json({
        success: true,
        message: regRes.message,
        domain: rawDomain,
        nameservers,
        provider: regRes.provider,
        mode: regRes.mode,
        propagationEstimatedMinutes: regRes.mode === 'manual_btcl_queue' ? 1440 : 15,
      });
    }

    // 2. UPDATE CHILD NAMESERVERS (GLUE RECORDS)
    if (action === 'update_child_nameservers') {
      const childNameservers = Array.isArray(body.childNameservers) ? body.childNameservers : null;
      if (!childNameservers || childNameservers.length === 0) {
        return NextResponse.json(
          { error: 'Invalid child nameservers', message: 'Expected non-empty array of glue records' },
          { status: 400 }
        );
      }

      const syncedResults: Array<{ host: string; ip: string; provider: string; mode: string }> = [];
      for (const entry of childNameservers) {
        const rec = entry as Record<string, unknown>;
        const host = String(rec.host || rec.hostname || '').trim().toLowerCase();
        const ip = String(rec.ip || rec.ipv4 || rec.ipv4_address || '').trim();
        if (!host || !ip) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Each child nameserver requires host and ip.' },
            { status: 400 }
          );
        }
        const glueRes = await addRegistrarChildNameserver(rawDomain, host, ip);
        if (!glueRes.ok) {
          return NextResponse.json(
            { error: glueRes.error || 'Child NS glue registration failed', message: glueRes.message },
            { status: glueRes.statusCode || 502 }
          );
        }
        syncedResults.push({ host, ip, provider: glueRes.provider, mode: glueRes.mode });
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        await supabase
          .from('domains')
          .update({
            child_nameservers: childNameservers,
            updated_at: new Date().toISOString(),
          })
          .eq('domain_name', rawDomain);
      }

      return NextResponse.json({
        success: true,
        message: `Child nameservers (glue records) synchronized for ${rawDomain}.`,
        domain: rawDomain,
        childNameservers: syncedResults,
      });
    }

    // 3. SYNC DNS ZONE RECORDS (Cloudflare Anycast DNS integration)
    if (action === 'sync_dns') {
      const dnsRecords = Array.isArray(body.dnsRecords) ? body.dnsRecords : null;
      if (!dnsRecords) {
        return NextResponse.json(
          { error: 'Invalid DNS records', message: 'Expected array of DNS records' },
          { status: 400 }
        );
      }

      if (!isCloudflareConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Cloudflare Anycast DNS Edge');
      }

      let zoneId: string | undefined;
      let zoneStatus: string | undefined;
      let cfNameservers: string[] | undefined;

      if (isCloudflareConfigured()) {
        const zone = await ensureCloudflareZone(rawDomain);
        if (!zone.ok || !zone.zoneId) {
          return NextResponse.json(
            { error: 'Cloudflare Zone Error', message: zone.error || 'Failed to resolve Cloudflare zone' },
            { status: 502 }
          );
        }
        zoneId = zone.zoneId;
        zoneStatus = zone.status;
        cfNameservers = zone.nameServers;

        for (const item of dnsRecords) {
          const rec = item as Record<string, unknown>;
          const type = String(rec.type || '').toUpperCase();
          const name = String(rec.name || '@');
          const content = String(rec.value || rec.content || '');
          const ttl = Number(rec.ttl || 3600);
          const priority = rec.priority !== undefined && rec.priority !== null ? Number(rec.priority) : undefined;

          const v = validateDnsRecord({
            type: type as DnsRecord['type'],
            name,
            content,
            ttl,
            priority,
          });
          if (!v.valid) {
            return NextResponse.json(
              { error: 'Invalid DNS Record', message: v.error || `Invalid record ${type} ${name}` },
              { status: 400 }
            );
          }

          const cfSync = await upsertCloudflareDnsRecord(
            zoneId,
            {
              type,
              name,
              content,
              ttl,
              priority,
              proxied: Boolean(rec.proxied),
            },
            { apexDomain: rawDomain }
          );
          if (!cfSync.ok) {
            return NextResponse.json(
              { error: 'Cloudflare Sync Failed', message: cfSync.error || `Failed syncing ${type} ${name}` },
              { status: 502 }
            );
          }
        }
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const updatePayload: Record<string, unknown> = {
          dns_records: dnsRecords,
          updated_at: new Date().toISOString(),
        };
        if (zoneId) updatePayload.cloudflare_zone_id = zoneId;
        if (zoneStatus) updatePayload.cloudflare_zone_status = zoneStatus;
        if (cfNameservers && cfNameservers.length > 0) {
          updatePayload.cloudflare_nameservers = cfNameservers;
        }
        await supabase.from('domains').update(updatePayload).eq('domain_name', rawDomain);
      }

      return NextResponse.json({
        success: true,
        message: isCloudflareConfigured()
          ? `Synced ${dnsRecords.length} record(s) to live Cloudflare Anycast zone (${zoneId}).`
          : `Synced ${dnsRecords.length} record(s) in DEV_SANDBOX_MODE.`,
        domain: rawDomain,
        cloudflareZoneId: zoneId,
        cloudflareZoneStatus: zoneStatus,
        recordCount: dnsRecords.length,
      });
    }

    // 4. REGISTER DOMAIN (Live ResellerClub/Namecheap EPP or .bd BTCL Manual Queue)
    if (action === 'register') {
      const regDb = isSupabaseConfigured() ? getServiceSupabase() : null;
      const entitlement = await verifyPaidDomainEntitlement({
        db: regDb,
        userId: ownerUserId,
        role: actorRole,
        domain: rawDomain,
        operation: 'register',
        invoiceNumber,
      });
      if (!entitlement.entitled) {
        return NextResponse.json(
          { error: 'Payment Required', code: 'PAYMENT_REQUIRED', message: entitlement.reason },
          { status: 402 }
        );
      }

      if (regDb) {
        const { data: existing } = await regDb
          .from('domains')
          .select('id, user_id')
          .eq('domain_name', rawDomain)
          .maybeSingle();
        if (existing) {
          return NextResponse.json(
            { error: 'Conflict', message: `${rawDomain} is already registered in the platform.` },
            { status: 409 }
          );
        }
      }

      const years = Math.max(1, Math.min(10, Number(body.years || 1)));
      const requestedNs = Array.isArray(body.nameservers)
        ? body.nameservers.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        : undefined;

      // Ensure Cloudflare zone first if configured so we can assign Cloudflare NS if caller didn't override
      let cfZoneId: string | undefined;
      let cfZoneStatus: string | undefined;
      let cfNameservers: string[] = [];
      if (isCloudflareConfigured()) {
        const cfZone = await ensureCloudflareZone(rawDomain);
        if (cfZone.ok && cfZone.zoneId) {
          cfZoneId = cfZone.zoneId;
          cfZoneStatus = cfZone.status;
          cfNameservers = cfZone.nameServers || [];
        }
      }

      const effectiveNameservers =
        requestedNs && requestedNs.length >= 2
          ? requestedNs
          : cfNameservers.length >= 2
          ? cfNameservers
          : ['ns1.devhost.net', 'ns2.devhost.net'];

      const regRes = await registerDomainWithRegistrar({
        domain: rawDomain,
        years,
        nameservers: effectiveNameservers,
        protectPrivacy: body.whoisPrivacy !== false,
      });

      if (!regRes.ok) {
        return NextResponse.json(
          { error: regRes.error || 'Domain registration failed', message: regRes.message },
          { status: regRes.statusCode || 502 }
        );
      }

      const finalStatus = regRes.data?.status || (isBdManualTld(rawDomain) ? 'Pending' : 'Active');
      const expiryDate = new Date(Date.now() + years * 365 * 86400000).toISOString().split('T')[0];

      if (isBdManualTld(rawDomain)) {
        await sendTelegramAlert(
          `*BTCL .bd Manual Registration Queued*\nDomain: \`${rawDomain}\`\nQueue ID: \`${regRes.orderId || 'BTCL-PENDING'}\`\nUser ID: \`${ownerUserId}\`\nAction Required: Submit NID / Trade License at BTCL portal.`,
          'order'
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const tld = rawDomain.includes('.') ? `.${rawDomain.split('.').slice(1).join('.')}` : '.com';
        await supabase.from('domains').insert({
          user_id: ownerUserId,
          domain_name: rawDomain,
          tld,
          status: finalStatus,
          registrar_lock: !isBdManualTld(rawDomain),
          whois_privacy: true,
          auto_renew: true,
          nameservers: regRes.data?.nameservers || effectiveNameservers,
          registrar_provider: regRes.provider,
          registrar_order_id: regRes.orderId || null,
          cloudflare_zone_id: cfZoneId || null,
          cloudflare_zone_status: cfZoneStatus || (cfZoneId ? 'pending' : 'unprovisioned'),
          cloudflare_nameservers: cfNameservers,
          expiry_date: expiryDate,
        });
      }

      return NextResponse.json({
        success: true,
        message: regRes.message,
        domain: rawDomain,
        status: finalStatus,
        provider: regRes.provider,
        mode: regRes.mode,
        orderId: regRes.orderId,
        nameservers: regRes.data?.nameservers || effectiveNameservers,
        cloudflareZoneId: cfZoneId,
        expiryDate,
      });
    }

    // 5. RENEW DOMAIN
    if (action === 'renew') {
      const regDb = isSupabaseConfigured() ? getServiceSupabase() : null;
      const entitlement = await verifyPaidDomainEntitlement({
        db: regDb,
        userId: ownerUserId,
        role: actorRole,
        domain: rawDomain,
        operation: 'renew',
        invoiceNumber,
      });
      if (!entitlement.entitled) {
        return NextResponse.json(
          { error: 'Payment Required', code: 'PAYMENT_REQUIRED', message: entitlement.reason },
          { status: 402 }
        );
      }

      const years = Math.max(1, Math.min(10, Number(body.years || 1)));
      const regRes = await renewDomainWithRegistrar({ domain: rawDomain, years });
      if (!regRes.ok) {
        return NextResponse.json(
          { error: regRes.error || 'Renewal failed', message: regRes.message },
          { status: regRes.statusCode || 502 }
        );
      }

      let newExpiryDate = new Date(Date.now() + years * 365 * 86400000).toISOString().split('T')[0];
      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const { data: domRow } = await supabase
          .from('domains')
          .select('expiry_date')
          .eq('domain_name', rawDomain)
          .maybeSingle();

        const baseMs = domRow?.expiry_date
          ? Math.max(Date.now(), new Date(domRow.expiry_date).getTime())
          : Date.now();
        newExpiryDate = new Date(baseMs + years * 365 * 86400000).toISOString().split('T')[0];

        await supabase
          .from('domains')
          .update({
            status: isBdManualTld(rawDomain) ? 'Pending' : 'Active',
            expiry_date: newExpiryDate,
            registrar_provider: regRes.provider,
            registrar_order_id: regRes.orderId || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('domain_name', rawDomain);
      }

      return NextResponse.json({
        success: true,
        message: regRes.message,
        domain: rawDomain,
        provider: regRes.provider,
        orderId: regRes.orderId,
        expiryDate: newExpiryDate,
      });
    }

    // 6. TRANSFER DOMAIN (EPP Submission)
    if (action === 'transfer') {
      const regDb = isSupabaseConfigured() ? getServiceSupabase() : null;
      const entitlement = await verifyPaidDomainEntitlement({
        db: regDb,
        userId: ownerUserId,
        role: actorRole,
        domain: rawDomain,
        operation: 'transfer',
        invoiceNumber,
      });
      if (!entitlement.entitled) {
        return NextResponse.json(
          { error: 'Payment Required', code: 'PAYMENT_REQUIRED', message: entitlement.reason },
          { status: 402 }
        );
      }

      const eppCode = String(body.eppCode || body.authCode || '').trim();
      if (!eppCode) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'eppCode is required for inbound transfer.' },
          { status: 400 }
        );
      }

      const regRes = await transferDomainWithRegistrar({ domain: rawDomain, eppCode });
      if (!regRes.ok) {
        return NextResponse.json(
          { error: regRes.error || 'Transfer failed', message: regRes.message },
          { status: regRes.statusCode || 502 }
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        await supabase
          .from('domains')
          .update({
            status: 'Transferring',
            registrar_provider: regRes.provider,
            registrar_order_id: regRes.orderId || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('domain_name', rawDomain);
      }

      return NextResponse.json({
        success: true,
        message: regRes.message,
        domain: rawDomain,
        provider: regRes.provider,
        orderId: regRes.orderId,
        status: 'Transferring',
      });
    }

    // 7. CHECK STATUS
    if (action === 'check_status') {
      const regCfg = getRegistrarConfig();
      const cfZone = isCloudflareConfigured() ? await getCloudflareZoneByName(rawDomain) : null;
      return NextResponse.json({
        success: true,
        domain: rawDomain,
        manualBdTld: isBdManualTld(rawDomain),
        registrar: {
          configured: regCfg.configured,
          provider: regCfg.provider,
          sandbox: regCfg.sandbox,
        },
        cloudflare: cfZone
          ? {
              configured: true,
              zoneId: cfZone.zoneId || null,
              status: cfZone.status || 'not_found',
              nameServers: cfZone.nameServers || [],
            }
          : { configured: false },
      });
    }

    return NextResponse.json(
      { error: 'Unknown Action', message: `Action "${action}" is not supported` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: 'Registrar API Error',
        message: err instanceof Error ? err.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
