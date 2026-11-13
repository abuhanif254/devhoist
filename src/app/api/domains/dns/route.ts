import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import {
  validateDnsRecord,
  parseBindZone,
  getGoogleWorkspacePreset,
  getZohoMailPreset,
  getEmailSecurityShieldPreset,
  getDevHostServerPreset,
} from '@/lib/dnsEngine';
import { DnsRecord } from '@/context/PortalContext';
import { requireDomainAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  deleteCloudflareDnsRecord,
  ensureCloudflareZone,
  isCloudflareConfigured,
  listCloudflareDnsRecords,
  upsertCloudflareDnsRecord,
} from '@/lib/cloudflareClient';

type DbClient = ReturnType<typeof getServiceSupabase>;

interface DnsDbRow {
  id: string;
  record_type: DnsRecord['type'];
  name: string;
  content: string;
  ttl: number;
  priority?: number | null;
  proxied?: boolean;
  comment?: string | null;
  is_system_managed?: boolean;
  cloudflare_record_id?: string | null;
  cloudflare_zone_id?: string | null;
  sync_status?: string | null;
}

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
      risk_level: 'medium',
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

async function resolveZoneContext(
  db: DbClient | null,
  domainId?: string | null,
  domainNameHint?: string | null
): Promise<{
  ok: boolean;
  domainName: string;
  zoneId?: string;
  error?: string;
}> {
  let domainName = (domainNameHint || '').trim().toLowerCase();
  let zoneId: string | undefined;

  if (db && domainId) {
    const { data: dom } = await db
      .from('domains')
      .select('domain_name, cloudflare_zone_id')
      .eq('id', domainId)
      .maybeSingle();
    if (dom?.domain_name) {
      domainName = String(dom.domain_name).toLowerCase();
    }
    if (dom?.cloudflare_zone_id) {
      zoneId = String(dom.cloudflare_zone_id);
    }
  }

  if (!isCloudflareConfigured()) {
    return { ok: true, domainName: domainName || 'sandbox.devhost.net', zoneId };
  }

  if (!zoneId) {
    if (!domainName) {
      return { ok: false, domainName: '', error: 'Domain name is required to resolve Cloudflare zone.' };
    }
    const ensured = await ensureCloudflareZone(domainName);
    if (!ensured.ok || !ensured.zoneId) {
      return { ok: false, domainName, error: ensured.error || 'Failed to provision Cloudflare zone.' };
    }
    zoneId = ensured.zoneId;

    if (db && domainId) {
      await db
        .from('domains')
        .update({
          cloudflare_zone_id: zoneId,
          cloudflare_zone_status: ensured.status || 'pending',
          cloudflare_nameservers: ensured.nameServers || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', domainId);
    }
  }

  return { ok: true, domainName, zoneId };
}

/**
 * GET /api/domains/dns?domainId=...
 * Fetch all live DNS records for a given domain
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('domainId');

    if (!domainId) {
      return NextResponse.json({ success: false, error: 'Domain ID is required' }, { status: 400 });
    }

    const access = await requireDomainAccess(request, { domainId });
    if (!access.ok) return access.response;

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data, error } = await db
        .from('domain_dns_records')
        .select('*')
        .eq('domain_id', domainId)
        .order('record_type', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const records = ((data || []) as DnsDbRow[]).map((row) => ({
        id: row.id,
        type: row.record_type,
        name: row.name,
        content: row.content,
        ttl: row.ttl,
        priority: row.priority ?? undefined,
        proxied: Boolean(row.proxied),
        comment: row.comment ?? undefined,
        isSystemManaged: Boolean(row.is_system_managed),
        cloudflareRecordId: row.cloudflare_record_id ?? undefined,
        cloudflareZoneId: row.cloudflare_zone_id ?? undefined,
        syncStatus: row.sync_status ?? 'pending',
      }));

      return NextResponse.json({ success: true, records });
    }

    if (!isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS Engine');
    }

    return NextResponse.json({
      success: true,
      records: [
        { id: 'offline_1', type: 'A', name: '@', content: '103.151.102.45', ttl: 3600, proxied: true, syncStatus: 'sandbox' },
        { id: 'offline_2', type: 'CNAME', name: 'www', content: '@', ttl: 3600, proxied: true, syncStatus: 'sandbox' },
        { id: 'offline_3', type: 'MX', name: '@', content: 'mail.devhost.net', priority: 10, ttl: 3600, proxied: false, syncStatus: 'sandbox' },
      ],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/dns
 * Actions: add_record, apply_preset, import_bind_zone, point_to_hosting, sync_from_cloudflare
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      domainId?: string;
      domainName?: string;
      record?: Omit<DnsRecord, 'id'>;
      presetType?: string;
      bindText?: string;
      serverIp?: string;
    };
    const { action, domainId, domainName, record, presetType, bindText, serverIp } = body;

    if (!domainId) {
      return NextResponse.json({ success: false, error: 'Domain ID is required.' }, { status: 400 });
    }

    const access = await requireDomainAccess(request, { domainId, domainName });
    if (!access.ok) return access.response;
    const userId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS Engine');
    }

    if (!isCloudflareConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS API (CLOUDFLARE_DNS_API_TOKEN missing)');
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    const zoneCtx = await resolveZoneContext(db, domainId, domainName || access.domainName);
    if (!zoneCtx.ok) {
      return NextResponse.json({ success: false, error: zoneCtx.error }, { status: 502 });
    }

    // Fetch existing records for RFC CNAME conflict checking
    let existingRecords: DnsRecord[] = [];
    if (db) {
      const { data } = await db.from('domain_dns_records').select('*').eq('domain_id', domainId);
      if (data) {
        existingRecords = (data as DnsDbRow[]).map((r) => ({
          id: r.id,
          type: r.record_type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
          proxied: Boolean(r.proxied),
        }));
      }
    }

    const pushManyToCloudflareAndDb = async (
      items: Array<Omit<DnsRecord, 'id'>>,
      defaultComment?: string
    ) => {
      const rowsToInsert: Array<Record<string, unknown>> = [];
      for (const r of items) {
        let cfRecordId: string | null = null;
        let proxiedResult = Boolean(r.proxied);
        let syncStatus = isCloudflareConfigured() ? 'synced' : 'sandbox';

        if (isCloudflareConfigured() && zoneCtx.zoneId) {
          const cfRes = await upsertCloudflareDnsRecord(
            zoneCtx.zoneId,
            {
              type: r.type,
              name: r.name,
              content: r.content,
              ttl: r.ttl,
              priority: r.priority ?? null,
              proxied: r.proxied,
              comment: r.comment || defaultComment || null,
            },
            { apexDomain: zoneCtx.domainName }
          );
          if (!cfRes.ok) {
            return {
              ok: false as const,
              error: cfRes.error || `Cloudflare refused record ${r.type} ${r.name}`,
            };
          }
          cfRecordId = cfRes.cloudflareRecordId || null;
          proxiedResult = Boolean(cfRes.proxied);
          syncStatus = 'synced';
        }

        rowsToInsert.push({
          domain_id: domainId,
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          record_type: r.type,
          name: (r.name || '@').trim(),
          content: r.content.trim(),
          priority: r.priority ?? null,
          ttl: r.ttl || 3600,
          proxied: proxiedResult,
          comment: r.comment || defaultComment || null,
          cloudflare_record_id: cfRecordId,
          cloudflare_zone_id: zoneCtx.zoneId || null,
          sync_status: syncStatus,
        });
      }

      let insertedIds: string[] = [];
      if (db && rowsToInsert.length > 0) {
        const { data, error } = await db
          .from('domain_dns_records')
          .insert(rowsToInsert)
          .select('id');
        if (error) {
          return { ok: false as const, error: error.message };
        }
        insertedIds = (data || []).map((row: { id: string }) => row.id);
      }

      return { ok: true as const, insertedIds, rowsToInsert };
    };

    // 1. ADD SINGLE RECORD
    if (action === 'add_record') {
      if (!record) {
        return NextResponse.json({ success: false, error: 'Record details missing.' }, { status: 400 });
      }

      const validation = validateDnsRecord(record, existingRecords);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 422 });
      }

      const synced = await pushManyToCloudflareAndDb([record]);
      if (!synced.ok) {
        return NextResponse.json({ success: false, error: synced.error }, { status: 502 });
      }

      const insertedId = synced.insertedIds[0] || `dns_${Date.now()}`;
      const cfRecordId = synced.rowsToInsert[0]?.cloudflare_record_id || null;

      await logAudit(userId, 'DNS_RECORD_ADDED', `domain:${domainId}`, {
        type: record.type,
        name: record.name,
        content: record.content,
        cloudflareRecordId: cfRecordId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: isCloudflareConfigured()
          ? `DNS record ${record.type} (${record.name}) synced live to Cloudflare Anycast Edge.`
          : `DNS record ${record.type} for ${record.name} created in DEV_SANDBOX_MODE.`,
        recordId: insertedId,
        cloudflareRecordId: cfRecordId,
        cloudflareZoneId: zoneCtx.zoneId || null,
      });
    }

    // 2. APPLY PRESETS (Google, Zoho, Security Shield)
    if (action === 'apply_preset') {
      const targetDomain = zoneCtx.domainName || domainName || 'yourdomain.com';
      let presetRecords: Array<Omit<DnsRecord, 'id'>> = [];

      if (presetType === 'google') {
        presetRecords = getGoogleWorkspacePreset(targetDomain);
      } else if (presetType === 'zoho') {
        presetRecords = getZohoMailPreset(targetDomain);
      } else if (presetType === 'shield') {
        presetRecords = getEmailSecurityShieldPreset(targetDomain);
      } else {
        return NextResponse.json({ success: false, error: 'Unknown preset type.' }, { status: 400 });
      }

      const synced = await pushManyToCloudflareAndDb(
        presetRecords,
        `Preset: ${(presetType || '').toUpperCase()}`
      );
      if (!synced.ok) {
        return NextResponse.json({ success: false, error: synced.error }, { status: 502 });
      }

      await logAudit(userId, 'DNS_PRESET_APPLIED', `domain:${domainId}`, {
        presetType,
        cloudflareZoneId: zoneCtx.zoneId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `${(presetType || '').toUpperCase()} preset (${presetRecords.length} records) applied & synced.`,
        count: presetRecords.length,
        cloudflareZoneId: zoneCtx.zoneId || null,
      });
    }

    // 3. IMPORT BIND ZONE FILE
    if (action === 'import_bind_zone') {
      if (!bindText) {
        return NextResponse.json({ success: false, error: 'BIND zone file text is required.' }, { status: 400 });
      }

      const parsed = parseBindZone(bindText, zoneCtx.domainName || domainName || 'example.com');
      if (parsed.length === 0) {
        return NextResponse.json({ success: false, error: 'No valid resource records found in BIND text.' }, { status: 400 });
      }

      const validRecords = parsed.filter((r) => validateDnsRecord(r, existingRecords).valid);
      if (validRecords.length === 0) {
        return NextResponse.json({ success: false, error: 'Parsed records failed RFC validation.' }, { status: 422 });
      }

      const synced = await pushManyToCloudflareAndDb(validRecords, 'Imported via BIND Zone File');
      if (!synced.ok) {
        return NextResponse.json({ success: false, error: synced.error }, { status: 502 });
      }

      await logAudit(userId, 'BIND_ZONE_IMPORTED', `domain:${domainId}`, {
        count: validRecords.length,
        cloudflareZoneId: zoneCtx.zoneId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `Successfully imported and synced ${validRecords.length} DNS records from BIND zone file.`,
        importedCount: validRecords.length,
      });
    }

    // 4. 1-CLICK POINT DOMAIN TO HOSTING SERVER IP
    if (action === 'point_to_hosting') {
      const targetIp = serverIp || '103.151.102.45';
      const targetDomain = zoneCtx.domainName || domainName || 'yourdomain.com';
      const presets = getDevHostServerPreset(targetDomain, targetIp);

      const synced = await pushManyToCloudflareAndDb(presets, '1-Click Server Target');
      if (!synced.ok) {
        return NextResponse.json({ success: false, error: synced.error }, { status: 502 });
      }

      await logAudit(userId, 'DNS_POINTED_TO_HOSTING', `domain:${domainId}`, {
        targetIp,
        cloudflareZoneId: zoneCtx.zoneId,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `Apex (@), WWW, and Mail DNS records pointed to node ${targetIp} and synced with Cloudflare.`,
        cloudflareZoneId: zoneCtx.zoneId || null,
      });
    }

    // 5. PULL / RECONCILE LIVE CLOUDFLARE ZONE RECORDS INTO SUPABASE
    if (action === 'sync_from_cloudflare') {
      if (!isCloudflareConfigured() || !zoneCtx.zoneId) {
        return NextResponse.json({
          success: true,
          message: 'Cloudflare sync skipped in DEV_SANDBOX_MODE.',
          syncedCount: existingRecords.length,
        });
      }

      const listed = await listCloudflareDnsRecords(zoneCtx.zoneId);
      if (!listed.ok || !listed.result) {
        return NextResponse.json(
          { success: false, error: listed.error || 'Failed to read Cloudflare DNS records.' },
          { status: 502 }
        );
      }

      const supportedTypes = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA', 'PTR']);
      const filtered = listed.result.filter((r) => supportedTypes.has(r.type.toUpperCase()));

      if (db && filtered.length > 0) {
        for (const r of filtered) {
          const shortName =
            r.name.toLowerCase() === zoneCtx.domainName
              ? '@'
              : r.name.toLowerCase().replace(new RegExp(`\\.${zoneCtx.domainName}$`), '');
          const { data: existingCf } = await db
            .from('domain_dns_records')
            .select('id')
            .eq('domain_id', domainId)
            .eq('cloudflare_record_id', r.id)
            .maybeSingle();

          const payload = {
            domain_id: domainId,
            user_id: userId,
            record_type: r.type.toUpperCase(),
            name: shortName || '@',
            content: r.content,
            priority: r.priority ?? null,
            ttl: r.ttl || 3600,
            proxied: Boolean(r.proxied),
            comment: r.comment || null,
            cloudflare_record_id: r.id,
            cloudflare_zone_id: zoneCtx.zoneId,
            sync_status: 'synced',
            updated_at: new Date().toISOString(),
          };

          if (existingCf?.id) {
            await db.from('domain_dns_records').update(payload).eq('id', existingCf.id);
          } else {
            await db.from('domain_dns_records').insert(payload);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reconciled ${filtered.length} live DNS record(s) from Cloudflare Zone ${zoneCtx.zoneId}.`,
        syncedCount: filtered.length,
        cloudflareZoneId: zoneCtx.zoneId,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/domains/dns
 * Update an existing DNS record after RFC validation + sync to Cloudflare
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await request.json().catch(() => ({}))) as {
      recordId?: string;
      domainId?: string;
      record?: Omit<DnsRecord, 'id'>;
    };
    const { recordId, domainId, record } = body;

    if (!recordId || !domainId || !record) {
      return NextResponse.json({ success: false, error: 'Record ID, domain ID and record data required.' }, { status: 400 });
    }

    const access = await requireDomainAccess(request, { domainId });
    if (!access.ok) return access.response;
    const userId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS Engine');
    }

    if (!isCloudflareConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS API (CLOUDFLARE_DNS_API_TOKEN missing)');
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    let existingRecords: DnsRecord[] = [];
    let existingCfRecordId: string | null = null;
    if (db) {
      const { data } = await db.from('domain_dns_records').select('*').eq('domain_id', domainId);
      if (data) {
        const rows = data as DnsDbRow[];
        existingCfRecordId = rows.find((r) => r.id === recordId)?.cloudflare_record_id || null;
        existingRecords = rows.map((r) => ({
          id: r.id,
          type: r.record_type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
          proxied: Boolean(r.proxied),
        }));
      }
    }

    const validation = validateDnsRecord(record, existingRecords, recordId);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 422 });
    }

    const zoneCtx = await resolveZoneContext(db, domainId, access.domainName);
    if (!zoneCtx.ok) {
      return NextResponse.json({ success: false, error: zoneCtx.error }, { status: 502 });
    }

    let nextCfRecordId: string | null = existingCfRecordId;
    let nextProxied = Boolean(record.proxied);
    let syncStatus = isCloudflareConfigured() ? 'synced' : 'sandbox';

    if (isCloudflareConfigured() && zoneCtx.zoneId) {
      const cfRes = await upsertCloudflareDnsRecord(
        zoneCtx.zoneId,
        {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          priority: record.priority ?? null,
          proxied: record.proxied,
          comment: record.comment || null,
        },
        {
          existingCloudflareRecordId: existingCfRecordId,
          apexDomain: zoneCtx.domainName,
        }
      );
      if (!cfRes.ok) {
        return NextResponse.json(
          { success: false, error: cfRes.error || 'Cloudflare DNS update failed.' },
          { status: 502 }
        );
      }
      nextCfRecordId = cfRes.cloudflareRecordId || existingCfRecordId;
      nextProxied = Boolean(cfRes.proxied);
      syncStatus = 'synced';
    }

    if (db) {
      const { error } = await db
        .from('domain_dns_records')
        .update({
          name: (record.name || '@').trim(),
          content: record.content.trim(),
          priority: record.priority ?? null,
          ttl: record.ttl || 3600,
          proxied: nextProxied,
          comment: record.comment || null,
          cloudflare_record_id: nextCfRecordId,
          cloudflare_zone_id: zoneCtx.zoneId || null,
          sync_status: syncStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('domain_id', domainId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    await logAudit(userId, 'DNS_RECORD_UPDATED', `dns:${recordId}`, {
      type: record.type,
      name: record.name,
      content: record.content,
      cloudflareRecordId: nextCfRecordId,
    }, ip);

    return NextResponse.json({
      success: true,
      message: isCloudflareConfigured()
        ? 'DNS record updated & propagated to Cloudflare Anycast Edge.'
        : 'DNS record updated in DEV_SANDBOX_MODE.',
      cloudflareRecordId: nextCfRecordId,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains/dns?recordId=...&domainId=...
 * Remove an existing DNS record in Cloudflare and Supabase
 */
export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    let domainId = searchParams.get('domainId');

    if (!recordId) {
      return NextResponse.json({ success: false, error: 'Record ID is required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    let existingCfRecordId: string | null = null;
    let existingCfZoneId: string | null = null;
    if (db) {
      const { data: recOwner } = await db
        .from('domain_dns_records')
        .select('domain_id, cloudflare_record_id, cloudflare_zone_id')
        .eq('id', recordId)
        .maybeSingle();
      if (!domainId) {
        domainId = recOwner?.domain_id || null;
      }
      existingCfRecordId = recOwner?.cloudflare_record_id || null;
      existingCfZoneId = recOwner?.cloudflare_zone_id || null;
    }

    const access = await requireDomainAccess(request, { domainId });
    if (!access.ok) return access.response;
    const userId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS Engine');
    }

    if (!isCloudflareConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare Anycast DNS API (CLOUDFLARE_DNS_API_TOKEN missing)');
    }

    if (isCloudflareConfigured() && existingCfRecordId) {
      let zoneId = existingCfZoneId;
      if (!zoneId) {
        const zoneCtx = await resolveZoneContext(db, access.domainId || domainId, access.domainName);
        zoneId = zoneCtx.zoneId || null;
      }
      if (zoneId) {
        const cfDel = await deleteCloudflareDnsRecord(zoneId, existingCfRecordId);
        if (!cfDel.ok) {
          return NextResponse.json(
            { success: false, error: cfDel.error || 'Failed to delete record on Cloudflare.' },
            { status: 502 }
          );
        }
      }
    }

    if (db) {
      const delQuery = db.from('domain_dns_records').delete().eq('id', recordId);
      const { error } = access.domainId ? await delQuery.eq('domain_id', access.domainId) : await delQuery;
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    await logAudit(userId, 'DNS_RECORD_DELETED', `dns:${recordId}`, {
      domainId,
      cloudflareRecordId: existingCfRecordId,
    }, ip);

    return NextResponse.json({
      success: true,
      message: 'DNS record removed from Cloudflare & database successfully.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
