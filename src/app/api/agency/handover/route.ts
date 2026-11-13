import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';


// Mock in-memory store for local sandbox testing if Supabase is offline
const inMemoryHandovers = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const devUserId = searchParams.get('devUserId');

    if (token) {
      if (isSupabaseConfigured()) {
        try {
          const db = getServiceSupabase();
          const { data, error } = await db
            .from('agency_handover_transfers')
            .select('*')
            .eq('handover_token', token)
            .single();

          if (data && !error) {
            return NextResponse.json({ success: true, handover: data });
          }
          if (!isDevSandboxMode()) {
            return NextResponse.json(
              { success: false, error: 'Handover token not found or expired.' },
              { status: 404 }
            );
          }
        } catch (dbErr) {
          console.warn('[Handover DB Read Warning]', dbErr);
          if (!isDevSandboxMode()) {
            return serviceUnavailableResponse('Agency Handover Portal');
          }
        }
      } else if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Agency Handover Portal');
      }

      // Check fallback in-memory (DEV_SANDBOX_MODE only)
      const fallback = inMemoryHandovers.get(token);
      if (fallback) {
        return NextResponse.json({ success: true, handover: fallback });
      }

      // Default mock handover for instant UI testing in DEV_SANDBOX_MODE only
      return NextResponse.json({
        success: true,
        handover: {
          id: 'ho_mock_1',
          handover_token: token,
          client_name: 'TechCorp Solutions',
          client_email: 'finance@techcorp.bd',
          project_title: 'Next.js Enterprise eCommerce & ERP Portal',
          plan_slug: 'developer-pro',
          billing_cycle: 'annual',
          developer_name: 'Tanvir Ahmed (DevHost Agency Partner)',
          developer_setup_fee_bdt: 12500,
          hosting_price_bdt: 4320,
          total_payable_bdt: 16820,
          keep_developer_ssh_git_access: true,
          lock_recurring_affiliate_commission: true,
          status: 'pending_client_claim',
          expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      });
    }

    // List handovers for authenticated developer only
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const targetDevId = auth.role === 'admin' && devUserId ? devUserId : auth.user.id;
    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data } = await db
        .from('agency_handover_transfers')
        .select('*')
        .eq('developer_user_id', targetDevId)
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, handovers: data || [] });
    }

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Agency Handover Portal');
      }
      return NextResponse.json({
        success: true,
        handovers: Array.from(inMemoryHandovers.values()).filter(
          (h) => h.developer_user_id === targetDevId || auth.role === 'admin'
        ),
      });
    }

    return NextResponse.json({ success: true, handovers: [] });
  } catch (error: any) {
    console.error('[Handover GET Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load handover details' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      developerName,
      serviceId,
      clientName,
      clientEmail,
      projectTitle,
      planSlug = 'developer-pro',
      billingCycle = 'annual',
      developerSetupFeeBDT = 0,
      hostingPriceBDT = 4320,
    } = body;

    if (serviceId) {
      const srvAccess = await requireServiceAccess(request, serviceId, 'services:write');
      if (!srvAccess.ok) return srvAccess.response;
    }

    const developerUserId = auth.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Agency Handover Portal');
    }

    if (!clientName || !clientEmail || !projectTitle) {
      return NextResponse.json(
        { error: 'Client name, email, and project title are required.' },
        { status: 400 }
      );
    }

    const handoverToken = `dh_ho_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const handoverRecord = {
      id: `ho_${Date.now()}`,
      handover_token: handoverToken,
      developer_user_id: developerUserId || 'dev_master',
      developer_name: developerName || 'Agency Lead Developer',
      service_id: serviceId || `srv_${Date.now()}`,
      client_name: clientName.trim(),
      client_email: clientEmail.trim().toLowerCase(),
      project_title: projectTitle.trim(),
      plan_slug: planSlug,
      billing_cycle: billingCycle,
      developer_setup_fee_bdt: Number(developerSetupFeeBDT) || 0,
      hosting_price_bdt: Number(hostingPriceBDT) || 4320,
      total_payable_bdt: (Number(developerSetupFeeBDT) || 0) + (Number(hostingPriceBDT) || 4320),
      keep_developer_ssh_git_access: true,
      lock_recurring_affiliate_commission: true,
      status: 'pending_client_claim',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const db = getServiceSupabase();
        await db.from('agency_handover_transfers').insert({
          handover_token: handoverToken,
          developer_user_id: developerUserId,
          service_id: serviceId,
          client_name: handoverRecord.client_name,
          client_email: handoverRecord.client_email,
          project_title: handoverRecord.project_title,
          plan_slug: handoverRecord.plan_slug,
          billing_cycle: handoverRecord.billing_cycle,
          developer_setup_fee_bdt: handoverRecord.developer_setup_fee_bdt,
          hosting_price_bdt: handoverRecord.hosting_price_bdt,
          keep_developer_ssh_git_access: true,
          lock_recurring_affiliate_commission: true,
          status: 'pending_client_claim',
          expires_at: expiresAt,
        });
      } catch (err) {
        console.warn('[Handover DB Insert Warning]', err);
      }
    }

    inMemoryHandovers.set(handoverToken, handoverRecord);

    return NextResponse.json({
      success: true,
      handoverToken,
      handoverUrl: `https://devhost.cloud/handover/${handoverToken}`,
      handover: handoverRecord,
    });
  } catch (error: any) {
    console.error('[Handover POST Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to create handover' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { handoverToken, trxId } = body;
    const clientUserId = auth.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Agency Handover Portal');
    }

    if (!handoverToken) {
      return NextResponse.json({ error: 'Handover token is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data: existingHo } = await db
        .from('agency_handover_transfers')
        .select('id, status, client_email')
        .eq('handover_token', handoverToken)
        .maybeSingle();

      if (existingHo?.status === 'claimed_and_paid') {
        return NextResponse.json(
          { error: 'Handover token has already been claimed.' },
          { status: 409 }
        );
      }

      if (
        existingHo?.client_email &&
        existingHo.client_email.toLowerCase() !== auth.profile.email &&
        auth.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: This handover invitation belongs to a different client email address.' },
          { status: 403 }
        );
      }

      await db
        .from('agency_handover_transfers')
        .update({
          status: 'claimed_and_paid',
          claimed_by_user_id: clientUserId,
        })
        .eq('handover_token', handoverToken);
    }

    const cached = inMemoryHandovers.get(handoverToken);
    if (cached) {
      cached.status = 'claimed_and_paid';
      cached.claimed_by_user_id = clientUserId;
      inMemoryHandovers.set(handoverToken, cached);
    }

    return NextResponse.json({
      success: true,
      message: 'Project claimed and service ownership successfully transferred to client account.',
      trxId: trxId || `CLAIM-${Date.now()}`,
    });
  } catch (error: any) {
    console.error('[Handover Claim Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to process handover claim' }, { status: 500 });
  }
}
