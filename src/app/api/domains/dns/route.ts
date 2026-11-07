import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import {
  validateDnsRecord,
  parseBindZone,
  getGoogleWorkspacePreset,
  getZohoMailPreset,
  getEmailSecurityShieldPreset,
  getDevHostServerPreset,
} from '@/lib/dnsEngine';
import { DnsRecord } from '@/context/PortalContext';


// Helper to log actions into security_audit_logs
async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
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

      // Format back to DnsRecord interface
      const records: DnsRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.record_type,
        name: row.name,
        content: row.content,
        ttl: row.ttl,
        priority: row.priority,
        proxied: row.proxied,
        comment: row.comment,
        isSystemManaged: row.is_system_managed,
      }));

      return NextResponse.json({ success: true, records });
    }

    // Offline / fallback mock records
    return NextResponse.json({
      success: true,
      records: [
        { id: 'offline_1', type: 'A', name: '@', content: '103.151.102.45', ttl: 3600, proxied: true },
        { id: 'offline_2', type: 'CNAME', name: 'www', content: '@', ttl: 3600, proxied: true },
        { id: 'offline_3', type: 'MX', name: '@', content: 'mail.devhost.net', priority: 10, ttl: 3600, proxied: false },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/domains/dns
 * Actions:
 * 1. add_record
 * 2. apply_preset (google | zoho | shield)
 * 3. import_bind_zone
 * 4. point_to_hosting
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const { action, domainId, domainName, userId, record, presetType, bindText, serverIp } = body;

    if (!domainId) {
      return NextResponse.json({ success: false, error: 'Domain ID is required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // Fetch existing records for RFC CNAME conflict checking
    let existingRecords: DnsRecord[] = [];
    if (db) {
      const { data } = await db.from('domain_dns_records').select('*').eq('domain_id', domainId);
      if (data) {
        existingRecords = data.map((r: any) => ({
          id: r.id,
          type: r.record_type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority,
          proxied: r.proxied,
        }));
      }
    }

    // 1. ADD SINGLE RECORD
    if (action === 'add_record') {
      if (!record) {
        return NextResponse.json({ success: false, error: 'Record details missing.' }, { status: 400 });
      }

      // RFC 1035 / 2181 Validation
      const validation = validateDnsRecord(record, existingRecords);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 422 });
      }

      let insertedId = `dns_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('domain_dns_records')
          .insert({
            domain_id: domainId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            record_type: record.type,
            name: (record.name || '@').trim(),
            content: record.content.trim(),
            priority: record.priority ?? null,
            ttl: record.ttl || 3600,
            proxied: Boolean(record.proxied),
            comment: record.comment || null,
          })
          .select('id')
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        if (data) insertedId = data.id;
      }

      await logAudit(userId, 'DNS_RECORD_ADDED', `domain:${domainId}`, {
        type: record.type,
        name: record.name,
        content: record.content,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `DNS record ${record.type} for ${record.name} created successfully.`,
        recordId: insertedId,
      });
    }

    // 2. APPLY PRESETS (Google, Zoho, Security Shield)
    if (action === 'apply_preset') {
      const targetDomain = domainName || 'yourdomain.com';
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

      if (db) {
        const rows = presetRecords.map((r) => ({
          domain_id: domainId,
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          record_type: r.type,
          name: r.name,
          content: r.content,
          priority: r.priority ?? null,
          ttl: r.ttl || 3600,
          proxied: Boolean(r.proxied),
          comment: `Preset: ${presetType.toUpperCase()}`,
        }));

        const { error } = await db.from('domain_dns_records').insert(rows);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }

      await logAudit(userId, 'DNS_PRESET_APPLIED', `domain:${domainId}`, { presetType }, ip);

      return NextResponse.json({
        success: true,
        message: `${presetType.toUpperCase()} preset (${presetRecords.length} records) applied successfully.`,
        count: presetRecords.length,
      });
    }

    // 3. IMPORT BIND ZONE FILE
    if (action === 'import_bind_zone') {
      if (!bindText) {
        return NextResponse.json({ success: false, error: 'BIND zone file text is required.' }, { status: 400 });
      }

      const parsed = parseBindZone(bindText, domainName || 'example.com');
      if (parsed.length === 0) {
        return NextResponse.json({ success: false, error: 'No valid resource records found in BIND text.' }, { status: 400 });
      }

      // Validate each parsed record
      const validRows: any[] = [];
      for (const r of parsed) {
        const v = validateDnsRecord(r, existingRecords);
        if (v.valid) {
          validRows.push({
            domain_id: domainId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            record_type: r.type,
            name: r.name,
            content: r.content,
            priority: r.priority ?? null,
            ttl: r.ttl || 3600,
            proxied: Boolean(r.proxied),
            comment: 'Imported via BIND Zone File',
          });
        }
      }

      if (db && validRows.length > 0) {
        const { error } = await db.from('domain_dns_records').insert(validRows);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }

      await logAudit(userId, 'BIND_ZONE_IMPORTED', `domain:${domainId}`, { count: validRows.length }, ip);

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${validRows.length} DNS records from BIND zone file.`,
        importedCount: validRows.length,
      });
    }

    // 4. 1-CLICK POINT DOMAIN TO HOSTING SERVER IP
    if (action === 'point_to_hosting') {
      const targetIp = serverIp || '103.151.102.45';
      const targetDomain = domainName || 'yourdomain.com';
      const presets = getDevHostServerPreset(targetDomain, targetIp);

      if (db) {
        const rows = presets.map((r) => ({
          domain_id: domainId,
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          record_type: r.type,
          name: r.name,
          content: r.content,
          priority: r.priority ?? null,
          ttl: r.ttl || 300,
          proxied: Boolean(r.proxied),
          comment: r.comment || '1-Click Server Target',
        }));

        const { error } = await db.from('domain_dns_records').insert(rows);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }

      await logAudit(userId, 'DNS_POINTED_TO_HOSTING', `domain:${domainId}`, { targetIp }, ip);

      return NextResponse.json({
        success: true,
        message: `Apex (@), WWW, and Mail DNS records successfully pointed to node ${targetIp}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/domains/dns
 * Update an existing DNS record after RFC validation
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const { recordId, domainId, userId, record } = body;

    if (!recordId || !domainId || !record) {
      return NextResponse.json({ success: false, error: 'Record ID, domain ID and record data required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    let existingRecords: DnsRecord[] = [];
    if (db) {
      const { data } = await db.from('domain_dns_records').select('*').eq('domain_id', domainId);
      if (data) {
        existingRecords = data.map((r: any) => ({
          id: r.id,
          type: r.record_type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          priority: r.priority,
          proxied: r.proxied,
        }));
      }
    }

    const validation = validateDnsRecord(record, existingRecords, recordId);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 422 });
    }

    if (db) {
      const { error } = await db
        .from('domain_dns_records')
        .update({
          name: (record.name || '@').trim(),
          content: record.content.trim(),
          priority: record.priority ?? null,
          ttl: record.ttl || 3600,
          proxied: Boolean(record.proxied),
          comment: record.comment || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    await logAudit(userId, 'DNS_RECORD_UPDATED', `dns:${recordId}`, {
      type: record.type,
      name: record.name,
      content: record.content,
    }, ip);

    return NextResponse.json({
      success: true,
      message: 'DNS record updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/domains/dns?recordId=...&domainId=...
 * Remove an existing DNS record
 */
export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const domainId = searchParams.get('domainId');
    const userId = searchParams.get('userId');

    if (!recordId) {
      return NextResponse.json({ success: false, error: 'Record ID is required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { error } = await db.from('domain_dns_records').delete().eq('id', recordId);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    await logAudit(userId, 'DNS_RECORD_DELETED', `dns:${recordId}`, { domainId }, ip);

    return NextResponse.json({
      success: true,
      message: 'DNS record removed successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
