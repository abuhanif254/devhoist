import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';


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
        } catch (dbErr) {
          console.warn('[Handover DB Read Warning]', dbErr);
        }
      }

      // Check fallback in-memory
      const fallback = inMemoryHandovers.get(token);
      if (fallback) {
        return NextResponse.json({ success: true, handover: fallback });
      }

      // Default mock handover for instant UI testing if no token found
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

    // List handovers for developer
    if (isSupabaseConfigured() && devUserId) {
      const db = getServiceSupabase();
      const { data } = await db
        .from('agency_handover_transfers')
        .select('*')
        .eq('developer_user_id', devUserId)
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, handovers: data || [] });
    }

    return NextResponse.json({
      success: true,
      handovers: Array.from(inMemoryHandovers.values()),
    });
  } catch (error: any) {
    console.error('[Handover GET Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load handover details' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      developerUserId,
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
    const body = await request.json();
    const { handoverToken, clientUserId, paymentMethod, trxId } = body;

    if (!handoverToken) {
      return NextResponse.json({ error: 'Handover token is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      try {
        const db = getServiceSupabase();
        await db
          .from('agency_handover_transfers')
          .update({
            status: 'claimed_and_paid',
            claimed_by_user_id: clientUserId || null,
          })
          .eq('handover_token', handoverToken);
      } catch (err) {
        console.warn('[Handover Claim DB Warning]', err);
      }
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
