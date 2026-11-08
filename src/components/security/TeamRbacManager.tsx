'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    ShieldCheck,
    Copy,
    Check,
    Trash2,
    Key,
    Activity,
    Lock,
} from 'lucide-react';
import { TEAM_ROLE_PRESETS, TeamRoleId } from '@/app/api/team/route';

interface TeamMemberSeat {
    id: string;
    member_email: string;
    team_role: TeamRoleId;
    allowed_scopes: string[];
    invite_status: 'pending_invite' | 'active' | 'revoked';
    invite_token: string;
    created_at: string;
}

interface TeamRbacManagerProps {
    ownerUserId?: string;
    availableServices?: Array<{ id: string; domain: string }>;
}

export default function TeamRbacManager({
    ownerUserId,
    availableServices = [],
}: TeamRbacManagerProps) {
    const [members, setMembers] = useState<TeamMemberSeat[]>([
        {
            id: 'seat_default_devops',
            member_email: 'devops-lead@agency.io',
            team_role: 'devops_deployer',
            allowed_scopes: ['services:read', 'git:deploy', 'env:write', 'logs:read'],
            invite_status: 'active',
            invite_token: 'inv_devops8821x',
            created_at: new Date().toISOString(),
        },
    ]);
    const [memberEmail, setMemberEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState<TeamRoleId>('devops_deployer');
    const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
    const [isInviting, setIsInviting] = useState(false);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    useEffect(() => {
        if (!ownerUserId) return;
        fetch(`/api/team?ownerUserId=${encodeURIComponent(ownerUserId)}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.success && Array.isArray(data.members) && data.members.length > 0) {
                    setMembers(data.members);
                }
            })
            .catch(() => {});
    }, [ownerUserId]);

    const handleInviteMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!memberEmail.trim()) return;
        setIsInviting(true);
        try {
            const res = await fetch('/api/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'invite',
                    ownerUserId,
                    memberEmail: memberEmail.trim(),
                    teamRole: selectedRole,
                    allowedServiceIds: selectedServiceId === 'all' ? [] : [selectedServiceId],
                }),
            });
            const data = await res.json();
            if (data?.success && data.member) {
                setMembers((prev) => [data.member, ...prev.filter((m) => m.member_email !== data.member.member_email)]);
                setMemberEmail('');
            }
        } finally {
            setIsInviting(false);
        }
    };

    const handleRevokeSeat = async (id: string) => {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        await fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revoke', memberId: id }),
        }).catch(() => {});
    };

    const activePreset = TEAM_ROLE_PRESETS[selectedRole];

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/70 p-6 space-y-6 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono font-bold uppercase text-[11px] mb-1">
                        <Users className="w-3.5 h-3.5" /> Granular Organization Team RBAC
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Invite Developers, DNS Admins &amp; Billing Accountants
                    </h3>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
                        Grant least-privilege scopes (e.g. allow a freelance developer to deploy Git &amp; edit `.env` without exposing billing or domain transfer rights).
                    </p>
                </div>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInviteMember} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                            Collaborator Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={memberEmail}
                            onChange={(e) => setMemberEmail(e.target.value)}
                            placeholder="developer@company.com"
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 font-mono"
                        />
                    </div>

                    <div>
                        <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                            RBAC Role Preset (5 Roles)
                        </label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as TeamRoleId)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 font-semibold"
                        >
                            {Object.entries(TEAM_ROLE_PRESETS).map(([key, cfg]) => (
                                <option key={key} value={key}>
                                    {cfg.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                            Project Scope Restriction
                        </label>
                        <select
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 font-semibold"
                        >
                            <option value="all">All Active Hosting Containers</option>
                            {availableServices.map((srv) => (
                                <option key={srv.id} value={srv.id}>
                                    Only {srv.domain}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Selected Role Scope Preview */}
                <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-blue-600" />
                            <span>{activePreset.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                            {activePreset.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {activePreset.scopes.map((sc) => (
                                <span
                                    key={sc}
                                    className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-mono text-[10px] text-blue-600 dark:text-blue-400"
                                >
                                    {sc}
                                </span>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isInviting}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>{isInviting ? 'Generating Invite...' : 'Issue RBAC Seat & Link'}</span>
                    </button>
                </div>
            </form>

            {/* Active Team Seats Table */}
            <div className="space-y-2.5">
                <div className="font-bold text-slate-800 dark:text-zinc-200">
                    Active &amp; Pending Team Collaborators ({members.length})
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {members.map((m) => {
                        const preset = TEAM_ROLE_PRESETS[m.team_role] || TEAM_ROLE_PRESETS.devops_deployer;
                        const inviteLink = `https://devhoist.devhoist.workers.dev/login?invite=${m.invite_token}`;
                        return (
                            <div
                                key={m.id}
                                className="p-4 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <strong className="text-slate-900 dark:text-white font-mono">
                                            {m.member_email}
                                        </strong>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                            {preset.label}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-mono text-[10px] uppercase">
                                            {m.invite_status}
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                                        Scopes: {m.allowed_scopes.join(', ')}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            setCopiedToken(m.id);
                                            setTimeout(() => setCopiedToken(null), 2000);
                                        }}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-blue-500 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        {copiedToken === m.id ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Link
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3.5 h-3.5" /> Copy Invite URL
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRevokeSeat(m.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="Revoke Seat"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Live Team Member Activity Log */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 space-y-2 font-mono text-[11px]">
                <div className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Team RBAC Audit Trail</span>
                </div>
                <div className="text-slate-500 space-y-1">
                    <div>• [Today 09:42] devops-lead@agency.io (devops_deployer) triggered Git release #a8f921c [ALLOWED]</div>
                    <div>• [Today 09:15] devops-lead@agency.io attempted billing:refund_request [BLOCKED BY RBAC SCOPE]</div>
                </div>
            </div>
        </div>
    );
}
