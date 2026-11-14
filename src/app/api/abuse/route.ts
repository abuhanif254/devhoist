import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { scanDomainForPhishing, quarantineAbuseDomain } from '@/lib/abuseShieldEngine';
import { sendTelegramAlert } from '@/lib/adminNotifier';
import { requireAdmin } from '@/lib/authGuard';
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/legalDocuments';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'legal';
        const supabaseAdmin = getServiceSupabase();

        if (type === 'legal') {
            if (supabaseAdmin) {
                const { data } = await supabaseAdmin
                    .from('cms_legal_documents')
                    .select('*')
                    .order('slug', { ascending: true });
                if (data && data.length > 0) {
                    return NextResponse.json({ success: true, documents: data });
                }
            }
            return NextResponse.json({ success: true, documents: DEFAULT_LEGAL_DOCUMENTS });
        }

        // Otherwise list abuse reports (Admin only)
        const adminAuth = await requireAdmin(request);
        if (!adminAuth.ok) return adminAuth.response;

        if (supabaseAdmin) {
            const { data } = await supabaseAdmin
                .from('public_abuse_reports')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            return NextResponse.json({ success: true, reports: data || [] });
        }

        return NextResponse.json({ success: true, reports: [] });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to fetch compliance data' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const supabaseAdmin = getServiceSupabase();

        // Action A: Admin updates a legal document
        if (body.action === 'update_legal_doc') {
            const adminAuth = await requireAdmin(request);
            if (!adminAuth.ok) return adminAuth.response;

            if (!supabaseAdmin) {
                return NextResponse.json({ success: true, document: body.document });
            }
            const { data, error } = await supabaseAdmin
                .from('cms_legal_documents')
                .upsert(
                    {
                        ...body.document,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'slug' }
                )
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, document: data });
        }

        // Action B: Admin updates an abuse report status
        if (body.action === 'update_abuse_status') {
            const adminAuth = await requireAdmin(request);
            if (!adminAuth.ok) return adminAuth.response;

            const { reportId, status, adminResolutionNote } = body;
            if (supabaseAdmin && reportId) {
                await supabaseAdmin
                    .from('public_abuse_reports')
                    .update({
                        status,
                        admin_resolution_note: adminResolutionNote || null,
                    })
                    .eq('id', reportId);
            }
            return NextResponse.json({ success: true });
        }

        // Action C: Public Abuse / Phishing / DMCA Submission
        const {
            reporterName,
            reporterEmail,
            reporterOrganization,
            abuseType,
            reportedUrlOrIp,
            evidenceLogs,
            swornDeclaration,
        } = body;

        if (!reporterName || !reporterEmail || !reportedUrlOrIp || !evidenceLogs) {
            return NextResponse.json(
                { error: 'Reporter name, email, target URL/IP, and evidence logs are required.' },
                { status: 400 }
            );
        }

        if (!swornDeclaration) {
            return NextResponse.json(
                { error: 'You must affirm the good-faith declaration to submit an official notice.' },
                { status: 400 }
            );
        }

        const cleanHost = String(reportedUrlOrIp)
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .trim()
            .toLowerCase();

        // Run automated Abuse Shield scan
        const phishingScan = scanDomainForPhishing(cleanHost);
        const ticketRef = `ABUSE-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const initialStatus =
            phishingScan.isThreat && phishingScan.riskScore >= 70
                ? 'domain_quarantined'
                : 'received_investigating';

        if (phishingScan.isThreat && phishingScan.riskScore >= 70) {
            await quarantineAbuseDomain({
                hostname: cleanHost,
                scanResult: phishingScan,
            });
        }

        if (supabaseAdmin) {
            await supabaseAdmin.from('public_abuse_reports').insert({
                ticket_reference: ticketRef,
                reporter_name: reporterName,
                reporter_email: reporterEmail,
                reporter_organization: reporterOrganization || null,
                abuse_type: abuseType || 'phishing_fraud',
                reported_url_or_ip: reportedUrlOrIp,
                evidence_logs: evidenceLogs,
                sworn_good_faith_declaration: true,
                status: initialStatus,
                admin_resolution_note: phishingScan.isThreat
                    ? `Automated Abuse Shield triggered (${phishingScan.reason}, Risk Score: ${phishingScan.riskScore}/100)`
                    : null,
            });
        }

        // Notify Founder via Telegram (non-blocking)
        sendTelegramAlert(
            `🚨 *New Abuse/DMCA Report [${ticketRef}]*\n` +
                `• Target: \`${reportedUrlOrIp}\`\n` +
                `• Type: ${abuseType}\n` +
                `• Reporter: ${reporterName} (${reporterOrganization || reporterEmail})\n` +
                `• Auto-Scan Risk: ${phishingScan.riskScore}/100 (${initialStatus})`
        ).catch(() => {});

        return NextResponse.json({
            success: true,
            ticketReference: ticketRef,
            status: initialStatus,
            automatedScan: {
                isThreat: phishingScan.isThreat,
                riskScore: phishingScan.riskScore,
                reason: phishingScan.reason,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to process abuse report' },
            { status: 500 }
        );
    }
}
