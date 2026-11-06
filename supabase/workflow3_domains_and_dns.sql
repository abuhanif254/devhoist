-- ==============================================================================
-- WORKFLOW 3 OF 6: CLOUDFLARE & NAMECHEAP-GRADE DYNAMIC DOMAIN PORTFOLIO,
-- RFC-VALIDATED DNS ZONE ENGINE, EPP TRANSFER STATE MACHINE & ADDON DOMAIN ROUTER
-- ==============================================================================

-- 1. CLOUDFLARE-GRADE INDIVIDUAL DNS RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA')),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INT DEFAULT NULL,
    ttl INT NOT NULL DEFAULT 3600,
    proxied BOOLEAN DEFAULT FALSE,
    comment TEXT,
    is_system_managed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast DNS Lookups & CNAME Conflict checks
CREATE INDEX IF NOT EXISTS idx_dns_domain_id ON public.domain_dns_records(domain_id);
CREATE INDEX IF NOT EXISTS idx_dns_lookup ON public.domain_dns_records(domain_id, name, record_type);
CREATE INDEX IF NOT EXISTS idx_dns_user_id ON public.domain_dns_records(user_id);

-- 2. PRIVATE BRANDED GLUE RECORDS (CHILD NAMESERVERS)
CREATE TABLE IF NOT EXISTS public.domain_child_nameservers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    ipv4_address TEXT NOT NULL,
    ipv6_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_ns_domain ON public.domain_child_nameservers(domain_id);

-- 3. DOMAIN 301/302 HTTP URL REDIRECTION ENGINE
CREATE TABLE IF NOT EXISTS public.domain_url_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_prefix TEXT NOT NULL DEFAULT '@',
    destination_url TEXT NOT NULL,
    redirect_type INT NOT NULL DEFAULT 301 CHECK (redirect_type IN (301, 302)),
    preserve_path_query BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_forward_domain ON public.domain_url_forwards(domain_id);

-- 4. INBOUND EPP DOMAIN TRANSFER STATE MACHINE (5-STEP NAMECHEAP FLOW)
CREATE TABLE IF NOT EXISTS public.domain_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL,
    tld TEXT NOT NULL,
    epp_code_encrypted TEXT NOT NULL,
    transfer_price_bdt NUMERIC(10, 2) NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id),
    current_step INT DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
        'pending_payment',
        'verifying_epp',
        'awaiting_losing_registrar',
        'completed',
        'rejected_invalid_epp',
        'locked_at_source'
    )),
    status_message TEXT,
    auto_import_dns BOOLEAN DEFAULT TRUE,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfers_user ON public.domain_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_domain ON public.domain_transfers(domain_name);

-- 5. HOSTING ADDON DOMAINS, SUBDOMAINS, PARKED ALIASES & STAGING CLONES
CREATE TABLE IF NOT EXISTS public.hosting_addon_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_type TEXT NOT NULL DEFAULT 'addon_domain' CHECK (domain_type IN (
        'addon_domain',
        'subdomain',
        'parked_alias',
        'staging_clone'
    )),
    hostname TEXT UNIQUE NOT NULL,
    document_root TEXT NOT NULL,
    runtime_engine TEXT DEFAULT 'Node.js 22 LTS',
    ssl_status TEXT DEFAULT 'active_tls13' CHECK (ssl_status IN ('active_tls13', 'provisioning', 'expired')),
    force_https BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_service ON public.hosting_addon_domains(service_id);
CREATE INDEX IF NOT EXISTS idx_addon_user ON public.hosting_addon_domains(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.domain_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_child_nameservers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_url_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_addon_domains ENABLE ROW LEVEL SECURITY;

-- 1. domain_dns_records Policies
CREATE POLICY "Users view own domain dns records" ON public.domain_dns_records
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users insert own domain dns records" ON public.domain_dns_records
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users update own domain dns records" ON public.domain_dns_records
    FOR UPDATE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users delete own domain dns records" ON public.domain_dns_records
    FOR DELETE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 2. domain_child_nameservers Policies
CREATE POLICY "Users manage own child nameservers" ON public.domain_child_nameservers
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 3. domain_url_forwards Policies
CREATE POLICY "Users manage own url forwards" ON public.domain_url_forwards
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 4. domain_transfers Policies
CREATE POLICY "Users view own domain transfers" ON public.domain_transfers
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users insert domain transfers" ON public.domain_transfers
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Admins manage all domain transfers" ON public.domain_transfers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 5. hosting_addon_domains Policies
CREATE POLICY "Users manage own addon domains" ON public.hosting_addon_domains
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- ==============================================================================
-- AUTOMATIC SEEDING FOR EXISTING DOMAINS & SERVICES
-- ==============================================================================

-- Seed standard baseline DNS records for any registered domain if none exist
INSERT INTO public.domain_dns_records (domain_id, user_id, record_type, name, content, priority, ttl, proxied, comment, is_system_managed)
SELECT 
    d.id,
    d.user_id,
    r.record_type,
    r.name,
    r.content,
    r.priority,
    r.ttl,
    r.proxied,
    r.comment,
    r.is_system_managed
FROM public.domains d
CROSS JOIN LATERAL (
    VALUES 
        ('A', '@', '103.151.102.45', NULL::INT, 3600, TRUE, 'Apex Web Traffic (SG1 Edge Node)', TRUE),
        ('CNAME', 'www', '@', NULL::INT, 3600, TRUE, 'WWW sub-zone alias', TRUE),
        ('A', 'mail', '103.151.102.45', NULL::INT, 14400, FALSE, 'Direct Mail Server Endpoint', FALSE),
        ('MX', '@', 'mail.' || d.domain_name, 10::INT, 14400, FALSE, 'Primary cPanel Exim Mail Delivery', FALSE),
        ('TXT', '@', 'v=spf1 +a +mx +ip4:103.151.102.45 ~all', NULL::INT, 3600, FALSE, 'SPF Anti-Spoofing Policy', FALSE),
        ('TXT', '_dmarc', 'v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@' || d.domain_name, NULL::INT, 3600, FALSE, 'DMARC Quarantine Policy', FALSE),
        ('CAA', '@', '0 issue "letsencrypt.org"', NULL::INT, 3600, FALSE, 'AutoSSL Certificate Authority Permit', FALSE)
) AS r(record_type, name, content, priority, ttl, proxied, comment, is_system_managed)
WHERE NOT EXISTS (
    SELECT 1 FROM public.domain_dns_records WHERE domain_id = d.id
)
ON CONFLICT DO NOTHING;

-- Seed child nameservers for default domain
INSERT INTO public.domain_child_nameservers (domain_id, user_id, hostname, ipv4_address)
SELECT d.id, d.user_id, 'ns1.' || d.domain_name, '103.151.102.45'
FROM public.domains d
WHERE NOT EXISTS (
    SELECT 1 FROM public.domain_child_nameservers WHERE domain_id = d.id
)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Seed default addon domains / subdomains for existing hosting services
INSERT INTO public.hosting_addon_domains (service_id, user_id, domain_type, hostname, document_root, runtime_engine, ssl_status, force_https)
SELECT 
    s.id,
    s.user_id,
    'subdomain',
    'api.' || s.domain,
    '/home/' || s.cpanel_username || '/api.' || s.domain,
    'Node.js 22 LTS',
    'active_tls13',
    TRUE
FROM public.hosting_services s
WHERE NOT EXISTS (
    SELECT 1 FROM public.hosting_addon_domains WHERE service_id = s.id
)
ON CONFLICT (hostname) DO NOTHING;
