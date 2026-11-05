import { NextResponse } from 'next/server';
import { WHMCS_CONFIG } from '@/config/constants';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';
import { checkRateLimit } from '@/lib/edgeRateLimit';

export const runtime = 'edge';

const ALLOWED_PLANS = new Set([1, 2, 3]);
const ALLOWED_PANELS = new Set(['cpanel', 'cyberpanel', 'wordpress_admin', 'custom_vps']);
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function sanitizeString(str: unknown, maxLen = 120): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"&]/g, '') // Strip HTML characters
    .trim()
    .slice(0, maxLen);
}

export async function POST(request: Request) {
  // Edge sliding window rate limit (10 migration requests/minute to prevent spam)
  const rateLimit = checkRateLimit(request, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit reached. Please wait a moment before resubmitting.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.reset),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // Check request body size
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16384) {
    return NextResponse.json({ error: 'Payload too large (max 16KB allowed)' }, { status: 413 });
  }

  try {
    const body = await request.json();

    const fullName = sanitizeString(body.fullName, 80);
    const email = sanitizeString(body.email, 120).toLowerCase();
    const whatsappNumber = sanitizeString(body.whatsappNumber || body.phone, 30);
    const rawWebsite = sanitizeString(body.websiteUrl || body.domain, 100);
    const currentHostName = sanitizeString(body.currentHostName || body.currentHost, 60);
    const controlPanelType = ALLOWED_PANELS.has(body.controlPanelType) ? body.controlPanelType : 'cpanel';
    const planIdNumber = Number(body.selectedPlanId || body.planId || body.targetPlanId);
    const selectedPlanId = (ALLOWED_PLANS.has(planIdNumber) ? planIdNumber : 2) as 1 | 2 | 3;

    // Strict validation
    if (!fullName || !email || !rawWebsite || !currentHostName) {
      return NextResponse.json(
        { error: 'Missing required migration fields (fullName, email, websiteUrl, currentHostName)' },
        { status: 400 }
      );
    }

    // Email regex validation
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    // Sanitize website url
    const sanitizedUrl = rawWebsite
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[^a-zA-Z0-9.-]/g, '');

    if (!sanitizedUrl || sanitizedUrl.length < 3) {
      return NextResponse.json({ error: 'Invalid website domain format' }, { status: 400 });
    }

    // Construct direct WHMCS ticket subject and migration URL
    const ticketSubject = `Free Migration Request - ${sanitizedUrl}`;
    const ticketUrl = `${WHMCS_CONFIG.WHMCS_URL}/submitticket.php?step=2&deptid=2&subject=${encodeURIComponent(ticketSubject)}`;

    // Build the recommended hosting order cart link
    const orderCartUrl = buildHostingOrderUrl(selectedPlanId, false, 'BDT');

    return NextResponse.json(
      {
        success: true,
        message: 'Migration qualification verified. Directing to secure WHMCS ticket portal.',
        data: {
          fullName,
          email,
          whatsappNumber: whatsappNumber || 'N/A',
          websiteUrl: sanitizedUrl,
          currentHostName,
          controlPanelType,
          selectedPlanId,
          ticketRedirectUrl: ticketUrl,
          hostingOrderUrl: orderCartUrl,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }
}
