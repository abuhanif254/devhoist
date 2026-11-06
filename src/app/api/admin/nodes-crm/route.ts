import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';

export const runtime = 'edge';

async function logNodeAudit(
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ip: string = '127.0.0.1'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_role: 'admin',
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
 * GET: Fetch WHM Server Nodes & Customer CRM Data with Quotas
 */
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        nodes: [
          {
            id: 'node-sg1',
            node_code: 'sg1-nvme-01',
            node_name: 'Singapore SG1 Enterprise NVMe (Equinix)',
            datacenter_location: 'Singapore (Equinix SG1)',
            ipv4_address: '103.151.102.45',
            whm_hostname: 'sg1.devhost.cloud',
            whm_username: 'root_sg1',
            monthly_node_cost_bdt: 3500,
            max_cpanel_slots: 50,
            used_cpanel_slots: 14,
            max_disk_gb: 100,
            allocated_disk_gb: 28.5,
            actual_physical_disk_gb: 8.4,
            auto_provision_enabled: true,
            is_healthy: true,
            status_message: '100% Operational - LiteSpeed Enterprise Active',
          },
          {
            id: 'node-us1',
            node_code: 'us1-nvme-02',
            node_name: 'US East NY4 Dev Cluster (Equinix)',
            datacenter_location: 'New York, USA (Equinix NY4)',
            ipv4_address: '198.51.100.22',
            whm_hostname: 'us1.devhost.cloud',
            whm_username: 'root_us1',
            monthly_node_cost_bdt: 3500,
            max_cpanel_slots: 50,
            used_cpanel_slots: 6,
            max_disk_gb: 100,
            allocated_disk_gb: 12.0,
            actual_physical_disk_gb: 4.1,
            auto_provision_enabled: true,
            is_healthy: true,
            status_message: '100% Operational - CloudLinux 9 OS Active',
          },
        ],
        customers: [],
      });
    }

    const db = getServiceSupabase();

    const [nodesRes, profilesRes, servicesRes] = await Promise.all([
      db.from('whm_server_nodes').select('*').order('created_at', { ascending: true }),
      db.from('profiles').select('id, full_name, email, phone, role, wallet_balance_bdt, created_at').order('created_at', { ascending: false }).limit(100),
      db.from('hosting_services').select('id, user_id, package_name, domain, cpanel_username, ip_address, status, server_location, disk_usage_gb, disk_limit_gb, ram_limit_mb, inode_limit'),
    ]);

    const services = servicesRes.data || [];
    const nodes = (nodesRes.data || []).map((node) => {
      // Re-calculate dynamic slots and disk usage from services
      const matchingServices = services.filter((s) => s.ip_address === node.ipv4_address || s.server_location?.toLowerCase().includes('singapore') && node.node_code.startsWith('sg'));
      const activeSlots = matchingServices.length;
      const allocatedDisk = matchingServices.reduce((sum, s) => sum + (Number(s.disk_limit_gb) || 2), 0);
      return {
        ...node,
        used_cpanel_slots: activeSlots > 0 ? activeSlots : node.used_cpanel_slots,
        allocated_disk_gb: allocatedDisk > 0 ? allocatedDisk : node.allocated_disk_gb,
      };
    });

    const customersWithServices = (profilesRes.data || []).map((prof) => {
      const userServices = services.filter((s) => s.user_id === prof.id);
      return {
        ...prof,
        servicesCount: userServices.length,
        services: userServices,
      };
    });

    return NextResponse.json({
      success: true,
      nodes,
      customers: customersWithServices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Create or Update WHM Server Node
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, nodeData, sudoVerified } = body;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (action === 'save_node') {
      if (!sudoVerified) {
        return NextResponse.json({ success: false, error: 'Admin Sudo elevation required to modify server cluster nodes.' }, { status: 403 });
      }

      const {
        nodeCode,
        nodeName,
        datacenterLocation,
        ipv4Address,
        whmHostname,
        whmUsername,
        whmApiToken,
        monthlyCostBdt = 3500,
        maxSlots = 50,
        maxDiskGb = 100,
      } = nodeData;

      if (!nodeCode || !nodeName || !ipv4Address || !whmHostname || !whmUsername) {
        return NextResponse.json({ success: false, error: 'Missing required node parameters.' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('whm_server_nodes').upsert(
          {
            node_code: nodeCode.trim(),
            node_name: nodeName.trim(),
            datacenter_location: datacenterLocation.trim(),
            ipv4_address: ipv4Address.trim(),
            whm_hostname: whmHostname.trim(),
            whm_username: whmUsername.trim(),
            whm_api_token_encrypted: whmApiToken ? whmApiToken.trim() : null,
            monthly_node_cost_bdt: monthlyCostBdt,
            max_cpanel_slots: maxSlots,
            max_disk_gb: maxDiskGb,
          },
          { onConflict: 'node_code' }
        );
      }

      await logNodeAudit('SERVER_NODE_SAVED', `node:${nodeCode}`, { nodeName, ipv4Address }, 'high', ip);

      return NextResponse.json({
        success: true,
        message: `WHM Server Node ${nodeCode} configured and ready.`,
      });
    }

    if (action === 'toggle_provision') {
      const { nodeId, autoProvisionEnabled, isHealthy } = body;
      if (isSupabaseConfigured() && nodeId) {
        const db = getServiceSupabase();
        await db.from('whm_server_nodes').update({
          auto_provision_enabled: autoProvisionEnabled,
          is_healthy: isHealthy,
        }).eq('id', nodeId);
      }
      return NextResponse.json({ success: true, message: 'Node status updated.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT: Quota Overrides, Server Node Migration & Wallet Adjustments (Sudo-Guarded)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sudoVerified } = body;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!sudoVerified) {
      return NextResponse.json({ success: false, error: 'Admin Sudo elevation required for CRM God-Mode overrides.' }, { status: 403 });
    }

    // 1. Custom Quota Override
    if (action === 'override_quota') {
      const { serviceId, diskLimitGb, ramLimitMb, inodeLimit } = body;

      if (!serviceId) {
        return NextResponse.json({ success: false, error: 'serviceId is required.' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db
          .from('hosting_services')
          .update({
            disk_limit_gb: Number(diskLimitGb) || 10,
            ram_limit_mb: Number(ramLimitMb) || 2048,
            inode_limit: Number(inodeLimit) || 250000,
          })
          .eq('id', serviceId);
      }

      await logNodeAudit(
        'SERVICE_QUOTA_OVERRIDDEN',
        `service:${serviceId}`,
        { diskLimitGb, ramLimitMb, inodeLimit },
        'high',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Quotas updated: ${diskLimitGb}GB Disk, ${ramLimitMb}MB RAM, ${inodeLimit} Inodes.`,
      });
    }

    // 2. Cross-Node Service Migration
    if (action === 'migrate_node') {
      const { serviceId, targetNodeCode } = body;

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        const { data: targetNode } = await db
          .from('whm_server_nodes')
          .select('*')
          .eq('node_code', targetNodeCode)
          .single();

        if (targetNode) {
          await db
            .from('hosting_services')
            .update({
              ip_address: targetNode.ipv4_address,
              server_location: targetNode.datacenter_location,
            })
            .eq('id', serviceId);
        }
      }

      await logNodeAudit(
        'SERVICE_NODE_MIGRATED',
        `service:${serviceId}`,
        { targetNodeCode },
        'critical',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Service migrated to cluster node ${targetNodeCode}.`,
      });
    }

    // 3. Wallet Balance Adjustment
    if (action === 'adjust_wallet') {
      const { userId, amountBdt, reason } = body;

      if (!userId || amountBdt === undefined) {
        return NextResponse.json({ success: false, error: 'userId and amountBdt are required.' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        const { data: user } = await db.from('profiles').select('wallet_balance_bdt').eq('id', userId).single();

        if (user) {
          const currentBal = Number(user.wallet_balance_bdt) || 0;
          const newBal = currentBal + Number(amountBdt);

          await db.from('profiles').update({ wallet_balance_bdt: newBal }).eq('id', userId);

          // Record in financial ledger
          const entryCode = `LDG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await db.from('financial_profit_ledger').insert({
            entry_code: entryCode,
            entry_type: 'wallet_topup',
            user_id: userId,
            gateway: 'system',
            gross_amount_bdt: Number(amountBdt),
            base_cogs_cost_bdt: 0,
            affiliate_commission_bdt: 0,
            notes: `Admin Wallet Balance Adjustment: ${Number(amountBdt) >= 0 ? '+' : ''}${amountBdt} BDT. Reason: ${reason || 'Administrative adjustment'}`,
          });
        }
      }

      await logNodeAudit(
        'WALLET_BALANCE_ADJUSTED',
        `user:${userId}`,
        { amountBdt, reason },
        'high',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Customer wallet updated by ${amountBdt >= 0 ? '+' : ''}${amountBdt} BDT.`,
      });
    }

    // 4. Role Toggle (Client <-> Admin)
    if (action === 'toggle_role') {
      const { userId, newRole } = body;
      if (isSupabaseConfigured() && userId) {
        const db = getServiceSupabase();
        await db.from('profiles').update({ role: newRole }).eq('id', userId);
      }
      await logNodeAudit('USER_ROLE_CHANGED', `user:${userId}`, { newRole }, 'critical', ip);
      return NextResponse.json({ success: true, message: `User role changed to ${newRole}.` });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
