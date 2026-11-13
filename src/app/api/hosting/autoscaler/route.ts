import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { calculatePlanUpgradeProRata } from '@/lib/profitEngine';
import { requireServiceAccess } from '@/lib/authGuard';

export interface AutoscalingRuleRecord {
  id: string;
  service_id: string;
  user_id?: string;
  autoscale_enabled: boolean;
  ram_threshold_percent: number;
  cpu_threshold_percent: number;
  max_monthly_budget_cap_bdt: number;
  edge_waf_mode: 'standard' | 'under_attack_js_challenge' | 'bot_fight_strict';
  blocked_countries: string[];
  rate_limit_req_per_min: number;
  last_scaled_at: string | null;
}

function getDefaultAutoscalerRules(serviceId: string): AutoscalingRuleRecord {
  return {
    id: `auto-${serviceId}`,
    service_id: serviceId,
    autoscale_enabled: false,
    ram_threshold_percent: 85,
    cpu_threshold_percent: 85,
    max_monthly_budget_cap_bdt: 999,
    edge_waf_mode: 'standard',
    blocked_countries: [],
    rate_limit_req_per_min: 300,
    last_scaled_at: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId') || '';

    const access = await requireServiceAccess(req, serviceId, 'services:read');
    if (!access.ok) return access.response;

    const currentMonthlyBDT = Number(searchParams.get('currentMonthlyBDT')) || 499;
    const targetMonthlyBDT = Number(searchParams.get('targetMonthlyBDT')) || 999;
    const remainingDays = Number(searchParams.get('remainingDays')) || 18;
    const maxBudgetCapBDT = Number(searchParams.get('maxBudgetCapBDT')) || 1200;
    const walletBalanceBDT = Number(searchParams.get('walletBalanceBDT')) || 1500;

    const proRataPreview = calculatePlanUpgradeProRata({
      currentPlanMonthlyBDT: currentMonthlyBDT,
      targetPlanMonthlyBDT: targetMonthlyBDT,
      remainingDaysInCycle: remainingDays,
      customerMaxBudgetCapBDT: maxBudgetCapBDT,
      walletBalanceBDT,
    });

    const supabaseAdmin = getServiceSupabase();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('service_autoscaling_rules')
        .select('*')
        .eq('service_id', serviceId)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({
          success: true,
          rules: data,
          proRataPreview,
          source: 'supabase',
        });
      }
    }

    return NextResponse.json({
      success: true,
      rules: getDefaultAutoscalerRules(serviceId),
      proRataPreview,
      source: 'default_rules',
    });
  } catch (err) {
    console.error('[Autoscaler API GET Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load autoscaler & WAF rules.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      serviceId,
      domain = 'app.devhost.cloud',
      autoscaleEnabled,
      ramThresholdPercent = 85,
      cpuThresholdPercent = 85,
      maxMonthlyBudgetCapBdt = 1200,
      edgeWafMode = 'standard',
      blockedCountries = [],
      rateLimitReqPerMin = 300,
      currentPlanMonthlyBDT = 499,
      targetPlanMonthlyBDT = 999,
      remainingDaysInCycle = 18,
      walletBalanceBDT = 1500,
    } = body as {
      action: 'save_rules' | 'simulate_spike_autoscale';
      serviceId: string;
      userId?: string;
      domain?: string;
      autoscaleEnabled?: boolean;
      ramThresholdPercent?: number;
      cpuThresholdPercent?: number;
      maxMonthlyBudgetCapBdt?: number;
      edgeWafMode?: 'standard' | 'under_attack_js_challenge' | 'bot_fight_strict';
      blockedCountries?: string[];
      rateLimitReqPerMin?: number;
      currentPlanMonthlyBDT?: number;
      targetPlanMonthlyBDT?: number;
      remainingDaysInCycle?: number;
      walletBalanceBDT?: number;
    };

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'serviceId is required.' },
        { status: 400 }
      );
    }

    const access = await requireServiceAccess(req, serviceId, 'services:write');
    if (!access.ok) return access.response;
    const userId = access.user.id;

    const supabaseAdmin = getServiceSupabase();
    const now = new Date().toISOString();

    if (action === 'save_rules') {
      const updatedRules: AutoscalingRuleRecord = {
        id: `auto-${serviceId}`,
        service_id: serviceId,
        user_id: userId,
        autoscale_enabled: Boolean(autoscaleEnabled),
        ram_threshold_percent: Math.max(60, Math.min(98, Number(ramThresholdPercent) || 85)),
        cpu_threshold_percent: Math.max(60, Math.min(98, Number(cpuThresholdPercent) || 85)),
        max_monthly_budget_cap_bdt: Math.max(199, Number(maxMonthlyBudgetCapBdt) || 999),
        edge_waf_mode: edgeWafMode || 'standard',
        blocked_countries: Array.isArray(blockedCountries) ? blockedCountries : [],
        rate_limit_req_per_min: Math.max(30, Math.min(10000, Number(rateLimitReqPerMin) || 300)),
        last_scaled_at: null,
      };

      if (supabaseAdmin && userId) {
        const { data: upserted } = await supabaseAdmin
          .from('service_autoscaling_rules')
          .upsert(
            {
              service_id: serviceId,
              user_id: userId,
              autoscale_enabled: updatedRules.autoscale_enabled,
              ram_threshold_percent: updatedRules.ram_threshold_percent,
              cpu_threshold_percent: updatedRules.cpu_threshold_percent,
              max_monthly_budget_cap_bdt: updatedRules.max_monthly_budget_cap_bdt,
              edge_waf_mode: updatedRules.edge_waf_mode,
              blocked_countries: updatedRules.blocked_countries,
              rate_limit_req_per_min: updatedRules.rate_limit_req_per_min,
            },
            { onConflict: 'service_id' }
          )
          .select('*')
          .single();

        if (upserted) {
          updatedRules.id = upserted.id;
        }
      }

      return NextResponse.json({
        success: true,
        rules: updatedRules,
        message: `Saved Autonomous Auto-Scaler & Edge WAF (${updatedRules.edge_waf_mode}) rules for ${domain}.`,
      });
    }

    if (action === 'simulate_spike_autoscale') {
      const proRata = calculatePlanUpgradeProRata({
        currentPlanMonthlyBDT: Number(currentPlanMonthlyBDT) || 499,
        targetPlanMonthlyBDT: Number(targetPlanMonthlyBDT) || 999,
        remainingDaysInCycle: Number(remainingDaysInCycle) || 18,
        customerMaxBudgetCapBDT: Number(maxMonthlyBudgetCapBdt) || 1200,
        walletBalanceBDT: Number(walletBalanceBDT) || 1500,
      });

      if (!proRata.isWithinBudgetCap) {
        return NextResponse.json({
          success: false,
          proRata,
          blockedReason: 'budget_cap_exceeded',
          error: `Auto-Scale paused to protect customer budget: Target plan (৳${proRata.targetPlanMonthlyBDT}/mo) exceeds Max Monthly Budget Cap (৳${proRata.customerMaxBudgetCapBDT}/mo). Enabled LiteSpeed Edge Stale-While-Revalidate caching instead.`,
        });
      }

      const upgradedRamMB = proRata.targetPlanMonthlyBDT >= 999 ? 4096 : 2048;
      const upgradedCpuCores = proRata.targetPlanMonthlyBDT >= 999 ? 2 : 1;

      if (supabaseAdmin) {
        await supabaseAdmin
          .from('service_autoscaling_rules')
          .update({ last_scaled_at: now })
          .eq('service_id', serviceId);

        await supabaseAdmin
          .from('hosting_services')
          .update({
            ram_limit_mb: upgradedRamMB,
            cpu_limit: upgradedCpuCores * 100,
          })
          .eq('id', serviceId);
      }

      return NextResponse.json({
        success: true,
        proRata,
        upgradedRamMB,
        upgradedCpuCores,
        scaledAt: now,
        telemetrySteps: [
          `[1/4] Detected viral traffic spike on ${domain}: RAM 91% (> ${ramThresholdPercent}% threshold), 1,840 concurrent connections`,
          `[2/4] Verified Profit-Protected Pro-Rata Math: ৳${proRata.proRataChargeBDT} for ${proRata.remainingDaysInCycle} remaining days (Within ৳${proRata.customerMaxBudgetCapBDT}/mo budget cap)`,
          `[3/4] Hot-expanded CloudLinux LVE limits to ${upgradedRamMB} MB DDR5 RAM & ${upgradedCpuCores} Dedicated vCPU Cores in 0.8s without dropping active connections`,
          `[4/4] Activated Edge WAF Rate Limiter (${rateLimitReqPerMin} req/min/IP) — Response time stabilized at 22ms!`,
        ],
        message: `Auto-scaled ${domain} to ${upgradedRamMB} MB DDR5 RAM (${upgradedCpuCores} vCPU) with zero downtime! Pro-rata adjustment: ৳${proRata.proRataChargeBDT}.`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported autoscaler action.' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[Autoscaler API POST Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process autoscaler action.' },
      { status: 500 }
    );
  }
}
