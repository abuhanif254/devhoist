import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/authGuard';
import { TEAM_ROLE_PRESETS, TeamRoleId } from '@/lib/teamRoles';
import { buildPortalUrl } from '@/lib/siteUrl';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const requestedOwnerId = searchParams.get('ownerUserId');
        const ownerUserId =
            auth.role === 'admin' && requestedOwnerId ? requestedOwnerId : auth.user.id;
        const supabaseAdmin = getServiceSupabase();

        if (supabaseAdmin && ownerUserId) {
            const { data } = await supabaseAdmin
                .from('organization_team_members')
                .select('*')
                .eq('owner_user_id', ownerUserId)
                .order('created_at', { ascending: false });

            if (data) {
                return NextResponse.json({
                    success: true,
                    members: data,
                    rolePresets: TEAM_ROLE_PRESETS,
                });
            }
        }

        return NextResponse.json({
            success: true,
            members: [],
            rolePresets: TEAM_ROLE_PRESETS,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to load team members' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const supabaseAdmin = getServiceSupabase();
        const { action } = body;

        if (action === 'invite') {
            const {
                memberEmail,
                teamRole = 'devops_deployer',
                allowedServiceIds = [],
            } = body;

            const ownerUserId =
                auth.role === 'admin' && typeof body.ownerUserId === 'string' && body.ownerUserId.trim()
                    ? body.ownerUserId.trim()
                    : auth.user.id;

            if (!memberEmail || !memberEmail.includes('@')) {
                return NextResponse.json(
                    { error: 'Valid team member email is required' },
                    { status: 400 }
                );
            }

            const rolePreset =
                TEAM_ROLE_PRESETS[teamRole as TeamRoleId] || TEAM_ROLE_PRESETS.devops_deployer;
            const inviteToken = `inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

            const newRecord = {
                id: crypto.randomUUID(),
                owner_user_id: ownerUserId,
                member_email: String(memberEmail).toLowerCase().trim(),
                team_role: teamRole,
                allowed_scopes: rolePreset.scopes,
                allowed_service_ids: allowedServiceIds,
                invite_status: 'pending_invite',
                invite_token: inviteToken,
                created_at: new Date().toISOString(),
            };

            if (supabaseAdmin && ownerUserId) {
                const { data, error } = await supabaseAdmin
                    .from('organization_team_members')
                    .upsert(newRecord, { onConflict: 'owner_user_id,member_email' })
                    .select()
                    .single();
                if (!error && data) {
                    return NextResponse.json({
                        success: true,
                        member: data,
                        inviteUrl: buildPortalUrl(`/login?invite=${inviteToken}`),
                    });
                }
            }

            return NextResponse.json({
                success: true,
                member: newRecord,
                inviteUrl: buildPortalUrl(`/login?invite=${inviteToken}`),
            });
        }

        if (action === 'revoke') {
            const { memberId } = body;
            if (supabaseAdmin && memberId) {
                const { data: existingMember } = await supabaseAdmin
                    .from('organization_team_members')
                    .select('owner_user_id')
                    .eq('id', memberId)
                    .maybeSingle();

                if (existingMember && existingMember.owner_user_id !== auth.user.id && auth.role !== 'admin') {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }

                await supabaseAdmin
                    .from('organization_team_members')
                    .delete()
                    .eq('id', memberId);
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported team action' }, { status: 400 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Team operation failed' },
            { status: 500 }
        );
    }
}
