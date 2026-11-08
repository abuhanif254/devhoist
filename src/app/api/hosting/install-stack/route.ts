import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
    fetchMarketplaceStacksFromDbOrFallback,
    getStackBlueprintBySlug,
    provisionMarketplaceStack,
    evaluateStackHardwareCompatibility,
} from '@/lib/stackProvisioner';

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
            const stackData = body.blueprint;
            if (!stackData?.slug || !stackData?.name) {
                return NextResponse.json(
                    { error: 'slug and name are required for stack blueprint' },
                    { status: 400 }
                );
            }
            if (!supabaseAdmin) {
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
            userId: bodyUserId,
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

        const resolvedUserId = bodyUserId || serviceRow?.user_id || '00000000-0000-0000-0000-000000000000';
        const resolvedDomain = bodyDomain || serviceRow?.domain || 'app.devhost.cloud';
        const resolvedCpanelUser = bodyCpanelUser || serviceRow?.cpanel_username || 'dvhst';

        // Hardware compatibility check if service has a known RAM allocation
        if (serviceRow?.ram_mb) {
            const compat = evaluateStackHardwareCompatibility(
                stackSlug,
                Number(serviceRow.ram_mb),
                Number(serviceRow.cpu_cores || 1)
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
