import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { validatePricingPlanChange } from '@/lib/profitEngine';
import {
  requireAdmin,
  verifySudoToken,
  extractAccessToken,
  serviceUnavailableResponse,
} from '@/lib/authGuard';
import {
  DEFAULT_PRODUCTION_DOMAIN_TLDS,
  DEFAULT_PRODUCTION_HOSTING_PLANS,
  DEFAULT_PRODUCTION_PROMOS,
} from '@/lib/catalogDefaults';

/**
 * GET /api/catalog
 * Returns dynamic hosting plans, VPS tiers, domain TLDs, promos & platform settings.
 * Auto-seeds Supabase if tables are currently empty!
 */
export async function GET(req?: NextRequest) {
  try {
    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Dynamic Catalog');
    }

    let isAdminCaller = false;
    if (req && extractAccessToken(req) && isSupabaseConfigured()) {
      const adminCheck = await requireAdmin(req);
      isAdminCaller = adminCheck.ok;
    }

    let plans = isDevSandboxMode() ? DEFAULT_PRODUCTION_HOSTING_PLANS : ([] as typeof DEFAULT_PRODUCTION_HOSTING_PLANS);
    let tlds = isDevSandboxMode() ? DEFAULT_PRODUCTION_DOMAIN_TLDS : ([] as typeof DEFAULT_PRODUCTION_DOMAIN_TLDS);
    let promos = isAdminCaller || isDevSandboxMode() ? DEFAULT_PRODUCTION_PROMOS : ([] as typeof DEFAULT_PRODUCTION_PROMOS);
    let serverNodes: Record<string, unknown>[] = [];
    const settings: Record<string, unknown> = {
      bdix_status: { status: 'online', peering_mbps: 10000, node: 'Equinix SG1' },
      usd_bdt_rate: 120,
    };
    let isLiveDatabase = false;

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      // Query Plans (read-only on GET; never write during anonymous GET requests)
      const { data: dbPlans, error: plansErr } = await db
        .from('catalog_hosting_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!plansErr && dbPlans && dbPlans.length > 0) {
        plans = dbPlans;
        isLiveDatabase = true;
      } else if (!plansErr && (!dbPlans || dbPlans.length === 0)) {
        plans = DEFAULT_PRODUCTION_HOSTING_PLANS;
      }

      // Query Domain TLDs (read-only on GET)
      const { data: dbTlds, error: tldsErr } = await db
        .from('catalog_domain_tlds')
        .select('*')
        .order('reg_price_bdt', { ascending: true });

      if (!tldsErr && dbTlds && dbTlds.length > 0) {
        tlds = dbTlds;
      } else if (!tldsErr && (!dbTlds || dbTlds.length === 0)) {
        tlds = DEFAULT_PRODUCTION_DOMAIN_TLDS;
      }

      // Query Promos (live from promo_codes) — only exposed to authenticated Admins
      if (isAdminCaller) {
        const { data: dbPromos, error: promosErr } = await db
          .from('promo_codes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!promosErr && dbPromos) {
          promos = dbPromos;
        }
      } else {
        promos = [];
      }

      // Query Public-Safe Server Cluster Node Capacity (no IP/credentials; omit whm_hostname publicly)
      const { data: dbNodes, error: nodesErr } = isAdminCaller
        ? await db
            .from('whm_server_nodes')
            .select(
              'id, node_code, node_name, datacenter_location, whm_hostname, max_cpanel_slots, used_cpanel_slots, max_disk_gb, allocated_disk_gb, actual_physical_disk_gb, is_healthy, status_message, auto_provision_enabled'
            )
            .order('created_at', { ascending: true })
        : await db
            .from('whm_server_nodes')
            .select(
              'id, node_code, node_name, datacenter_location, max_cpanel_slots, used_cpanel_slots, max_disk_gb, allocated_disk_gb, actual_physical_disk_gb, is_healthy, status_message, auto_provision_enabled'
            )
            .order('created_at', { ascending: true });

      if (!nodesErr && dbNodes) {
        serverNodes = dbNodes as unknown as Record<string, unknown>[];
      }

      // Query Platform Settings
      const { data: dbSettings } = await db.from('platform_settings').select('*');
      if (dbSettings && dbSettings.length > 0) {
        dbSettings.forEach((s) => {
          settings[s.key] = s.value;
        });
      }
    }

    const sanitizedPlans = isAdminCaller
      ? plans
      : plans.map((plan) => {
          const {
            unit_server_cost_bdt: _unitCost,
            min_owner_profit_bdt: _minProfit,
            max_affiliate_pool_bdt: _maxPool,
            ...publicPlan
          } = plan as Record<string, unknown>;
          return publicPlan;
        });

    const sanitizedTlds = isAdminCaller
      ? tlds
      : tlds.map((tld) => {
          const {
            registrar_cost_bdt: _regCost,
            owner_net_profit_reg_bdt: _ownerProfit,
            ...publicTld
          } = tld as Record<string, unknown>;
          return publicTld;
        });

    const sanitizedNodes = isAdminCaller
      ? serverNodes
      : serverNodes.map((node) => {
          const { whm_hostname: _whmHost, ...publicNode } = node as Record<string, unknown>;
          return publicNode;
        });

    const exposedPromos = isAdminCaller || isDevSandboxMode() ? promos : [];

    return NextResponse.json({
      success: true,
      isLiveDatabase,
      plans: sanitizedPlans.filter((p) => p.category !== 'vps'),
      vpsPlans: sanitizedPlans.filter((p) => p.category === 'vps'),
      allPlans: sanitizedPlans,
      domainTlds: sanitizedTlds,
      promoCodes: exposedPromos,
      serverNodes: sanitizedNodes,
      platformSettings: settings,
      meta: {
        totalPlans: sanitizedPlans.length,
        totalTlds: sanitizedTlds.length,
        activePromos: exposedPromos.filter((p) => p.is_active !== false).length,
        totalNodes: sanitizedNodes.length,
        currency: 'BDT',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dynamic catalog',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/catalog
 * Update a plan, domain TLD, promo, or setting with profit-protection verification.
 */
export async function PUT(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const body = await req.json();
    const { entityType, data } = body as {
      entityType: 'plan' | 'tld' | 'promo' | 'setting';
      data: {
        selling_price_monthly_bdt?: number;
        unit_server_cost_bdt?: number;
        min_owner_profit_bdt?: number;
        storage_gb?: number;
        ram_mb?: number;
        cpu_cores?: number;
        slug?: string;
        registrar_cost_bdt?: number;
        reg_price_bdt?: number;
        renew_price_bdt?: number;
        transfer_price_bdt?: number;
        affiliate_eligible?: boolean;
        tld?: string;
        code?: string;
        discount_type?: string;
        discount_value?: number;
        discountPercent?: number;
        applies_to?: string;
        max_uses?: number;
        current_uses?: number;
        reduce_affiliate_commission_proportionally?: boolean;
        expires_at?: string | null;
        is_active?: boolean;
        [key: string]: unknown;
      };
    };

    if (!entityType || !data) {
      return NextResponse.json(
        { error: 'Missing entityType or data in request body' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Dynamic Catalog');
    }

    const sudoValid = await verifySudoToken(req, adminAuth.user.id);
    if (!sudoValid) {
      return NextResponse.json(
        {
          error: 'Admin Sudo elevation is required to modify catalog pricing or promo codes.',
          requireSudo: true,
          code: 'SUDO_REQUIRED',
        },
        { status: 403 }
      );
    }

    // 1. Profit Protection Validation for Plan updates
    if (entityType === 'plan') {
      const validation = validatePricingPlanChange({
        sellingPriceBDT: Number(data.selling_price_monthly_bdt),
        unitServerCostBDT: Number(data.unit_server_cost_bdt),
        minOwnerProfitBDT: Number(data.min_owner_profit_bdt),
      });

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 422 });
      }
    }

    // 2. Perform Supabase database update if configured
    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      if (entityType === 'plan') {
        const { error } = await db
          .from('catalog_hosting_plans')
          .update({
            selling_price_monthly_bdt: data.selling_price_monthly_bdt,
            unit_server_cost_bdt: data.unit_server_cost_bdt,
            min_owner_profit_bdt: data.min_owner_profit_bdt,
            storage_gb: data.storage_gb,
            ram_mb: data.ram_mb,
            cpu_cores: data.cpu_cores,
            updated_at: new Date().toISOString(),
          })
          .eq('slug', data.slug);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else if (entityType === 'tld') {
        const { error } = await db
          .from('catalog_domain_tlds')
          .update({
            registrar_cost_bdt: data.registrar_cost_bdt,
            reg_price_bdt: data.reg_price_bdt,
            renew_price_bdt: data.renew_price_bdt,
            transfer_price_bdt: data.transfer_price_bdt,
            affiliate_eligible: data.affiliate_eligible,
            updated_at: new Date().toISOString(),
          })
          .eq('tld', data.tld);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else if (entityType === 'promo') {
        const cleanCode = String(data.code || '').toUpperCase().trim();
        if (!cleanCode) {
          return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
        }
        const { error } = await db.from('promo_codes').upsert(
          {
            code: cleanCode,
            discount_type: data.discount_type || 'percentage',
            discount_value: Number(data.discount_value ?? data.discountPercent ?? 0),
            applies_to: data.applies_to || 'all',
            max_uses: data.max_uses !== undefined ? Number(data.max_uses) : null,
            current_uses: Number(data.current_uses ?? 0),
            reduce_affiliate_commission_proportionally:
              data.reduce_affiliate_commission_proportionally ?? true,
            expires_at: data.expires_at || null,
            is_active: data.is_active ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'code' }
        );
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${entityType.toUpperCase()} updated and persisted successfully!`,
      data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update catalog entity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/catalog?entityType=promo&code=...
 * Removes a promo code from promo_codes (Admin Only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Dynamic Catalog');
    }

    const sudoValid = await verifySudoToken(req, adminAuth.user.id);
    if (!sudoValid) {
      return NextResponse.json(
        {
          error: 'Admin Sudo elevation is required to delete catalog entries.',
          requireSudo: true,
          code: 'SUDO_REQUIRED',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const code = searchParams.get('code')?.toUpperCase().trim();

    if (entityType !== 'promo' || !code) {
      return NextResponse.json(
        { error: 'entityType=promo and code are required' },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { error } = await db.from('promo_codes').delete().eq('code', code);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Promo code ${code} deleted.`,
      code,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete catalog entity' },
      { status: 500 }
    );
  }
}
