import { NextResponse } from 'next/server';
import { whmClient } from '@/lib/whmClient';
import { checkRateLimit } from '@/lib/edgeRateLimit';

export async function POST(request: Request) {
  // Rate limit admin API
  const rateLimit = checkRateLimit(request, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, username, reason } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Action parameter is required (list, suspend, unsuspend, status)' },
        { status: 400 }
      );
    }

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        ...whmClient.getStatus(),
      });
    }

    if (action === 'list') {
      const result = await whmClient.listAccounts();
      return NextResponse.json(result);
    }

    if (action === 'suspend') {
      if (!username) {
        return NextResponse.json({ error: 'Username required for suspension' }, { status: 400 });
      }
      const result = await whmClient.suspendAccount(username, reason || 'Admin action');
      return NextResponse.json(result);
    }

    if (action === 'unsuspend') {
      if (!username) {
        return NextResponse.json({ error: 'Username required for unsuspension' }, { status: 400 });
      }
      const result = await whmClient.unsuspendAccount(username);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid Action', message: `Action "${action}" is not recognized` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'WHM Management Error', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
