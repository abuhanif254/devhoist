import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/edgeRateLimit';

// Whitelist of valid DNS record types
const VALID_DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

// Basic domain sanitization regex
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export async function GET(req: NextRequest) {
  // 1. Rate limiting: 30 requests per minute
  const rateLimitResult = checkRateLimit(req, 30);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.reset),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const tool = searchParams.get('tool');

  try {
    // ------------------------------------------------------------------------
    // TOOL 1: Live DNS Record Propagation & Record Checker
    // ------------------------------------------------------------------------
    if (tool === 'dns') {
      const rawDomain = (searchParams.get('domain') || '').trim().toLowerCase();
      const rawType = (searchParams.get('type') || 'A').toUpperCase();

      if (!rawDomain || !DOMAIN_REGEX.test(rawDomain)) {
        return NextResponse.json(
          { error: 'Invalid domain format. Example: example.com' },
          { status: 400 }
        );
      }

      const recordType = VALID_DNS_TYPES.includes(rawType) ? rawType : 'A';

      // Query Cloudflare DNS-over-HTTPS (DoH) JSON endpoint
      const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(rawDomain)}&type=${recordType}`;
      const dohRes = await fetch(dohUrl, {
        headers: { Accept: 'application/dns-json' },
        cache: 'no-store',
      });

      if (!dohRes.ok) {
        return NextResponse.json(
          { error: 'Failed to query DNS resolver' },
          { status: 502 }
        );
      }

      const dohData = await dohRes.json();
      const answers = (dohData.Answer || []).map((ans: any) => ({
        name: ans.name,
        type: recordType,
        ttl: ans.TTL,
        data: ans.data,
      }));

      return NextResponse.json(
        {
          tool: 'dns',
          domain: rawDomain,
          recordType,
          status: dohData.Status === 0 ? 'NOERROR' : `Status Code ${dohData.Status}`,
          answers,
          server: 'Cloudflare Global Anycast 1.1.1.1',
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    // ------------------------------------------------------------------------
    // TOOL 2: Live WHOIS & RDAP Domain Registry Lookup
    // ------------------------------------------------------------------------
    if (tool === 'whois') {
      const rawDomain = (searchParams.get('domain') || '').trim().toLowerCase();

      if (!rawDomain || !DOMAIN_REGEX.test(rawDomain)) {
        return NextResponse.json(
          { error: 'Invalid domain format for WHOIS lookup.' },
          { status: 400 }
        );
      }

      // Query public RDAP gateway
      const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(rawDomain)}`;
      const rdapRes = await fetch(rdapUrl, {
        headers: { Accept: 'application/rdap+json' },
        cache: 'no-store',
      });

      if (rdapRes.status === 404) {
        return NextResponse.json({
          tool: 'whois',
          domain: rawDomain,
          available: true,
          message: 'Domain appears available or unregistered.',
        });
      }

      if (!rdapRes.ok) {
        return NextResponse.json(
          { error: `RDAP lookup failed with status: ${rdapRes.status}` },
          { status: 502 }
        );
      }

      const data = await rdapRes.json();

      // Extract entities (registrar, registrant)
      let registrar = 'Unknown / Privacy Protected';
      if (Array.isArray(data.entities)) {
        const registrarEntity = data.entities.find((e: any) =>
          e.roles?.includes('registrar')
        );
        if (registrarEntity?.vcardArray?.[1]) {
          const fn = registrarEntity.vcardArray[1].find((v: any) => v[0] === 'fn');
          if (fn?.[3]) registrar = fn[3];
        }
      }

      // Extract events (registration, expiration, last changed)
      let registrationDate: string | null = null;
      let expirationDate: string | null = null;
      let lastUpdatedDate: string | null = null;

      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.eventAction === 'registration') registrationDate = ev.eventDate;
          if (ev.eventAction === 'expiration') expirationDate = ev.eventDate;
          if (ev.eventAction === 'last changed') lastUpdatedDate = ev.eventDate;
        }
      }

      // Extract nameservers
      const nameservers: string[] = [];
      if (Array.isArray(data.nameservers)) {
        for (const ns of data.nameservers) {
          if (ns.ldhName) nameservers.push(ns.ldhName.toLowerCase());
        }
      }

      return NextResponse.json(
        {
          tool: 'whois',
          domain: rawDomain,
          available: false,
          registrar,
          registrationDate,
          expirationDate,
          lastUpdatedDate,
          status: data.status || [],
          nameservers,
          rawHandle: data.handle || null,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    }

    // ------------------------------------------------------------------------
    // TOOL 3: HTTP Response & SSL Security Header Auditor
    // ------------------------------------------------------------------------
    if (tool === 'headers') {
      let rawUrl = (searchParams.get('url') || '').trim();
      if (!rawUrl) {
        return NextResponse.json({ error: 'URL parameter is required.' }, { status: 400 });
      }

      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid URL structure' }, { status: 400 });
      }

      const startTime = Date.now();
      let auditRes: Response;
      try {
        auditRes = await fetch(parsed.toString(), {
          method: 'HEAD',
          redirect: 'follow',
          cache: 'no-store',
        });
      } catch (err: any) {
        // Retry with GET if HEAD is rejected by server
        try {
          auditRes = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'follow',
            cache: 'no-store',
          });
        } catch (getErr: any) {
          return NextResponse.json(
            { error: `Connection failed: ${getErr.message || 'Host unreachable'}` },
            { status: 502 }
          );
        }
      }

      const responseTimeMs = Date.now() - startTime;
      const headers = auditRes.headers;

      const hsts = headers.get('strict-transport-security');
      const xfo = headers.get('x-frame-options');
      const csp = headers.get('content-security-policy');
      const xcto = headers.get('x-content-type-options');
      const referrer = headers.get('referrer-policy');
      const permissions = headers.get('permissions-policy');
      const server = headers.get('server') || 'Hidden / Cloudflare Protected';

      // Security Scoring Engine
      let score = 0;
      if (hsts) score += 25;
      if (csp) score += 30;
      if (xfo) score += 15;
      if (xcto) score += 15;
      if (referrer) score += 10;
      if (permissions) score += 5;

      let grade = 'F';
      if (score >= 90) grade = 'A+';
      else if (score >= 80) grade = 'A';
      else if (score >= 65) grade = 'B';
      else if (score >= 45) grade = 'C';
      else if (score >= 25) grade = 'D';

      return NextResponse.json({
        tool: 'headers',
        targetUrl: parsed.toString(),
        statusCode: auditRes.status,
        statusText: auditRes.statusText,
        responseTimeMs,
        server,
        grade,
        score,
        headersAudited: {
          'strict-transport-security': hsts || 'Missing',
          'content-security-policy': csp ? 'Configured' : 'Missing',
          'x-frame-options': xfo || 'Missing',
          'x-content-type-options': xcto || 'Missing',
          'referrer-policy': referrer || 'Missing',
          'permissions-policy': permissions || 'Missing',
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid tool requested. Available tools: 'dns', 'whois', 'headers'" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Edge processing error' },
      { status: 500 }
    );
  }
}
