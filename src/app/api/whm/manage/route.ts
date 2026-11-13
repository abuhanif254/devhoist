import { NextResponse } from 'next/server';
import { whmClient, WhmPackageParams } from '@/lib/whmClient';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { executeZeroTouchProvisioning } from '@/lib/zeroTouchProvisioner';
import { requireAdmin } from '@/lib/authGuard';


export async function POST(request: Request) {
  const adminAuth = await requireAdmin(request);
  if (!adminAuth.ok) return adminAuth.response;

  // Rate limit admin API
  const rateLimit = checkRateLimit(request, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, username, reason } = body;

    if (!action) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message:
            'Action parameter is required (list, suspend, unsuspend, status, sync_packages, test_provisioning)',
        },
        { status: 400 }
      );
    }

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        ...whmClient.getStatus(),
      });
    }

    if (action === 'list') {
      const result = await whmClient.listAccounts();
      return NextResponse.json(result);
    }

    if (action === 'suspend') {
      if (!username) {
        return NextResponse.json({ error: 'Username required for suspension' }, { status: 400 });
      }
      const result = await whmClient.suspendAccount(username, reason || 'Admin action');
      return NextResponse.json(result);
    }

    if (action === 'unsuspend') {
      if (!username) {
        return NextResponse.json({ error: 'Username required for unsuspension' }, { status: 400 });
      }
      const result = await whmClient.unsuspendAccount(username);
      return NextResponse.json(result);
    }

    // 1-CLICK SYNC ALL PACKAGES TO WHM SERVER (addpkg / editpkg)
    if (action === 'sync_packages') {
      let packagesToSync: WhmPackageParams[] = [
        {
          name: 'devhost_starter_2g',
          storage_gb: 2,
          max_addon_domains: 1,
          cpu_cores: 1,
          ram_mb: 1024,
          io_speed_mbps: 25,
          entry_processes: 20,
          inode_limit: 150000,
          ssh_enabled: false,
        },
        {
          name: 'devhost_devpro_5g',
          storage_gb: 5,
          max_addon_domains: 5,
          cpu_cores: 2,
          ram_mb: 2048,
          io_speed_mbps: 50,
          entry_processes: 40,
          inode_limit: 300000,
          ssh_enabled: true,
        },
        {
          name: 'devhost_bizmax_15g',
          storage_gb: 15,
          max_addon_domains: 15,
          cpu_cores: 4,
          ram_mb: 4096,
          io_speed_mbps: 100,
          entry_processes: 80,
          inode_limit: 600000,
          ssh_enabled: true,
        },
      ];

      // If Supabase is configured, pull live packages from catalog_hosting_plans
      if (isSupabaseConfigured()) {
        try {
          const db = getServiceSupabase();
          const { data: plans } = await db.from('catalog_hosting_plans').select('*');
          if (plans && plans.length > 0) {
            packagesToSync = plans.map((p: any) => ({
              name: p.whm_package_name || `devhost_${p.slug}`,
              storage_gb: Number(p.storage_gb) || 5,
              max_addon_domains: Number(p.max_addon_domains) || 5,
              cpu_cores: Number(p.cpu_cores) || 2,
              ram_mb: Number(p.ram_mb) || 2048,
              io_speed_mbps: Number(p.io_speed_mbps) || 50,
              entry_processes: Number(p.entry_processes) || 40,
              inode_limit: Number(p.inode_limit) || 300000,
              ssh_enabled: Boolean(p.ssh_enabled),
            }));
          }
        } catch (dbErr) {
          console.warn('[SyncPackages Warning] DB catalog fetch:', dbErr);
        }
      }

      const syncResult = await whmClient.syncAllPackages(packagesToSync);
      return NextResponse.json({
        success: syncResult.success,
        message: syncResult.summary,
        packagesSynced: syncResult.results.length,
        results: syncResult.results,
      });
    }

    // ZERO-TOUCH AUTO-PROVISIONING PIPELINE TEST
    if (action === 'test_provisioning') {
      const testSuffix = Math.random().toString(36).substring(2, 7);
      const testDomain = `test-autonode-${testSuffix}.devhost.cloud`;

      const testResult = await executeZeroTouchProvisioning({
        invoiceNumber: `TEST-INV-${testSuffix.toUpperCase()}`,
        domain: testDomain,
        planName: 'Developer Pro Cloud (Automated Test Pipeline)',
        whmPackageName: 'devhost_devpro_5g',
        gateway: 'system',
        trxId: `TEST-TRX-${testSuffix.toUpperCase()}`,
        amountBDT: 450,
        billingCycle: 'monthly',
        freeDomainBundleApplied: false,
        customerEmail: 'founder-test@devhost.cloud',
        customerName: 'Founder Test Suite',
      });

      return NextResponse.json({
        success: testResult.success,
        message: `Zero-Touch Test Completed in ${testResult.durationMs}ms!`,
        diagnostic: testResult,
      });
    }

    return NextResponse.json(
      { error: 'Invalid Action', message: `Action "${action}" is not recognized` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'WHM Management Error', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
