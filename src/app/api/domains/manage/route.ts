import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { encryptEppCode, decryptEppCode } from '@/lib/dnsEngine';
import {
  requireAdmin,
  requireUser,
  requireDomainAccess,
  verifySudoToken,
  serviceUnavailableResponse,
} from '@/lib/authGuard';
import {
  consumePaidDomainEntitlement,
  releasePaidDomainEntitlement,
  resolveDomainTldPriceBDT,
  verifyPaidDomainEntitlement,
} from '@/lib/billingEntitlements';
import {
  addRegistrarChildNameserver,
  deleteRegistrarChildNameserver,
  getRegistrarEppCode,
  getRegistrarHealthStatus,
  isBdManualTld,
  renewDomainWithRegistrar,
  setRegistrarLockState,
  setRegistrarNameservers,
  setRegistrarWhoisPrivacy,
  transferDomainWithRegistrar,
} from '@/lib/registrarClient';
import {
  createCloudflareRedirectRule,
  deleteCloudflareRedirectRule,
  ensureCloudflareZone,
  isCloudflareConfigured,
  verifyCloudflareToken,
} from '@/lib/cloudflareClient';
import {
  serializeTransferRow,
  syncDomainTransferStatuses,
} from '@/lib/transferLifecycle';

async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  ip: string = '127.0.0.1'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_id: actorId,
      actor_role: 'client',
      action_type: actionType,
      target_resource: targetResource,
      ip_address: ip,
      risk_level: 'high',
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

async function resolveDomainMetadata(
  db: ReturnType<typeof getServiceSupabase> | null,
  domainId?: string,
  domainNameHint?: string
): Promise<{ domainName: string; cloudflareZoneId?: string }> {
  let resolvedName = (domainNameHint || '').trim().toLowerCase();
  let zoneId: string | undefined;

  if (db && domainId) {
    const { data } = await db
      .from('domains')
      .select('domain_name, cloudflare_zone_id')
      .eq('id', domainId)
      .maybeSingle();
    if (data?.domain_name) resolvedName = String(data.domain_name).toLowerCase();
    if (data?.cloudflare_zone_id) zoneId = String(data.cloudflare_zone_id);
  }

  return { domainName: resolvedName, cloudflareZoneId: zoneId };
}

/**
 * POST /api/domains/manage
 * Live Domain Registrar, Security, Glue Records, Redirects & Transfer Route
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      domainId?: string;
      domainName?: string;
      nameservers?: string[];
      childHostname?: string;
      childIpv4?: string;
      childIpv6?: string;
      childId?: string;
      forwardSource?: string;
      forwardTarget?: string;
      forwardType?: number | string;
      forwardId?: string;
      lockState?: boolean;
      whoisState?: boolean;
      eppCode?: string;
      transferId?: string;
      transferStep?: number | string;
      years?: number;
      deferRegistrarSubmit?: boolean;
      invoiceNumber?: string;
    };

    const {
      action,
      domainId,
      domainName,
      nameservers,
      childHostname,
      childIpv4,
      childIpv6,
      childId,
      forwardSource,
      forwardTarget,
      forwardType,
      forwardId,
      lockState,
      whoisState,
      eppCode,
      transferId,
      transferStep,
      years,
      deferRegistrarSubmit,
      invoiceNumber,
    } = body;

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    let userId: string;
    let userRole = 'client';
    let resolvedDomainId = domainId;
    let resolvedDomainName = domainName?.trim().toLowerCase();

    if (
      action === 'initiate_transfer' ||
      action === 'list_transfers' ||
      action === 'poll_transfers' ||
      action === 'resubmit_transfer_epp'
    ) {
      const auth = await requireUser(request);
      if (!auth.ok) return auth.response;
      userId = auth.user.id;
      userRole = auth.role;
    } else if (action === 'update_transfer_step') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;
      userId = adminAuth.user.id;
      userRole = 'admin';
    } else if (action === 'sync_all_registrars') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;
      if (!(await verifySudoToken(request, adminAuth.user.id))) {
        return NextResponse.json(
          { success: false, error: 'Admin Sudo Step-Up Verification required to sync all registrars.', requireSudo: true },
          { status: 403 }
        );
      }
      userId = adminAuth.user.id;
      userRole = 'admin';
    } else {
      if (db) {
        if (action === 'delete_child_nameserver' && childId) {
          const { data: childRow } = await db
            .from('domain_child_nameservers')
            .select('domain_id')
            .eq('id', childId)
            .maybeSingle();
          if (!childRow) {
            return NextResponse.json({ success: false, error: 'Child nameserver record not found.' }, { status: 404 });
          }
          if (resolvedDomainId && childRow.domain_id && childRow.domain_id !== resolvedDomainId) {
            return NextResponse.json({ success: false, error: 'Forbidden child nameserver access.' }, { status: 403 });
          }
          resolvedDomainId = childRow.domain_id || resolvedDomainId;
        } else if (action === 'delete_url_forward' && forwardId) {
          const { data: fwdRow } = await db
            .from('domain_url_forwards')
            .select('domain_id')
            .eq('id', forwardId)
            .maybeSingle();
          if (!fwdRow) {
            return NextResponse.json({ success: false, error: 'Redirect rule not found.' }, { status: 404 });
          }
          if (resolvedDomainId && fwdRow.domain_id && fwdRow.domain_id !== resolvedDomainId) {
            return NextResponse.json({ success: false, error: 'Forbidden redirect rule access.' }, { status: 403 });
          }
          resolvedDomainId = fwdRow.domain_id || resolvedDomainId;
        }
      }

      const access = await requireDomainAccess(request, { domainId: resolvedDomainId, domainName });
      if (!access.ok) return access.response;
      userId = access.user.id;
      userRole = access.role || (access.isAdmin ? 'admin' : 'client');
      resolvedDomainId = access.domainId || resolvedDomainId;
      resolvedDomainName = access.domainName || resolvedDomainName;
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Domain Registrar & Cloudflare Control Plane');
    }

    // 0. ADMIN BULK REGISTRAR + CLOUDFLARE ZONE RECONCILIATION
    if (action === 'sync_all_registrars') {
      const regHealth = await getRegistrarHealthStatus();
      const cfToken = isCloudflareConfigured()
        ? await verifyCloudflareToken()
        : { configured: false, valid: false, error: 'Cloudflare not configured' };

      if (!regHealth.configured && !cfToken.configured && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Domain Registrar & Cloudflare APIs');
      }

      let syncedDomains = 0;
      if (db && cfToken.configured && cfToken.valid) {
        const { data: rows } = await db
          .from('domains')
          .select('id, domain_name, cloudflare_zone_id, registrar_provider')
          .limit(50);

        for (const row of rows || []) {
          if (!row.cloudflare_zone_id && row.domain_name) {
            const ensured = await ensureCloudflareZone(row.domain_name);
            if (ensured.ok && ensured.zoneId) {
              await db
                .from('domains')
                .update({
                  cloudflare_zone_id: ensured.zoneId,
                  cloudflare_zone_status: ensured.status || 'pending',
                  cloudflare_nameservers: ensured.nameServers || [],
                  updated_at: new Date().toISOString(),
                })
                .eq('id', row.id);
              syncedDomains += 1;
            }
          } else if (row.cloudflare_zone_id) {
            syncedDomains += 1;
          }
        }
      }

      const cfMessage = !cfToken.configured
        ? 'Cloudflare not configured'
        : cfToken.valid
        ? 'Cloudflare token verified'
        : cfToken.error || 'Cloudflare verification warning';

      await logAudit(userId, 'ADMIN_REGISTRAR_SYNC_ALL', 'domains:bulk', {
        syncedDomains,
        registrarHealthy: regHealth.healthy,
        cloudflareHealthy: cfToken.valid,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `Synchronized ${syncedDomains} domain zone(s). Registrar: ${regHealth.message} Cloudflare: ${cfMessage}`,
        syncedDomains,
        registrarHealth: regHealth,
        cloudflareHealth: { ...cfToken, message: cfMessage },
      });
    }

    const domainMeta = await resolveDomainMetadata(db, resolvedDomainId, resolvedDomainName);
    const activeDomainName = domainMeta.domainName || resolvedDomainName || '';

    // 1. UPDATE NAMESERVERS (Live Registrar API + DB)
    if (action === 'update_nameservers') {
      if (!resolvedDomainId || !Array.isArray(nameservers) || nameservers.length < 2) {
        return NextResponse.json({ success: false, error: 'Domain ID and at least 2 nameservers are required.' }, { status: 400 });
      }
      const cleanNs = nameservers.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
      if (cleanNs.length < 2) {
        return NextResponse.json({ success: false, error: 'At least 2 valid nameservers are required.' }, { status: 400 });
      }
      if (!activeDomainName && !isDevSandboxMode()) {
        return NextResponse.json({ success: false, error: 'Could not resolve domain name for registrar update.' }, { status: 400 });
      }

      const regRes = await setRegistrarNameservers(activeDomainName || 'sandbox.devhost.net', cleanNs);
      if (!regRes.ok) {
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Registrar nameserver update failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      if (db) {
        const { error } = await db
          .from('domains')
          .update({
            nameservers: cleanNs,
            registrar_provider: regRes.provider,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedDomainId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'NAMESERVERS_UPDATED', `domain:${resolvedDomainId}`, {
        nameservers: cleanNs,
        provider: regRes.provider,
      }, ip);

      return NextResponse.json({
        success: true,
        message: regRes.message,
        nameservers: cleanNs,
        provider: regRes.provider,
        mode: regRes.mode,
      });
    }

    // 2. CHILD NAMESERVERS (Private Glue Records)
    if (action === 'add_child_nameserver') {
      if (!resolvedDomainId || !childHostname || !childIpv4) {
        return NextResponse.json({ success: false, error: 'Domain ID, Hostname, and IPv4 are required for Glue records.' }, { status: 400 });
      }

      const hostClean = childHostname.trim().toLowerCase();
      const ipClean = childIpv4.trim();
      const regRes = await addRegistrarChildNameserver(
        activeDomainName || hostClean.split('.').slice(1).join('.'),
        hostClean,
        ipClean
      );
      if (!regRes.ok) {
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Registrar child nameserver creation failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      let newId = `cns_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('domain_child_nameservers')
          .insert({
            domain_id: resolvedDomainId,
            user_id: userId,
            hostname: hostClean,
            ipv4_address: ipClean,
            ipv6_address: childIpv6?.trim() || null,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;
      }

      await logAudit(userId, 'CHILD_NAMESERVER_CREATED', `domain:${resolvedDomainId}`, {
        hostname: hostClean,
        ip: ipClean,
        provider: regRes.provider,
      }, ip);

      return NextResponse.json({
        success: true,
        message: regRes.message,
        id: newId,
        provider: regRes.provider,
      });
    }

    if (action === 'delete_child_nameserver') {
      if (!childId) return NextResponse.json({ success: false, error: 'Child Nameserver ID is required.' }, { status: 400 });

      let targetHost = childHostname?.trim().toLowerCase() || '';
      let targetIpv4 = childIpv4?.trim() || '';
      if (db) {
        const { data: row } = await db
          .from('domain_child_nameservers')
          .select('hostname, ipv4_address, domain_id')
          .eq('id', childId)
          .eq('domain_id', resolvedDomainId)
          .maybeSingle();
        if (!row) {
          return NextResponse.json({ success: false, error: 'Child nameserver record not found for domain.' }, { status: 404 });
        }
        targetHost = row.hostname || targetHost;
        targetIpv4 = row.ipv4_address || targetIpv4;
      }

      if (targetHost) {
        const regRes = await deleteRegistrarChildNameserver(
          activeDomainName || targetHost.split('.').slice(1).join('.'),
          targetHost,
          targetIpv4
        );
        if (!regRes.ok) {
          return NextResponse.json(
            { success: false, error: regRes.message || regRes.error || 'Registrar child nameserver removal failed.' },
            { status: regRes.statusCode || 502 }
          );
        }
      }

      if (db) {
        const { error } = await db
          .from('domain_child_nameservers')
          .delete()
          .eq('id', childId)
          .eq('domain_id', resolvedDomainId);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'CHILD_NAMESERVER_DELETED', `cns:${childId}`, { hostname: targetHost }, ip);
      return NextResponse.json({ success: true, message: 'Child nameserver removed from Registry.' });
    }

    // 3. 301/302 URL FORWARDING ENGINE (Cloudflare Dynamic Redirect Ruleset)
    if (action === 'add_url_forward') {
      if (!resolvedDomainId || !forwardTarget) {
        return NextResponse.json({ success: false, error: 'Destination URL is required for forwarding.' }, { status: 400 });
      }
      if (!isCloudflareConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Cloudflare Edge Redirect Engine');
      }

      const redirectCode: 301 | 302 = Number(forwardType) === 302 ? 302 : 301;
      const sourcePrefix = (forwardSource || '@').trim();
      let cloudflareRuleId: string | null = null;

      if (isCloudflareConfigured() && activeDomainName) {
        let zoneId = domainMeta.cloudflareZoneId;
        if (!zoneId) {
          const ensured = await ensureCloudflareZone(activeDomainName);
          if (!ensured.ok || !ensured.zoneId) {
            return NextResponse.json(
              { success: false, error: ensured.error || 'Failed to provision Cloudflare zone for redirect.' },
              { status: 502 }
            );
          }
          zoneId = ensured.zoneId;
          if (db) {
            await db.from('domains').update({ cloudflare_zone_id: zoneId }).eq('id', resolvedDomainId);
          }
        }

        const ruleRes = await createCloudflareRedirectRule({
          zoneId,
          domainName: activeDomainName,
          sourcePrefix,
          targetUrl: forwardTarget.trim(),
          statusCode: redirectCode,
        });
        if (!ruleRes.ok) {
          return NextResponse.json(
            { success: false, error: ruleRes.error || 'Failed to push redirect rule to Cloudflare.' },
            { status: 502 }
          );
        }
        cloudflareRuleId = ruleRes.ruleId || null;
      }

      let newId = `red_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('domain_url_forwards')
          .insert({
            domain_id: resolvedDomainId,
            user_id: userId,
            source_prefix: sourcePrefix,
            destination_url: forwardTarget.trim(),
            redirect_type: redirectCode,
            preserve_path_query: true,
            cloudflare_rule_id: cloudflareRuleId,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;
      }

      await logAudit(userId, 'URL_FORWARD_CREATED', `domain:${resolvedDomainId}`, {
        target: forwardTarget,
        cloudflareRuleId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: isCloudflareConfigured()
          ? `HTTP ${redirectCode} URL Redirect synced live to Cloudflare Edge Ruleset.`
          : `HTTP ${redirectCode} URL Redirect created in DEV_SANDBOX_MODE.`,
        id: newId,
        cloudflareRuleId,
      });
    }

    if (action === 'delete_url_forward') {
      if (!forwardId) return NextResponse.json({ success: false, error: 'Redirect ID is required.' }, { status: 400 });

      if (!isCloudflareConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Cloudflare Edge Redirect Engine');
      }

      if (db) {
        const { data: fwd } = await db
          .from('domain_url_forwards')
          .select('cloudflare_rule_id, domain_id')
          .eq('id', forwardId)
          .eq('domain_id', resolvedDomainId)
          .maybeSingle();

        if (!fwd) {
          return NextResponse.json({ success: false, error: 'Redirect rule not found for domain.' }, { status: 404 });
        }

        if (isCloudflareConfigured() && fwd?.cloudflare_rule_id && domainMeta.cloudflareZoneId) {
          const cfDel = await deleteCloudflareRedirectRule(
            domainMeta.cloudflareZoneId,
            fwd.cloudflare_rule_id
          );
          if (!cfDel.ok) {
            return NextResponse.json(
              { success: false, error: cfDel.error || 'Failed removing Cloudflare redirect rule.' },
              { status: 502 }
            );
          }
        }

        const { error } = await db
          .from('domain_url_forwards')
          .delete()
          .eq('id', forwardId)
          .eq('domain_id', resolvedDomainId);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'URL_FORWARD_DELETED', `red:${forwardId}`, {}, ip);
      return NextResponse.json({ success: true, message: 'Redirect rule removed from Cloudflare & database.' });
    }

    // 4. REGISTRAR THEFT LOCK TOGGLE (Requires Sudo on unlock)
    if (action === 'toggle_registrar_lock') {
      if (!resolvedDomainId) return NextResponse.json({ success: false, error: 'Domain ID is required.' }, { status: 400 });

      if (lockState === false && !(await verifySudoToken(request, userId))) {
        return NextResponse.json({
          success: false,
          error: 'Sudo Step-Up Verification required to unlock domain registrar protection.',
          requireSudo: true,
        }, { status: 403 });
      }

      const targetLocked = Boolean(lockState);
      const regRes = await setRegistrarLockState(activeDomainName || 'sandbox.devhost.net', targetLocked);
      if (!regRes.ok) {
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Registrar lock toggle failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      if (db) {
        const { error } = await db
          .from('domains')
          .update({
            registrar_lock: targetLocked,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedDomainId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'REGISTRAR_LOCK_TOGGLED', `domain:${resolvedDomainId}`, {
        newLockState: targetLocked,
        provider: regRes.provider,
      }, ip);

      return NextResponse.json({
        success: true,
        message: regRes.message,
        registrarLock: targetLocked,
        provider: regRes.provider,
      });
    }

    // 5. WHOIS ID PROTECTION TOGGLE
    if (action === 'toggle_whois_privacy') {
      if (!resolvedDomainId) return NextResponse.json({ success: false, error: 'Domain ID is required.' }, { status: 400 });

      const targetPrivacy = Boolean(whoisState);
      const regRes = await setRegistrarWhoisPrivacy(activeDomainName || 'sandbox.devhost.net', targetPrivacy);
      if (!regRes.ok) {
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Registrar WHOIS update failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      if (db) {
        const { error } = await db
          .from('domains')
          .update({
            whois_privacy: targetPrivacy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedDomainId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'WHOIS_PRIVACY_TOGGLED', `domain:${resolvedDomainId}`, {
        whoisPrivacy: targetPrivacy,
        provider: regRes.provider,
      }, ip);

      return NextResponse.json({
        success: true,
        message: regRes.message,
        whoisPrivacy: targetPrivacy,
        provider: regRes.provider,
      });
    }

    // 6. REVEAL / DECRYPT EPP CODE (Requires Sudo + Registrar Query)
    if (action === 'reveal_epp_code') {
      if (!resolvedDomainId) return NextResponse.json({ success: false, error: 'Domain ID is required.' }, { status: 400 });

      if (!(await verifySudoToken(request, userId))) {
        return NextResponse.json({
          success: false,
          error: '2FA Sudo Step-Up Verification required to reveal transfer authorization code.',
          requireSudo: true,
        }, { status: 403 });
      }

      let dbEppEncrypted: string | null = null;
      if (db) {
        const { data, error } = await db.from('domains').select('epp_code, domain_name').eq('id', resolvedDomainId).single();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        dbEppEncrypted = data?.epp_code || null;
      }

      let clearEpp = '';
      if (activeDomainName && isBdManualTld(activeDomainName)) {
        clearEpp = dbEppEncrypted ? await decryptEppCode(dbEppEncrypted) : 'BTCL-MANUAL-TRANSFER-NOCODE';
      } else {
        const regRes = await getRegistrarEppCode(activeDomainName || 'sandbox.devhost.net');
        if (!regRes.ok) {
          return NextResponse.json(
            { success: false, error: regRes.message || regRes.error || 'Failed to retrieve EPP code from registrar.' },
            { status: regRes.statusCode || 502 }
          );
        }
        clearEpp = regRes.data?.eppCode || '';
        if (!clearEpp && dbEppEncrypted) {
          clearEpp = await decryptEppCode(dbEppEncrypted);
        }
      }

      if (!clearEpp) {
        return NextResponse.json(
          { success: false, error: 'EPP authorization code unavailable from upstream registrar.' },
          { status: 404 }
        );
      }

      await logAudit(userId, 'EPP_CODE_REVEALED', `domain:${resolvedDomainId}`, {}, ip);

      return NextResponse.json({
        success: true,
        eppCode: clearEpp,
      });
    }

    // 7. RENEW DOMAIN (Live Registrar API + DB Expiry Extension)
    if (action === 'renew_domain') {
      if (!resolvedDomainId || !activeDomainName) {
        return NextResponse.json({ success: false, error: 'Domain ID and domain name are required.' }, { status: 400 });
      }
      const entitlement = await verifyPaidDomainEntitlement({
        db,
        userId,
        role: userRole,
        domain: activeDomainName,
        operation: 'renew',
        invoiceNumber: invoiceNumber || null,
      });
      if (!entitlement.entitled) {
        return NextResponse.json(
          { success: false, code: 'PAYMENT_REQUIRED', error: entitlement.reason },
          { status: 402 }
        );
      }
      const requestedYears = Math.max(1, Math.min(10, Number(years || 1)));
      const renewalYears =
        entitlement.via === 'admin'
          ? requestedYears
          : Math.min(requestedYears, entitlement.authorizedYears || 1);

      const claimed = await consumePaidDomainEntitlement({
        db,
        entitlement,
        domain: activeDomainName,
        operation: 'renew',
      });
      if (!claimed.ok) {
        return NextResponse.json(
          { success: false, code: 'ENTITLEMENT_ALREADY_USED', error: claimed.error },
          { status: 409 }
        );
      }

      const regRes = await renewDomainWithRegistrar({ domain: activeDomainName, years: renewalYears });
      if (!regRes.ok) {
        await releasePaidDomainEntitlement({ db, entitlement });
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Domain renewal failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      let newExpiryDate = new Date(Date.now() + renewalYears * 365 * 86400000).toISOString().split('T')[0];
      if (db) {
        const { data: domRow } = await db.from('domains').select('expiry_date').eq('id', resolvedDomainId).maybeSingle();
        const baseMs = domRow?.expiry_date ? Math.max(Date.now(), new Date(domRow.expiry_date).getTime()) : Date.now();
        newExpiryDate = new Date(baseMs + renewalYears * 365 * 86400000).toISOString().split('T')[0];

        await db
          .from('domains')
          .update({
            expiry_date: newExpiryDate,
            status: isBdManualTld(activeDomainName) ? 'Pending' : 'Active',
            registrar_provider: regRes.provider,
            registrar_order_id: regRes.orderId || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedDomainId);
      }

      await logAudit(userId, 'DOMAIN_RENEWED', `domain:${resolvedDomainId}`, {
        years: renewalYears,
        newExpiryDate,
        orderId: regRes.orderId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: regRes.message,
        expiryDate: newExpiryDate,
        orderId: regRes.orderId,
      });
    }

    // 8. INBOUND EPP DOMAIN TRANSFER STATE MACHINE
    if (action === 'initiate_transfer') {
      if (!domainName || !eppCode) {
        return NextResponse.json({ success: false, error: 'Domain name and EPP Auth code are required.' }, { status: 400 });
      }

      const cleanDomain = domainName.trim().toLowerCase();
      const tldPricing = await resolveDomainTldPriceBDT(db, cleanDomain, 'transfer');
      const tld = tldPricing.tld;
      const encryptedEpp = await encryptEppCode(eppCode.trim());
      const transferPriceBDT = tldPricing.found && tldPricing.unitPriceBDT > 0 ? tldPricing.unitPriceBDT : 1350;

      let registrarOrderId: string | null = null;
      let registrarProvider = isBdManualTld(cleanDomain) ? 'btcl_manual' : 'unconfigured';
      let currentStep = 1;
      let transferStatus = 'pending_payment';
      let statusMessage = 'Transfer initiated. Awaiting payment and initial registrar validation handshake.';

      if (!deferRegistrarSubmit) {
        const entitlement = await verifyPaidDomainEntitlement({
          db,
          userId,
          role: userRole,
          domain: cleanDomain,
          operation: 'transfer',
          invoiceNumber: invoiceNumber || null,
        });
        if (!entitlement.entitled) {
          return NextResponse.json(
            { success: false, code: 'PAYMENT_REQUIRED', error: entitlement.reason },
            { status: 402 }
          );
        }

        const claimed = await consumePaidDomainEntitlement({
          db,
          entitlement,
          domain: cleanDomain,
          operation: 'transfer',
        });
        if (!claimed.ok) {
          return NextResponse.json(
            { success: false, code: 'ENTITLEMENT_ALREADY_USED', error: claimed.error },
            { status: 409 }
          );
        }

        const regRes = await transferDomainWithRegistrar({
          domain: cleanDomain,
          eppCode: eppCode.trim(),
        });
        if (!regRes.ok) {
          await releasePaidDomainEntitlement({ db, entitlement });
          return NextResponse.json(
            { success: false, error: regRes.message || regRes.error || 'Registrar transfer submission failed.' },
            { status: regRes.statusCode || 502 }
          );
        }
        registrarOrderId = regRes.orderId || null;
        registrarProvider = regRes.provider;
        currentStep = regRes.mode === 'manual_btcl_queue' ? 1 : 2;
        transferStatus = regRes.mode === 'manual_btcl_queue' ? 'pending_payment' : 'verifying_epp';
        statusMessage = regRes.message;
      }

      let transferRecordId = `trf_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('domain_transfers')
          .insert({
            user_id: userId,
            domain_name: cleanDomain,
            tld,
            epp_code_encrypted: encryptedEpp,
            transfer_price_bdt: transferPriceBDT,
            current_step: currentStep,
            status: transferStatus,
            status_message: statusMessage,
            auto_import_dns: true,
            registrar_transfer_id: registrarOrderId,
            registrar_provider: registrarProvider,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) transferRecordId = data.id;
      }

      await logAudit(userId, 'DOMAIN_TRANSFER_INITIATED', `domain:${cleanDomain}`, {
        tld,
        transferPriceBDT,
        registrarOrderId,
        registrarProvider,
      }, ip);

      return NextResponse.json({
        success: true,
        message: statusMessage,
        transferId: transferRecordId,
        transferPriceBDT,
        registrarTransferId: registrarOrderId,
        provider: registrarProvider,
        currentStep,
        status: transferStatus,
      });
    }

    // 8b. LIST USER INBOUND DOMAIN TRANSFERS (No Mock Fallback)
    if (action === 'list_transfers') {
      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Domain Transfer Tracker');
      }
      if (!db) {
        return NextResponse.json({ success: true, transfers: [] });
      }

      const { data: rows, error } = await db
        .from('domain_transfers')
        .select('*')
        .eq('user_id', userId)
        .order('initiated_at', { ascending: false });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        transfers: ((rows || []) as Array<Record<string, unknown>>).map(serializeTransferRow),
      });
    }

    // 8c. POLL REGISTRAR FOR REAL INBOUND TRANSFER STATUS UPDATES
    if (action === 'poll_transfers') {
      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Domain Transfer Polling');
      }
      if (!db) {
        return NextResponse.json({
          success: true,
          checked: 0,
          updated: 0,
          completed: 0,
          failed: 0,
          transfers: [],
        });
      }

      if (transferId && userRole !== 'admin') {
        const { data: trfOwner } = await db
          .from('domain_transfers')
          .select('id, user_id')
          .eq('id', transferId)
          .maybeSingle();
        if (!trfOwner) {
          return NextResponse.json({ success: false, error: 'Transfer record not found.' }, { status: 404 });
        }
        if (trfOwner.user_id !== userId) {
          return NextResponse.json({ success: false, error: 'Forbidden transfer access.' }, { status: 403 });
        }
      }

      const pollSummary = await syncDomainTransferStatuses(db, {
        userId: userRole === 'admin' ? undefined : userId,
        transferId,
      });

      const { data: allRows } = await db
        .from('domain_transfers')
        .select('*')
        .eq('user_id', userId)
        .order('initiated_at', { ascending: false });

      return NextResponse.json({
        success: true,
        checked: pollSummary.checked,
        updated: pollSummary.updated,
        completed: pollSummary.completed,
        failed: pollSummary.failed,
        errors: pollSummary.errors,
        transfers: ((allRows || []) as Array<Record<string, unknown>>).map(serializeTransferRow),
      });
    }

    // 8d. CLIENT-AUTHORIZED EPP CODE RESUBMISSION TO REGISTRAR
    if (action === 'resubmit_transfer_epp') {
      if (!transferId || !eppCode?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Transfer ID and fresh EPP Auth code are required.' },
          { status: 400 }
        );
      }
      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Domain Transfer Retry');
      }

      let targetDomain = String(domainName || '').trim().toLowerCase();
      let existingRegistrarTransferId: string | null = null;
      let isRetryForRejectedTransfer = false;
      if (db) {
        const { data: existingTrf, error: fetchErr } = await db
          .from('domain_transfers')
          .select('*')
          .eq('id', transferId)
          .maybeSingle();

        if (fetchErr) {
          return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
        }
        if (!existingTrf) {
          return NextResponse.json({ success: false, error: 'Transfer record not found.' }, { status: 404 });
        }
        if (existingTrf.user_id !== userId && userRole !== 'admin') {
          return NextResponse.json(
            { success: false, error: 'Forbidden: you do not own this domain transfer.' },
            { status: 403 }
          );
        }
        targetDomain = String(existingTrf.domain_name || targetDomain).trim().toLowerCase();
        existingRegistrarTransferId = existingTrf.registrar_transfer_id
          ? String(existingTrf.registrar_transfer_id)
          : null;
        isRetryForRejectedTransfer =
          existingTrf.status === 'rejected_invalid_epp' || existingTrf.epp_status === 'rejected';
      }

      if (!targetDomain) {
        return NextResponse.json({ success: false, error: 'Target domain name missing.' }, { status: 400 });
      }

      const entitlement = await verifyPaidDomainEntitlement({
        db,
        userId,
        role: userRole,
        domain: targetDomain,
        operation: 'transfer',
        invoiceNumber: invoiceNumber || null,
        allowConsumedRetry: isRetryForRejectedTransfer,
      });
      if (!entitlement.entitled) {
        return NextResponse.json(
          { success: false, code: 'PAYMENT_REQUIRED', error: entitlement.reason },
          { status: 402 }
        );
      }

      if (!isRetryForRejectedTransfer) {
        const claimed = await consumePaidDomainEntitlement({
          db,
          entitlement,
          domain: targetDomain,
          operation: 'transfer',
        });
        if (!claimed.ok) {
          return NextResponse.json(
            { success: false, code: 'ENTITLEMENT_ALREADY_USED', error: claimed.error },
            { status: 409 }
          );
        }
      }

      const encryptedEpp = await encryptEppCode(eppCode.trim());
      const regRes = await transferDomainWithRegistrar({
        domain: targetDomain,
        eppCode: eppCode.trim(),
      });
      const nowIso = new Date().toISOString();

      if (!regRes.ok) {
        if (!isRetryForRejectedTransfer) {
          await releasePaidDomainEntitlement({ db, entitlement });
        }
        if (db) {
          await db
            .from('domain_transfers')
            .update({
              epp_status: 'rejected',
              status_message: regRes.message || regRes.error || 'Registrar rejected resubmitted EPP code.',
              last_polled_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', transferId);
        }
        return NextResponse.json(
          { success: false, error: regRes.message || regRes.error || 'Registrar transfer resubmission failed.' },
          { status: regRes.statusCode || 502 }
        );
      }

      const currentStep = regRes.mode === 'manual_btcl_queue' ? 1 : 2;
      const status = regRes.mode === 'manual_btcl_queue' ? 'pending_payment' : 'verifying_epp';
      const registrarTransferId = regRes.orderId || existingRegistrarTransferId;

      if (db) {
        const { error: updErr } = await db
          .from('domain_transfers')
          .update({
            epp_code_encrypted: encryptedEpp,
            registrar_transfer_id: registrarTransferId,
            registrar_provider: regRes.provider,
            current_step: currentStep,
            status,
            epp_status: 'resubmitted',
            status_message: regRes.message,
            last_polled_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', transferId);

        if (updErr) {
          return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
        }
      }

      await logAudit(
        userId,
        'TRANSFER_EPP_RESUBMITTED',
        `trf:${transferId}`,
        { domain: targetDomain, registrarTransferId, provider: regRes.provider },
        ip
      );

      return NextResponse.json({
        success: true,
        message: regRes.message,
        transferId,
        currentStep,
        status,
        registrarTransferId,
        provider: regRes.provider,
      });
    }

    // 9. UPDATE TRANSFER STEP (1 to 5)
    if (action === 'update_transfer_step') {
      if (!transferId || !transferStep) {
        return NextResponse.json({ success: false, error: 'Transfer ID and target step are required.' }, { status: 400 });
      }

      const stepStatusMap: Record<number, string> = {
        1: 'pending_payment',
        2: 'verifying_epp',
        3: 'awaiting_losing_registrar',
        4: 'awaiting_losing_registrar',
        5: 'completed',
      };

      const status = stepStatusMap[Number(transferStep)] || 'verifying_epp';

      if (db) {
        const { error } = await db
          .from('domain_transfers')
          .update({
            current_step: Number(transferStep),
            status,
            completed_at: Number(transferStep) === 5 ? new Date().toISOString() : null,
          })
          .eq('id', transferId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'TRANSFER_STEP_ADVANCED', `trf:${transferId}`, { step: transferStep, status }, ip);

      return NextResponse.json({
        success: true,
        message: `Transfer progressed to Step ${transferStep} (${status}).`,
        currentStep: Number(transferStep),
        status,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown management action.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
