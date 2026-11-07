-- ==============================================================================
-- DEVHOST CLOUD - AUTONOMOUS CLOUD OPERATIONS SUITE
-- 1. Real-Time Heartbeat & Self-Healing Telemetry (service_uptime_telemetry)
-- 2. AI DevOps Log Doctor & Diagnostic Scans (diagnostic_scans)
-- 3. Anti-Phishing & Upstream Abuse Shield (abuse_quarantine_events)
-- 4. Agency White-Label Client Handover Engine (agency_handover_transfers)
-- 5. Public Developer REST API Execution Ledger (developer_api_logs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. SERVICE UPTIME TELEMETRY & SELF-HEALING LOG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_uptime_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    http_status INT NOT NULL DEFAULT 200,
    response_time_ms INT NOT NULL DEFAULT 38,
    ssl_days_remaining INT DEFAULT 88,
    incident_type TEXT NOT NULL DEFAULT 'healthy' 
        CHECK (incident_type IN ('healthy', 'http_503_passenger_hang', 'high_memory_spike', 'ssl_expiring', 'dns_unrouted')),
    auto_healed BOOLEAN DEFAULT FALSE,
    healing_action_taken TEXT,
    uptime_30d_percent NUMERIC(5, 2) DEFAULT 99.99,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uptime_service_id ON public.service_uptime_telemetry(service_id);
CREATE INDEX IF NOT EXISTS idx_uptime_user_id ON public.service_uptime_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checked_at ON public.service_uptime_telemetry(checked_at DESC);

-- ------------------------------------------------------------------------------
-- B. DIAGNOSTIC SCANS (AI DEVOPS LOG DOCTOR AUDIT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    health_score INT NOT NULL CHECK (health_score BETWEEN 0 AND 100),
    detected_issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolved_without_ticket BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_service_id ON public.diagnostic_scans(service_id);
CREATE INDEX IF NOT EXISTS idx_diag_user_id ON public.diagnostic_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_diag_created_at ON public.diagnostic_scans(created_at DESC);

-- ------------------------------------------------------------------------------
-- C. ABUSE QUARANTINE EVENTS (ANTI-PHISHING & BRAND-SPOOFING SHIELD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.abuse_quarantine_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.hosting_services(id) ON DELETE SET NULL,
    flagged_hostname TEXT NOT NULL,
    threat_category TEXT NOT NULL 
        CHECK (threat_category IN ('phishing_brand_spoof', 'crypto_scam_pattern', 'malware_signature', 'outbound_smtp_spam', 'copyright_dmca')),
    matched_rule TEXT NOT NULL,
    risk_score INT NOT NULL DEFAULT 95,
    enforcement_action TEXT NOT NULL DEFAULT 'quarantined_pending_review' 
        CHECK (enforcement_action IN ('quarantined_pending_review', 'suspended_immediately', 'whitelisted_false_positive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_abuse_hostname ON public.abuse_quarantine_events(flagged_hostname);
CREATE INDEX IF NOT EXISTS idx_abuse_user_id ON public.abuse_quarantine_events(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_enforcement ON public.abuse_quarantine_events(enforcement_action);

-- ------------------------------------------------------------------------------
-- D. AGENCY HANDOVER TRANSFERS (FREELANCER TO CLIENT HANDOVER ENGINE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_handover_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_token TEXT UNIQUE NOT NULL,
    developer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    project_title TEXT NOT NULL,
    plan_slug TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'annual' CHECK (billing_cycle IN ('monthly', 'annual')),
    developer_setup_fee_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    hosting_price_bdt NUMERIC(10, 2) NOT NULL,
    keep_developer_ssh_git_access BOOLEAN DEFAULT TRUE,
    lock_recurring_affiliate_commission BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'pending_client_claim' 
        CHECK (status IN ('pending_client_claim', 'claimed_and_paid', 'expired', 'cancelled')),
    claimed_by_user_id UUID REFERENCES public.profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_token ON public.agency_handover_transfers(handover_token);
CREATE INDEX IF NOT EXISTS idx_handover_dev_id ON public.agency_handover_transfers(developer_user_id);
CREATE INDEX IF NOT EXISTS idx_handover_status ON public.agency_handover_transfers(status);

-- ------------------------------------------------------------------------------
-- E. DEVELOPER API LOGS (REST API V1 & TERMINAL CLI AUDIT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.developer_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_prefix TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    target_domain TEXT,
    status_code INT NOT NULL,
    ip_address TEXT,
    duration_ms INT DEFAULT 45,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON public.developer_api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.developer_api_logs(created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. service_uptime_telemetry RLS
ALTER TABLE public.service_uptime_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own uptime telemetry" ON public.service_uptime_telemetry;
CREATE POLICY "Users can view own uptime telemetry"
    ON public.service_uptime_telemetry FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Service role can manage telemetry" ON public.service_uptime_telemetry;
CREATE POLICY "Service role can manage telemetry"
    ON public.service_uptime_telemetry FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. diagnostic_scans RLS
ALTER TABLE public.diagnostic_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diagnostic scans" ON public.diagnostic_scans;
CREATE POLICY "Users can view own diagnostic scans"
    ON public.diagnostic_scans FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Users can insert own diagnostic scans" ON public.diagnostic_scans;
CREATE POLICY "Users can insert own diagnostic scans"
    ON public.diagnostic_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Service role can manage diagnostic scans" ON public.diagnostic_scans;
CREATE POLICY "Service role can manage diagnostic scans"
    ON public.diagnostic_scans FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. abuse_quarantine_events RLS
ALTER TABLE public.abuse_quarantine_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view and manage abuse quarantine" ON public.abuse_quarantine_events;
CREATE POLICY "Admins can view and manage abuse quarantine"
    ON public.abuse_quarantine_events FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Users can view own quarantine notices" ON public.abuse_quarantine_events;
CREATE POLICY "Users can view own quarantine notices"
    ON public.abuse_quarantine_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert abuse events" ON public.abuse_quarantine_events;
CREATE POLICY "Service role can insert abuse events"
    ON public.abuse_quarantine_events FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. agency_handover_transfers RLS
ALTER TABLE public.agency_handover_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developers can view and manage own handovers" ON public.agency_handover_transfers;
CREATE POLICY "Developers can view and manage own handovers"
    ON public.agency_handover_transfers FOR ALL
    USING (auth.uid() = developer_user_id OR auth.uid() = claimed_by_user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Public can view pending handover by token" ON public.agency_handover_transfers;
CREATE POLICY "Public can view pending handover by token"
    ON public.agency_handover_transfers FOR SELECT
    USING (status = 'pending_client_claim');

DROP POLICY IF EXISTS "Service role can manage handovers" ON public.agency_handover_transfers;
CREATE POLICY "Service role can manage handovers"
    ON public.agency_handover_transfers FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. developer_api_logs RLS
ALTER TABLE public.developer_api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own API logs" ON public.developer_api_logs;
CREATE POLICY "Users can view own API logs"
    ON public.developer_api_logs FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Service role can insert API logs" ON public.developer_api_logs;
CREATE POLICY "Service role can insert API logs"
    ON public.developer_api_logs FOR ALL
    USING (true)
    WITH CHECK (true);
