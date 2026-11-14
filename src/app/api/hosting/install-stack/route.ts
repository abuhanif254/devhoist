import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireAdmin, requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
    fetchMarketplaceStacksFromDbOrFallback,
    getStackBlueprintBySlug,
    provisionMarketplaceStack,
    evaluateStackHardwareCompatibility,
} from '@/lib/stackProvisioner';
import { isBuildQueueConfigured, isR2ArtifactsConfigured } from '@/lib/cloudflareStorageQueue';
import { isComputeAgentConfigured } from '@/lib/computeAgentClient';
import { whmClient } from '@/lib/whmClient';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const slug = searchParams.get('slug');

        const stacks = await fetchMarketplaceStacksFromDbOrFallback();

        if (slug) {
            const found = stacks.find((s) => s.slug === slug) || getStackBlueprintBySlug(slug);
            if (!found) {
                return NextResponse.json({ error: 'Stack blueprint not found' }, { status: 404 });
            }
            return NextResponse.json({ success: true, stack: found });
        }

        const filtered =
            category && category !== 'All'
                ? stacks.filter((s) => s.category === category)
                : stacks;

        return NextResponse.json({
            success: true,
            count: filtered.length,
            stacks: filtered,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to load marketplace stacks' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const supabaseAdmin = getServiceSupabase();

        // Action 1: Admin Upsert Stack Blueprint
        if (body.action === 'upsert_blueprint') {
            const adminAuth = await requireAdmin(request);
            if (!adminAuth.ok) return adminAuth.response;

            const stackData = body.blueprint;
            if (!stackData?.slug || !stackData?.name) {
                return NextResponse.json(
                    { error: 'slug and name are required for stack blueprint' },
                    { status: 400 }
                );
            }
            if (!supabaseAdmin) {
                if (!isDevSandboxMode()) {
                    return serviceUnavailableResponse('Supabase Service');
                }
                return NextResponse.json({ success: true, blueprint: stackData });
            }

            const { data, error } = await supabaseAdmin
                .from('catalog_marketplace_stacks')
                .upsert(
                    {
                        ...stackData,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'slug' }
                )
                .select()
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, blueprint: data });
        }

        // Action 2: Provision Stack onto an Existing or Newly Created Hosting Service
        const {
            serviceId,
            stackSlug,
            domain: bodyDomain,
            cpanelUser: bodyCpanelUser,
            gitRepoUrl,
            gitBranch,
        } = body;

        if (!serviceId || !stackSlug) {
            return NextResponse.json(
                { error: 'serviceId and stackSlug are required' },
                { status: 400 }
            );
        }

        const access = await requireServiceAccess(request, serviceId, 'services:write');
        if (!access.ok) return access.response;

        // Look up the hosting service to verify ownership and hardware resources
        const serviceRow = supabaseAdmin
            ? (
                  await supabaseAdmin
                      .from('hosting_services')
                      .select('*')
                      .eq('id', serviceId)
                      .maybeSingle()
              ).data
            : null;

        const nodeRow = supabaseAdmin && serviceRow?.server_node
            ? (
                  await supabaseAdmin
                      .from('whm_server_nodes')
                      .select('agent_endpoint, node_driver')
                      .eq('node_code', serviceRow.server_node)
                      .maybeSingle()
              ).data
            : null;

        const agentEndpoint = (nodeRow?.agent_endpoint as string | null | undefined) || null;
        const blueprint = getStackBlueprintBySlug(stackSlug);

        if (!isDevSandboxMode()) {
            if (!supabaseAdmin) {
                return serviceUnavailableResponse('Supabase Service');
            }
            if (blueprint?.runtime_family === 'static_edge') {
                if (!isR2ArtifactsConfigured()) {
                    return serviceUnavailableResponse('Cloudflare R2 Artifacts Plane');
                }
            } else if (
                !isComputeAgentConfigured(agentEndpoint) &&
                !isBuildQueueConfigured() &&
                !whmClient.getStatus().configured
            ) {
                return serviceUnavailableResponse('Compute & Build Plane');
            }
        }

        const resolvedUserId = serviceRow?.user_id || access.user.id;
        const resolvedDomain = String(
            serviceRow?.domain || (!serviceRow ? bodyDomain : '') || ''
        )
            .trim()
            .toLowerCase();
        if (!resolvedDomain) {
            return NextResponse.json(
                { error: 'Target service domain could not be resolved.' },
                { status: 400 }
            );
        }
        const resolvedCpanelUser = String(
            serviceRow?.cpanel_username || (!serviceRow ? bodyCpanelUser : '') || 'dvhst'
        ).trim();

        // Hardware compatibility check if service has a known RAM allocation
        const serviceRamMb = serviceRow?.ram_limit_mb ?? serviceRow?.ram_mb;
        if (serviceRamMb) {
            const compat = evaluateStackHardwareCompatibility(
                stackSlug,
                Number(serviceRamMb),
                Number(serviceRow.cpu_cores || 2)
            );
            if (!compat.compatible) {
                return NextResponse.json(
                    {
                        error: compat.reason,
                        code: 'HARDWARE_UPGRADE_REQUIRED',
                        recommendedPlan: compat.recommendedPlan,
                    },
                    { status: 422 }
                );
            }
        }

        const result = await provisionMarketplaceStack({
            serviceId,
            userId: resolvedUserId,
            stackSlug,
            domain: resolvedDomain,
            cpanelUser: resolvedCpanelUser,
            gitRepoUrl,
            gitBranch,
            agentEndpoint,
            ramMb: serviceRamMb ? Number(serviceRamMb) : undefined,
            diskGb: serviceRow?.disk_limit_gb ? Number(serviceRow.disk_limit_gb) : undefined,
            inodeLimit: serviceRow?.inode_limit ? Number(serviceRow.inode_limit) : undefined,
        });

        return NextResponse.json({
            success: true,
            message: `${result.stack.name} provisioned and deployed on https://${resolvedDomain}`,
            result,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to provision stack' },
            { status: 500 }
        );
    }
}
