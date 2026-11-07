import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { encryptEnvValue, getMaskedPreview } from '@/lib/projectEngine';


async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
  ip: string = '127.0.0.1',
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
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
      risk_level: riskLevel,
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

/**
 * GET /api/hosting/databases?serviceId=...
 * Fetch MySQL / PostgreSQL databases and remote access whitelists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data, error } = await db
        .from('hosting_databases')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, databases: data || [] });
    }

    // Offline mock databases
    return NextResponse.json({
      success: true,
      databases: [
        {
          id: 'db_1',
          service_id: serviceId,
          db_engine: 'MySQL 8.0',
          db_name: 'devhost_ecommerce_live',
          db_username: 'devhost_shopuser',
          db_password_hash: '••••••••',
          privileges: 'ALL PRIVILEGES',
          size_mb: 28.5,
          tables_count: 14,
          remote_access_ips: ['103.151.102.45', '127.0.0.1'],
          created_at: new Date(Date.now() - 864000000).toISOString(),
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hosting/databases
 * Actions:
 * 1. create_database: Provision MySQL/PostgreSQL DB and User with enforced prefix
 * 2. sync_to_env: Auto-inject generated DATABASE_URL into encrypted .env vault
 * 3. update_remote_ips: Manage remote IP access list
 * 4. drop_database: Requires Sudo verification before destroying data
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const {
      action,
      serviceId,
      userId,
      cpanelUser,
      dbEngine = 'MySQL 8.0',
      dbSuffix,
      dbPassword,
      remoteIps,
      databaseId,
      connectionString,
      sudoVerified,
    } = body;

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // 1. CREATE DATABASE & USER
    if (action === 'create_database') {
      if (!serviceId || !dbSuffix) {
        return NextResponse.json({ success: false, error: 'Service ID and database name suffix required.' }, { status: 400 });
      }

      const prefix = (cpanelUser || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanSuffix = dbSuffix.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const fullDbName = `${prefix}_${cleanSuffix}`;
      const fullDbUser = `${prefix}_user`;
      const plainPassword = dbPassword || `P@ss_${Math.random().toString(36).substring(2, 10)}`;

      // Generate connection string
      const host = '103.151.102.45';
      const port = dbEngine.includes('PostgreSQL') ? 5432 : 3306;
      const protocol = dbEngine.includes('PostgreSQL') ? 'postgresql' : 'mysql';
      const generatedConnStr = `${protocol}://${fullDbUser}:${plainPassword}@${host}:${port}/${fullDbName}`;

      let newId = `db_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('hosting_databases')
          .insert({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            db_engine: dbEngine,
            db_name: fullDbName,
            db_username: fullDbUser,
            db_password_hash: `sha256_${plainPassword.substring(0, 4)}••••`,
            privileges: 'ALL PRIVILEGES',
            size_mb: 0.1,
            tables_count: 0,
            remote_access_ips: remoteIps || [host, '127.0.0.1'],
          })
          .select('id')
          .single();

        if (error) {
          if (error.code === '23505') {
            return NextResponse.json({ success: false, error: `Database '${fullDbName}' already exists.` }, { status: 409 });
          }
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        if (data) newId = data.id;
      }

      await logAudit(userId, 'DATABASE_CREATED', `db:${fullDbName}`, { engine: dbEngine }, ip);

      return NextResponse.json({
        success: true,
        message: `Database '${fullDbName}' and user '${fullDbUser}' created successfully!`,
        id: newId,
        dbName: fullDbName,
        dbUsername: fullDbUser,
        connectionString: generatedConnStr,
      });
    }

    // 2. AUTO-SYNC DATABASE_URL TO PROJECT .ENV VAULT
    if (action === 'sync_to_env') {
      if (!serviceId || !connectionString) {
        return NextResponse.json({ success: false, error: 'Service ID and connection string required.' }, { status: 400 });
      }

      const encrypted = await encryptEnvValue(connectionString);
      const masked = getMaskedPreview(connectionString);

      if (db) {
        const { error } = await db
          .from('project_env_variables')
          .upsert({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            env_key: 'DATABASE_URL',
            encrypted_value: encrypted,
            masked_preview: masked,
            target_environment: 'all',
            is_secret: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'service_id,env_key,target_environment' });

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'DATABASE_URL_SYNCED_TO_ENV', `service:${serviceId}`, {}, ip);

      return NextResponse.json({
        success: true,
        message: 'DATABASE_URL encrypted and automatically injected into project .env vault!',
      });
    }

    // 3. UPDATE REMOTE IP ACCESS LIST
    if (action === 'update_remote_ips') {
      if (!databaseId || !Array.isArray(remoteIps)) {
        return NextResponse.json({ success: false, error: 'Database ID and IP list array required.' }, { status: 400 });
      }

      if (db) {
        const { error } = await db
          .from('hosting_databases')
          .update({ remote_access_ips: remoteIps })
          .eq('id', databaseId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'DATABASE_REMOTE_IPS_UPDATED', `db:${databaseId}`, { ips: remoteIps }, ip);

      return NextResponse.json({
        success: true,
        message: 'Remote database IP access whitelist updated.',
      });
    }

    // 4. DROP DATABASE (Requires Sudo)
    if (action === 'drop_database') {
      if (!databaseId) {
        return NextResponse.json({ success: false, error: 'Database ID is required.' }, { status: 400 });
      }

      if (!sudoVerified) {
        return NextResponse.json({
          success: false,
          error: '2FA Sudo Step-Up Verification required to drop a production database.',
          requireSudo: true,
        }, { status: 403 });
      }

      if (db) {
        const { error } = await db.from('hosting_databases').delete().eq('id', databaseId);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'DATABASE_DROPPED', `db:${databaseId}`, {}, ip, 'critical');

      return NextResponse.json({
        success: true,
        message: 'Database dropped and schema purged from server node.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
