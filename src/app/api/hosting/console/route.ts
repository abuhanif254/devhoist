import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import {
  validateContainerCommand,
  validateScopedSqlQuery,
  logSecurityAudit,
} from '@/lib/security';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  execContainerCommandOnAgent,
  execSqlQueryOnAgent,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { resolveServiceComputeTarget } from '@/lib/computeTargetResolver';

interface SqlTableSchema {
  tableName: string;
  engine: string;
  rowCount: number;
  sizeKB: number;
  columns: { name: string; type: string; key?: string }[];
}

const CONTAINER_SQL_SCHEMA: SqlTableSchema[] = [
  {
    tableName: 'users',
    engine: 'InnoDB (NVMe)',
    rowCount: 1428,
    sizeKB: 512,
    columns: [
      { name: 'id', type: 'bigint unsigned', key: 'PRI' },
      { name: 'full_name', type: 'varchar(160)' },
      { name: 'email', type: 'varchar(191)', key: 'UNI' },
      { name: 'role', type: 'enum(customer,admin,editor)' },
      { name: 'status', type: 'varchar(32)' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  {
    tableName: 'orders',
    engine: 'InnoDB (NVMe)',
    rowCount: 3890,
    sizeKB: 1240,
    columns: [
      { name: 'id', type: 'bigint unsigned', key: 'PRI' },
      { name: 'order_no', type: 'varchar(40)', key: 'UNI' },
      { name: 'user_id', type: 'bigint unsigned', key: 'MUL' },
      { name: 'total_bdt', type: 'decimal(10,2)' },
      { name: 'payment_gateway', type: 'varchar(32)' },
      { name: 'status', type: 'varchar(32)' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  {
    tableName: 'products',
    engine: 'InnoDB (NVMe)',
    rowCount: 245,
    sizeKB: 192,
    columns: [
      { name: 'id', type: 'bigint unsigned', key: 'PRI' },
      { name: 'sku', type: 'varchar(64)', key: 'UNI' },
      { name: 'title', type: 'varchar(255)' },
      { name: 'price_bdt', type: 'decimal(10,2)' },
      { name: 'stock_qty', type: 'int' },
    ],
  },
  {
    tableName: 'sessions',
    engine: 'MEMORY / Redis-Bridge',
    rowCount: 84,
    sizeKB: 64,
    columns: [
      { name: 'id', type: 'varchar(128)', key: 'PRI' },
      { name: 'user_id', type: 'bigint unsigned', key: 'MUL' },
      { name: 'ip_address', type: 'varchar(45)' },
      { name: 'last_activity', type: 'int' },
    ],
  },
  {
    tableName: 'migrations',
    engine: 'InnoDB (NVMe)',
    rowCount: 18,
    sizeKB: 16,
    columns: [
      { name: 'id', type: 'int unsigned', key: 'PRI' },
      { name: 'migration', type: 'varchar(255)' },
      { name: 'batch', type: 'int' },
    ],
  },
];

function executeJailedSshCommand(rawCmd: string, domain: string, username: string): {
  output: string;
  executionTimeMs: number;
} {
  const cmd = rawCmd.trim();
  const lower = cmd.toLowerCase();
  const now = new Date().toISOString();

  if (lower === 'help') {
    return {
      executionTimeMs: 4,
      output: [
        `DevHost CloudLinux Jailed SSH Sandbox v4.8 (${domain})`,
        `Available developer commands:`,
        `  ls -la                        List directory contents & octal permissions`,
        `  pwd                           Print active container working directory`,
        `  whoami                        Show isolated CageFS container user`,
        `  node -v / npm list            Check Node.js runtime & installed packages`,
        `  npm run build                 Run production Next.js / Vite bundle build`,
        `  php -v                        Show PHP CLI & OPcache JIT status`,
        `  php artisan migrate --status  Inspect Laravel database migrations`,
        `  php artisan cache:clear       Flush Laravel application & route cache`,
        `  php artisan route:list        Display registered API & web routes`,
        `  python3 --version             Verify Python ASGI/WSGI virtual environment`,
        `  git status / git log -n 5     Inspect Git working tree & recent commits`,
        `  pm2 status                    Check Phusion Passenger & worker processes`,
        `  top / free -m                 Inspect real-time container CPU & DDR5 RAM`,
        `  cat .htaccess                 View OpenLiteSpeed rewrite & Passenger rules`,
      ].join('\n'),
    };
  }

  if (lower === 'pwd') {
    return {
      executionTimeMs: 3,
      output: `/home/${username}/public_html`,
    };
  }

  if (lower === 'whoami') {
    return {
      executionTimeMs: 3,
      output: `${username} (uid=1042 gid=1042 groups=1042,cagefs-jail)`,
    };
  }

  if (lower.startsWith('ls')) {
    return {
      executionTimeMs: 8,
      output: [
        `total 64`,
        `drwxr-xr-x  6 ${username} ${username} 4096 ${now.slice(0, 10)} .`,
        `drwx--x--x 11 ${username} ${username} 4096 ${now.slice(0, 10)} ..`,
        `-rw-r--r--  1 ${username} ${username}  495 ${now.slice(0, 10)} .htaccess`,
        `-rw-------  1 ${username} ${username}  312 ${now.slice(0, 10)} .env.production`,
        `drwxr-xr-x  8 ${username} ${username} 4096 ${now.slice(0, 10)} .next`,
        `-rw-r--r--  1 ${username} ${username}  312 ${now.slice(0, 10)} next.config.mjs`,
        `drwxr-xr-x 84 ${username} ${username} 4096 ${now.slice(0, 10)} node_modules`,
        `-rw-r--r--  1 ${username} ${username}  418 ${now.slice(0, 10)} package.json`,
        `-rwxr-xr-x  1 ${username} ${username}  280 ${now.slice(0, 10)} passenger_wsgi.py`,
        `-rwxr-xr-x  1 ${username} ${username}  542 ${now.slice(0, 10)} server.js`,
      ].join('\n'),
    };
  }

  if (lower === 'node -v' || lower === 'node --version') {
    return { executionTimeMs: 6, output: `v20.12.2 (CloudLinux CageFS Isolated)` };
  }

  if (lower.startsWith('npm list')) {
    return {
      executionTimeMs: 42,
      output: [
        `${domain.replace(/[^a-z0-9-]/gi, '-')}@2.4.0 /home/${username}/public_html`,
        `├── @supabase/supabase-js@2.48.0`,
        `├── next@15.1.0`,
        `├── prisma@5.22.0`,
        `├── react@19.0.0`,
        `├── react-dom@19.0.0`,
        `└── tailwindcss@3.4.15`,
      ].join('\n'),
    };
  }

  if (lower === 'npm run build') {
    return {
      executionTimeMs: 420,
      output: [
        `> ${domain}@2.4.0 build`,
        `> next build`,
        `  ▲ Next.js 15.1.0`,
        `  - Environments: .env.production`,
        `  ✓ Creating an optimized production build ...`,
        `  ✓ Compiled successfully in 2.4s`,
        `  ✓ Collecting page data ...`,
        `  ✓ Generating static pages (14/14)`,
        `  ✓ Finalizing page optimization ...`,
        `Route (app)                              Size     First Load JS`,
        `┌ ○ /                                    4.8 kB         98.2 kB`,
        `├ ƒ /api/health                          0 B                0 B`,
        `└ ƒ /dashboard                           11.4 kB        112 kB`,
        `[Passenger] Signaled zero-downtime worker reload on ${domain}.`,
      ].join('\n'),
    };
  }

  if (lower === 'php -v' || lower === 'php --version') {
    return {
      executionTimeMs: 9,
      output: [
        `PHP 8.3.12 (litespeed) (built: Oct 24 2026 14:12:08) (NTS)`,
        `Copyright (c) The PHP Group`,
        `Zend Engine v4.3.12, Copyright (c) Zend Technologies`,
        `    with Zend OPcache v8.3.12, Copyright (c), by Zend Technologies`,
      ].join('\n'),
    };
  }

  if (lower.includes('artisan migrate')) {
    return {
      executionTimeMs: 36,
      output: [
        `  Migration name ................................................. Batch / Status`,
        `  0001_01_01_000000_create_users_table ........................... [1] Ran`,
        `  0001_01_01_000001_create_cache_table ........................... [1] Ran`,
        `  0001_01_01_000002_create_jobs_table ............................ [1] Ran`,
        `  2026_10_15_091200_create_orders_and_payments_table ............. [2] Ran`,
        `  2026_11_02_142000_add_bdix_edge_indexes ........................ [3] Ran`,
      ].join('\n'),
    };
  }

  if (lower.includes('artisan cache:clear') || lower.includes('artisan optimize:clear')) {
    return {
      executionTimeMs: 28,
      output: [
        `   INFO  Application cache cleared successfully.`,
        `   INFO  Route & View OPcache flushed on OpenLiteSpeed worker.`,
      ].join('\n'),
    };
  }

  if (lower.includes('artisan route:list')) {
    return {
      executionTimeMs: 31,
      output: [
        `  GET|HEAD   / .................................... home › HomeController@index`,
        `  POST       api/v1/checkout ...................... api.checkout › OrderController@store`,
        `  GET|HEAD   api/v1/orders ........................ api.orders › OrderController@index`,
        `  POST       api/v1/webhooks/bkash ................ webhooks.bkash › BkashWebhookController`,
        `  Showing [4] routes`,
      ].join('\n'),
    };
  }

  if (lower.startsWith('python3') || lower.startsWith('python ')) {
    return {
      executionTimeMs: 7,
      output: `Python 3.12.6 (CloudLinux virtualenv /home/${username}/virtualenv/public_html/3.12)`,
    };
  }

  if (lower === 'git status') {
    return {
      executionTimeMs: 12,
      output: [
        `On branch main`,
        `Your branch is up to date with 'origin/main'.`,
        `nothing to commit, working tree clean`,
      ].join('\n'),
    };
  }

  if (lower.startsWith('git log')) {
    return {
      executionTimeMs: 14,
      output: [
        `commit 96f6d2b (HEAD -> main, origin/main) — feat: production zero-downtime release`,
        `commit d36e064 — perf: enable Redis object cache & LiteSpeed QUIC`,
        `commit a48c910 — feat: configure SSL TLS 1.3 & BDIX edge headers`,
        `commit 71bc204 — chore: initialize database schema migrations`,
        `commit 19e041a — init: scaffold production stack via DevHost Provisioner`,
      ].join('\n'),
    };
  }

  if (lower === 'pm2 status' || lower === 'passenger-status') {
    return {
      executionTimeMs: 16,
      output: [
        `┌────┬────────────────────────┬─────────┬──────┬───────────┬──────────┬──────────┐`,
        `│ id │ name                   │ mode    │ ↺    │ status    │ cpu      │ memory   │`,
        `├────┼────────────────────────┼─────────┼──────┼───────────┼──────────┼──────────┤`,
        `│ 0  │ ${domain.slice(0, 22).padEnd(22, ' ')} │ cluster │ 0    │ online    │ 0.8%     │ 142.4mb  │`,
        `│ 1  │ queue-worker           │ fork    │ 0    │ online    │ 0.2%     │ 58.1mb   │`,
        `└────┴────────────────────────┴─────────┴──────┴───────────┴──────────┴──────────┘`,
      ].join('\n'),
    };
  }

  if (lower === 'top' || lower === 'free -m') {
    return {
      executionTimeMs: 10,
      output: [
        `              total        used        free      shared  buff/cache   available`,
        `Mem:           2048         412        1180          24         456        1636`,
        `Swap:             0           0           0`,
        `Container LVE Limits: CPU 12% / 200% | IOPS 48 / 5000 | Entry Processes 2 / 40 | Status: HEALTHY`,
      ].join('\n'),
    };
  }

  if (lower === 'cat .htaccess' || lower === 'cat /public_html/.htaccess') {
    return {
      executionTimeMs: 6,
      output: [
        `PassengerEnabled On`,
        `PassengerAppRoot "/home/${username}/public_html"`,
        `PassengerAppType node`,
        `PassengerStartupFile server.js`,
        `CacheLookup on`,
      ].join('\n'),
    };
  }

  return {
    executionTimeMs: 11,
    output: `[Jailed-SSH ${username}@${domain}]$ Executed: ${cmd}\nExit code: 0 (CloudLinux CageFS Sandbox Verified)`,
  };
}

function executeSqlRunnerQuery(rawQuery: string): {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  notice?: string;
} {
  const query = rawQuery.trim();
  const upper = query.toUpperCase();

  if (upper.startsWith('EXPLAIN')) {
    return {
      executionTimeMs: 4,
      columns: ['id', 'select_type', 'table', 'type', 'possible_keys', 'key', 'rows', 'Extra'],
      rowCount: 1,
      rows: [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: upper.includes('ORDERS') ? 'orders' : 'users',
          type: 'index_merge',
          possible_keys: 'PRIMARY,idx_created_at',
          key: 'PRIMARY',
          rows: 12,
          Extra: 'Using index condition; Using NVMe IO_CACHE (1.8ms)',
        },
      ],
    };
  }

  if (upper.includes('FROM ORDERS')) {
    return {
      executionTimeMs: 6,
      columns: ['id', 'order_no', 'user_id', 'total_bdt', 'payment_gateway', 'status', 'created_at'],
      rowCount: 4,
      rows: [
        { id: 1094, order_no: 'ORD-2026-9941', user_id: 101, total_bdt: 4320.0, payment_gateway: 'bkash', status: 'paid', created_at: '2026-11-08 09:14:22' },
        { id: 1093, order_no: 'ORD-2026-9940', user_id: 104, total_bdt: 1920.0, payment_gateway: 'nagad', status: 'paid', created_at: '2026-11-08 08:42:10' },
        { id: 1092, order_no: 'ORD-2026-9939', user_id: 112, total_bdt: 8640.0, payment_gateway: 'stripe', status: 'paid', created_at: '2026-11-07 21:18:05' },
        { id: 1091, order_no: 'ORD-2026-9938', user_id: 119, total_bdt: 1350.0, payment_gateway: 'bkash', status: 'completed', created_at: '2026-11-07 18:05:49' },
      ],
    };
  }

  if (upper.includes('FROM PRODUCTS')) {
    return {
      executionTimeMs: 5,
      columns: ['id', 'sku', 'title', 'price_bdt', 'stock_qty'],
      rowCount: 3,
      rows: [
        { id: 1, sku: 'CLOUD-NVME-PRO', title: 'DevPro NVMe Cloud Instance', price_bdt: 499.0, stock_qty: 999 },
        { id: 2, sku: 'BDIX-TURBO-MAX', title: 'Business Max Dedicated vCPU', price_bdt: 999.0, stock_qty: 450 },
        { id: 3, sku: 'SSL-WILDCARD-1Y', title: 'Enterprise TLS 1.3 Wildcard', price_bdt: 0.0, stock_qty: 9999 },
      ],
    };
  }

  if (upper.includes('FROM MIGRATIONS')) {
    return {
      executionTimeMs: 3,
      columns: ['id', 'migration', 'batch'],
      rowCount: 4,
      rows: [
        { id: 1, migration: '0001_01_01_000000_create_users_table', batch: 1 },
        { id: 2, migration: '0001_01_01_000001_create_cache_table', batch: 1 },
        { id: 3, migration: '2026_10_15_091200_create_orders_and_payments_table', batch: 2 },
        { id: 4, migration: '2026_11_02_142000_add_bdix_edge_indexes', batch: 3 },
      ],
    };
  }

  if (upper.startsWith('INSERT') || upper.startsWith('UPDATE')) {
    return {
      executionTimeMs: 7,
      columns: ['affected_rows', 'status', 'replication_lag_ms'],
      rowCount: 1,
      rows: [
        {
          affected_rows: 1,
          status: 'Query OK, 1 row affected (NVMe ACID Commit Verified)',
          replication_lag_ms: 0,
        },
      ],
    };
  }

  // Default: SELECT FROM users or general query
  return {
    executionTimeMs: 5,
    columns: ['id', 'full_name', 'email', 'role', 'status', 'created_at'],
    rowCount: 4,
    rows: [
      { id: 101, full_name: 'Md. Hanif Chowdury', email: 'hanif@devhost.cloud', role: 'admin', status: 'active', created_at: '2026-10-01 10:00:00' },
      { id: 104, full_name: 'Nusrat Jahan', email: 'nusrat@dhakacommerce.com', role: 'customer', status: 'active', created_at: '2026-10-14 15:22:10' },
      { id: 112, full_name: 'Tanvir Ahmed', email: 'tanvir@fintechbd.io', role: 'editor', status: 'active', created_at: '2026-10-28 11:45:00' },
      { id: 119, full_name: 'Sarah Rahman', email: 'sarah@globalagency.co', role: 'customer', status: 'active', created_at: '2026-11-04 19:30:12' },
    ],
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId') || '';

    const access = await requireServiceAccess(req, serviceId, 'logs:read');
    if (!access.ok) return access.response;

    const supabaseAdmin = getServiceSupabase();
    if (!supabaseAdmin && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Console Service');
    }

    let logs: unknown[] = [];

    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('terminal_and_sql_logs')
        .select('*')
        .eq('service_id', serviceId)
        .order('executed_at', { ascending: false })
        .limit(20);
      if (data) logs = data;
    }

    return NextResponse.json({
      success: true,
      schemas: CONTAINER_SQL_SCHEMA,
      logs,
    });
  } catch (err) {
    console.error('[Console API GET Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load console telemetry.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      serviceId,
      domain = 'app.devhost.cloud',
      username = 'dev_container',
      consoleType,
      commandOrQuery,
      dbName,
    } = body as {
      serviceId: string;
      userId?: string;
      domain?: string;
      username?: string;
      consoleType: 'jailed_ssh' | 'sql_runner';
      commandOrQuery: string;
      dbName?: string;
    };

    if (!serviceId || !commandOrQuery || !commandOrQuery.trim()) {
      return NextResponse.json(
        { success: false, error: 'serviceId and commandOrQuery are required.' },
        { status: 400 }
      );
    }

    const access = await requireServiceAccess(req, serviceId, 'services:write');
    if (!access.ok) return access.response;
    const userId = access.user.id;

    const supabaseAdmin = getServiceSupabase();
    if (!supabaseAdmin && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Console Service');
    }
    const target = await resolveServiceComputeTarget(supabaseAdmin, serviceId, userId);

    if (consoleType === 'jailed_ssh') {
      const check = validateContainerCommand(commandOrQuery, 'ssh');
      if (!check.valid) {
        if (supabaseAdmin && userId) {
          await supabaseAdmin.from('terminal_and_sql_logs').insert({
            service_id: serviceId,
            user_id: userId,
            console_type: 'jailed_ssh',
            command_or_query: commandOrQuery,
            execution_status: 'blocked_firewall',
            output_preview: check.error,
            execution_time_ms: 1,
          });
        }

        await logSecurityAudit({
          actorId: userId,
          actorRole: 'client',
          actionType: 'JAILED_SSH_FIREWALL_BLOCK',
          targetResource: `${serviceId}:${domain}`,
          riskLevel: 'critical',
          metadata: { command: commandOrQuery },
        });

        return NextResponse.json(
          {
            success: false,
            blockedByFirewall: true,
            error: check.error,
          },
          { status: 403 }
        );
      }

      const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
      if (!agentConfigured && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Live Compute SSH Agent');
      }

      const result = agentConfigured
        ? await execContainerCommandOnAgent(
            {
              serviceId,
              cpanelUser: target.cpanelUser || username,
              domain: target.domain || domain,
              command: commandOrQuery,
            },
            target.agentEndpoint || undefined
          )
        : null;

      if (agentConfigured && (!result || !result.ok || !result.data)) {
        return NextResponse.json(
          { success: false, error: result?.error || 'Live SSH command failed on compute agent.' },
          { status: 502 }
        );
      }

      const execRes = result?.data || executeJailedSshCommand(commandOrQuery, domain, username);

      if (supabaseAdmin && userId) {
        await supabaseAdmin.from('terminal_and_sql_logs').insert({
          service_id: serviceId,
          user_id: userId,
          console_type: 'jailed_ssh',
          command_or_query: commandOrQuery,
          execution_status: 'executed',
          output_preview: execRes.output.slice(0, 500),
          execution_time_ms: execRes.executionTimeMs,
        });
      }

      return NextResponse.json({
        success: true,
        consoleType: 'jailed_ssh',
        source: agentConfigured ? 'live_agent' : 'sandbox',
        output: execRes.output,
        executionTimeMs: execRes.executionTimeMs,
      });
    }

    // Mode B: SQL Query Runner
    const sqlCheck = validateScopedSqlQuery(commandOrQuery);
    if (!sqlCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          blockedByFirewall: true,
          error: sqlCheck.error,
        },
        { status: 403 }
      );
    }

    if (dbName && typeof dbName === 'string' && supabaseAdmin) {
      const cleanDbName = dbName.trim();
      const { data: ownedDb } = await supabaseAdmin
        .from('hosting_databases')
        .select('id, db_name')
        .eq('service_id', serviceId)
        .eq('db_name', cleanDbName)
        .maybeSingle();

      const expectedPrefix = `${target.cpanelUser || ''}_`;
      if (!ownedDb && (!target.cpanelUser || !cleanDbName.startsWith(expectedPrefix))) {
        return NextResponse.json(
          {
            success: false,
            error: `Forbidden: Database "${cleanDbName}" does not belong to this hosting service.`,
          },
          { status: 403 }
        );
      }
    }

    const agentConfiguredForSql = isComputeAgentConfigured(target.agentEndpoint);
    if (!agentConfiguredForSql && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Live Compute SQL Agent');
    }

    const liveSqlRes = agentConfiguredForSql
      ? await execSqlQueryOnAgent(
          {
            serviceId,
            cpanelUser: target.cpanelUser || username,
            dbName,
            query: commandOrQuery,
          },
          target.agentEndpoint || undefined
        )
      : null;

    if (agentConfiguredForSql && (!liveSqlRes || !liveSqlRes.ok || !liveSqlRes.data)) {
      return NextResponse.json(
        { success: false, error: liveSqlRes?.error || 'Live SQL query failed on compute agent.' },
        { status: 502 }
      );
    }

    const sqlResult = liveSqlRes?.data || executeSqlRunnerQuery(commandOrQuery);

    if (supabaseAdmin && userId) {
      await supabaseAdmin.from('terminal_and_sql_logs').insert({
        service_id: serviceId,
        user_id: userId,
        console_type: 'sql_runner',
        command_or_query: commandOrQuery,
        execution_status: 'executed',
        output_preview: `Returned ${sqlResult.rowCount} rows (${sqlResult.columns.join(', ')})`,
        execution_time_ms: sqlResult.executionTimeMs,
      });
    }

    return NextResponse.json({
      success: true,
      consoleType: 'sql_runner',
      source: agentConfiguredForSql ? 'live_agent' : 'sandbox',
      columns: sqlResult.columns,
      rows: sqlResult.rows,
      rowCount: sqlResult.rowCount,
      executionTimeMs: sqlResult.executionTimeMs,
    });
  } catch (err) {
    console.error('[Console API POST Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to execute console command.' },
      { status: 500 }
    );
  }
}
