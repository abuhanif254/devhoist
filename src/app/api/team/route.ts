import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export type TeamRoleId =
    | 'full_admin'
    | 'devops_deployer'
    | 'dns_domain_manager'
    | 'billing_accountant'
    | 'readonly_auditor';

export const TEAM_ROLE_PRESETS: Record<
    TeamRoleId,
    {
        label: string;
        description: string;
        scopes: string[];
        badgeColor: string;
    }
> = {
    full_admin: {
        label: 'Full Organization Admin',
        description: 'Complete access to services, Git CI/CD, DNS, billing, and team management.',
        scopes: [
            'services:read',
            'services:write',
            'git:deploy',
            'env:write',
            'logs:read',
            'dns:write',
            'billing:write',
            'team:manage',
        ],
        badgeColor: 'purple',
    },
    devops_deployer: {
        label: 'DevOps Deployer (Git, .ENV & Logs Only)',
        description: 'Can push releases, manage .env secrets, and inspect logs. Strictly blocked from billing & domain transfers.',
        scopes: ['services:read', 'git:deploy', 'env:write', 'logs:read'],
        badgeColor: 'blue',
    },
    dns_domain_manager: {
        label: 'DNS & Domain Manager',
        description: 'Can edit DNS zone records, SSL certificates, and nameservers. No access to source code or billing.',
        scopes: ['domains:read', 'dns:write', 'ssl:manage'],
        badgeColor: 'emerald',
    },
    billing_accountant: {
        label: 'Billing Accountant (Invoices & Wallet Only)',
        description: 'Can view/pay invoices, download VAT receipts, and top up wallet. No access to servers or code.',
        scopes: ['billing:read', 'billing:write', 'invoices:download'],
        badgeColor: 'amber',
    },
    readonly_auditor: {
        label: 'Read-Only Security Auditor',
        description: 'View-only access to server telemetry, uptime SLA, and audit logs. Cannot modify any settings.',
        scopes: ['services:read', 'logs:read', 'billing:read'],
        badgeColor: 'slate',
    },
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ownerUserId = searchParams.get('ownerUserId');
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
        const body = await request.json();
        const supabaseAdmin = getServiceSupabase();
        const { action } = body;

        if (action === 'invite') {
            const {
                ownerUserId,
                memberEmail,
                teamRole = 'devops_deployer',
                allowedServiceIds = [],
            } = body;

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
                owner_user_id: ownerUserId || '00000000-0000-0000-0000-000000000000',
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
                        inviteUrl: `https://devhoist.devhoist.workers.dev/login?invite=${inviteToken}`,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                member: newRecord,
                inviteUrl: `https://devhoist.devhoist.workers.dev/login?invite=${inviteToken}`,
            });
        }

        if (action === 'revoke') {
            const { memberId } = body;
            if (supabaseAdmin && memberId) {
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
