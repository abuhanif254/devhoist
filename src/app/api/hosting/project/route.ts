import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import {
  encryptEnvValue,
  decryptEnvValue,
  getMaskedPreview,
  parseDotEnvFile,
  validateShellCommand,
} from '@/lib/projectEngine';

export const runtime = 'edge';

async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
  ip: string = '127.0.0.1',
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
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
 * GET /api/hosting/project?serviceId=...
 * Fetch project build settings & encrypted environment variables
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

      // 1. Fetch Project Settings
      const { data: settings } = await db
        .from('hosting_project_settings')
        .select('*')
        .eq('service_id', serviceId)
        .single();

      // 2. Fetch Environment Variables
      const { data: envVars } = await db
        .from('project_env_variables')
        .select('id, env_key, masked_preview, target_environment, is_secret, updated_at')
        .eq('service_id', serviceId)
        .order('env_key', { ascending: true });

      return NextResponse.json({
        success: true,
        settings: settings || {
          framework_preset: 'nextjs_standalone',
          runtime_version: 'Node.js 22 LTS',
          root_directory: './',
          install_command: 'npm ci',
          build_command: 'npm run build',
          output_directory: '.next/standalone',
          startup_file: 'server.js',
          git_repo_url: '',
          production_branch: 'main',
          auto_deploy_on_push: true,
          webhook_secret_token: 'whsec_demo_placeholder_token_8899',
          litespeed_cache_enabled: true,
          redis_object_cache_enabled: true,
        },
        envVariables: envVars || [],
      });
    }

    // Offline fallback
    return NextResponse.json({
      success: true,
      settings: {
        framework_preset: 'nextjs_standalone',
        runtime_version: 'Node.js 22 LTS',
        root_directory: './',
        install_command: 'npm ci',
        build_command: 'npm run build',
        output_directory: '.next/standalone',
        startup_file: 'server.js',
        git_repo_url: 'https://github.com/abuhanif254/devhoist',
        production_branch: 'main',
        auto_deploy_on_push: true,
        webhook_secret_token: 'whsec_e39f8290bc91a783421d',
        litespeed_cache_enabled: true,
        redis_object_cache_enabled: true,
      },
      envVariables: [
        { id: 'env_1', env_key: 'NODE_ENV', masked_preview: '••••••••tion', target_environment: 'all', is_secret: false },
        { id: 'env_2', env_key: 'DATABASE_URL', masked_preview: 'mysql://••••••••45:3306', target_environment: 'all', is_secret: true },
        { id: 'env_3', env_key: 'STRIPE_SECRET_KEY', masked_preview: 'sk_live_••••••••88ef', target_environment: 'production', is_secret: true },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/hosting/project
 * Update build settings, runtime version, or cache toggles with command sanitization
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const { serviceId, userId, settings } = body;

    if (!serviceId || !settings) {
      return NextResponse.json({ success: false, error: 'Service ID and settings required.' }, { status: 400 });
    }

    // Security Firewall: Sanitize build and install commands
    if (settings.build_command) {
      const check = validateShellCommand(settings.build_command);
      if (!check.allowed) {
        await logAudit(userId, 'COMMAND_INJECTION_BLOCKED', `service:${serviceId}`, {
          command: settings.build_command,
          field: 'build_command',
        }, ip, 'critical');
        return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
      }
    }

    if (settings.install_command) {
      const check = validateShellCommand(settings.install_command);
      if (!check.allowed) {
        await logAudit(userId, 'COMMAND_INJECTION_BLOCKED', `service:${serviceId}`, {
          command: settings.install_command,
          field: 'install_command',
        }, ip, 'critical');
        return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
      }
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { error } = await db
        .from('hosting_project_settings')
        .upsert({
          service_id: serviceId,
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await logAudit(userId, 'PROJECT_SETTINGS_UPDATED', `service:${serviceId}`, {
      preset: settings.framework_preset,
      runtime: settings.runtime_version,
    }, ip, 'medium');

    return NextResponse.json({
      success: true,
      message: 'Project runtime & build configurations successfully saved.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hosting/project
 * Actions:
 * 1. add_env: Add a single encrypted .env variable
 * 2. bulk_import_env: Parse & encrypt 20+ lines of raw .env
 * 3. reveal_secret: Sudo-verified plaintext decryption
 * 4. regenerate_webhook_token: Issue new GitHub webhook secret
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const {
      action,
      serviceId,
      userId,
      key,
      value,
      targetEnvironment = 'all',
      isSecret = true,
      rawEnvText,
      envId,
      sudoVerified,
    } = body;

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // 1. ADD SINGLE ENV VARIABLE
    if (action === 'add_env') {
      if (!serviceId || !key || value === undefined) {
        return NextResponse.json({ success: false, error: 'Service ID, Key, and Value are required.' }, { status: 400 });
      }

      const cleanKey = key.trim().toUpperCase();
      const keyRegex = /^[A-Z_][A-Z0-9_]*$/;
      if (!keyRegex.test(cleanKey)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid key syntax. Keys must start with a letter and contain only uppercase letters, numbers, and underscores.',
        }, { status: 422 });
      }

      const encrypted = await encryptEnvValue(value);
      const masked = getMaskedPreview(value);

      let newId = `env_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('project_env_variables')
          .upsert({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            env_key: cleanKey,
            encrypted_value: encrypted,
            masked_preview: masked,
            target_environment: targetEnvironment,
            is_secret: Boolean(isSecret),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'service_id,env_key,target_environment' })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;
      }

      await logAudit(userId, 'ENV_VARIABLE_SAVED', `service:${serviceId}`, { key: cleanKey, env: targetEnvironment }, ip);

      return NextResponse.json({
        success: true,
        message: `Environment variable ${cleanKey} encrypted and stored in AES-256 vault.`,
        id: newId,
        maskedPreview: masked,
      });
    }

    // 2. BULK IMPORT .ENV FILE
    if (action === 'bulk_import_env') {
      if (!serviceId || !rawEnvText) {
        return NextResponse.json({ success: false, error: 'Raw .env text is required.' }, { status: 400 });
      }

      const parsed = parseDotEnvFile(rawEnvText);
      const validItems = parsed.filter((p) => p.isValid);

      if (validItems.length === 0) {
        return NextResponse.json({ success: false, error: 'No valid environment variables found in file.' }, { status: 422 });
      }

      if (db) {
        const rows = [];
        for (const item of validItems) {
          const enc = await encryptEnvValue(item.value);
          const mask = getMaskedPreview(item.value);
          rows.push({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            env_key: item.key,
            encrypted_value: enc,
            masked_preview: mask,
            target_environment: targetEnvironment,
            is_secret: true,
            updated_at: new Date().toISOString(),
          });
        }

        const { error } = await db
          .from('project_env_variables')
          .upsert(rows, { onConflict: 'service_id,env_key,target_environment' });

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'BULK_ENV_IMPORTED', `service:${serviceId}`, { count: validItems.length }, ip);

      return NextResponse.json({
        success: true,
        message: `Successfully encrypted and imported ${validItems.length} environment variables.`,
        count: validItems.length,
      });
    }

    // 3. REVEAL SECRET VALUE (Requires Sudo)
    if (action === 'reveal_secret') {
      if (!envId) {
        return NextResponse.json({ success: false, error: 'Environment variable ID is required.' }, { status: 400 });
      }

      if (!sudoVerified) {
        return NextResponse.json({
          success: false,
          error: '2FA Sudo Step-Up Verification required to decrypt secret environment variables.',
          requireSudo: true,
        }, { status: 403 });
      }

      let plaintext = 'demo_plaintext_secret_value_123';
      if (db) {
        const { data, error } = await db
          .from('project_env_variables')
          .select('encrypted_value, env_key')
          .eq('id', envId)
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data && data.encrypted_value) {
          plaintext = await decryptEnvValue(data.encrypted_value);
        }
      }

      await logAudit(userId, 'ENV_SECRET_REVEALED', `env:${envId}`, {}, ip, 'high');

      return NextResponse.json({
        success: true,
        plaintextValue: plaintext,
      });
    }

    // 4. REGENERATE WEBHOOK SECRET
    if (action === 'regenerate_webhook_token') {
      if (!serviceId) {
        return NextResponse.json({ success: false, error: 'Service ID required.' }, { status: 400 });
      }

      const randomBytes = crypto.getRandomValues(new Uint8Array(24));
      const newToken = 'whsec_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      if (db) {
        const { error } = await db
          .from('hosting_project_settings')
          .update({
            webhook_secret_token: newToken,
            updated_at: new Date().toISOString(),
          })
          .eq('service_id', serviceId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'WEBHOOK_SECRET_REGENERATED', `service:${serviceId}`, {}, ip, 'high');

      return NextResponse.json({
        success: true,
        webhookSecretToken: newToken,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/hosting/project?envId=...&serviceId=...
 * Remove an environment variable
 */
export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const envId = searchParams.get('envId');
    const serviceId = searchParams.get('serviceId');
    const userId = searchParams.get('userId');

    if (!envId) {
      return NextResponse.json({ success: false, error: 'Environment variable ID required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { error } = await db.from('project_env_variables').delete().eq('id', envId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await logAudit(userId, 'ENV_VARIABLE_DELETED', `env:${envId}`, { serviceId }, ip);

    return NextResponse.json({
      success: true,
      message: 'Environment variable deleted.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
