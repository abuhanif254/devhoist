-- =============================================================================
-- DEVHOST CLOUD - MASTER COMPLIANCE, ABUSE DESK, TEAM RBAC & SLA STATUS SCHEMA
-- 100% Self-Contained (Includes public.is_admin_user() Helper)
-- =============================================================================

-- 0. ENSURE SECURITY-DEFINER ADMIN HELPER FUNCTION EXISTS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- =============================================================================
-- A. cms_legal_documents (Dynamic Bilingual Legal & Merchant Compliance Hub)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cms_legal_documents (
    slug text PRIMARY KEY,
    title_en text NOT NULL,
    title_bn text NOT NULL,
    version text NOT NULL DEFAULT 'v3.2 (Nov 2026)',
    effective_date text NOT NULL DEFAULT 'November 1, 2026',
    summary_highlights_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read legal documents" ON public.cms_legal_documents;
CREATE POLICY "Public can read legal documents"
    ON public.cms_legal_documents
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage legal documents" ON public.cms_legal_documents;
CREATE POLICY "Admins can manage legal documents"
    ON public.cms_legal_documents
    FOR ALL
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- =============================================================================
-- B. public_abuse_reports (Phishing, Malware, Spam & DMCA Reporting Desk)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.public_abuse_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_reference text UNIQUE NOT NULL,
    reporter_name text NOT NULL,
    reporter_email text NOT NULL,
    reporter_organization text,
    abuse_type text NOT NULL CHECK (abuse_type IN (
        'phishing_fraud',
        'malware_botnet',
        'copyright_dmca',
        'email_spam',
        'ddos_network_attack'
    )),
    reported_url_or_ip text NOT NULL,
    evidence_logs text NOT NULL,
    sworn_good_faith_declaration boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'received_investigating' CHECK (status IN (
        'received_investigating',
        'domain_quarantined',
        'resolved_removed',
        'rejected_invalid'
    )),
    admin_resolution_note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_abuse_reports_status
    ON public.public_abuse_reports(status, created_at DESC);

ALTER TABLE public.public_abuse_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit abuse report" ON public.public_abuse_reports;
CREATE POLICY "Anyone can submit abuse report"
    ON public.public_abuse_reports
    FOR INSERT
    WITH CHECK (sworn_good_faith_declaration = true);

DROP POLICY IF EXISTS "Admins can view and manage abuse reports" ON public.public_abuse_reports;
CREATE POLICY "Admins can view and manage abuse reports"
    ON public.public_abuse_reports
    FOR ALL
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- =============================================================================
-- C. organization_team_members (Granular Role-Based Access Control / Team RBAC)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organization_team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_email text NOT NULL,
    member_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    team_role text NOT NULL CHECK (team_role IN (
        'full_admin',
        'devops_deployer',
        'dns_domain_manager',
        'billing_accountant',
        'readonly_auditor'
    )),
    allowed_scopes text[] NOT NULL DEFAULT '{}'::text[],
    allowed_service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    invite_status text NOT NULL DEFAULT 'pending_invite' CHECK (invite_status IN (
        'pending_invite',
        'active',
        'revoked'
    )),
    invite_token text UNIQUE NOT NULL,
    last_active_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_user_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_org_team_members_owner
    ON public.organization_team_members(owner_user_id, created_at DESC);

ALTER TABLE public.organization_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and members can view team seats" ON public.organization_team_members;
CREATE POLICY "Owners and members can view team seats"
    ON public.organization_team_members
    FOR SELECT
    USING (
        auth.uid() = owner_user_id
        OR auth.uid() = member_user_id
        OR public.is_admin_user()
    );

DROP POLICY IF EXISTS "Owners and admins can manage team seats" ON public.organization_team_members;
CREATE POLICY "Owners and admins can manage team seats"
    ON public.organization_team_members
    FOR ALL
    USING (auth.uid() = owner_user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = owner_user_id OR public.is_admin_user());

-- =============================================================================
-- D. network_status_incidents (Public Status Page & SLA Uptime History)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.network_status_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_code text NOT NULL,
    title text NOT NULL,
    severity text NOT NULL DEFAULT 'operational' CHECK (severity IN (
        'operational',
        'maintenance',
        'degraded_performance',
        'minor_outage'
    )),
    status text NOT NULL DEFAULT 'resolved' CHECK (status IN (
        'resolved',
        'monitoring',
        'investigating',
        'scheduled'
    )),
    updates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

ALTER TABLE public.network_status_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read network status incidents" ON public.network_status_incidents;
CREATE POLICY "Public can read network status incidents"
    ON public.network_status_incidents
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage network status incidents" ON public.network_status_incidents;
CREATE POLICY "Admins can manage network status incidents"
    ON public.network_status_incidents
    FOR ALL
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- =============================================================================
-- SEED ALL 5 BILINGUAL LEGAL & MERCHANT COMPLIANCE DOCUMENTS
-- =============================================================================
INSERT INTO public.cms_legal_documents (
    slug, title_en, title_bn, version, effective_date, summary_highlights_json, sections_json
) VALUES
(
    'terms-of-service',
    'Master Terms of Service & Merchant Delivery Policy',
    'পরিষেবার মূল শর্তাবলি এবং তাৎক্ষণিক ডেলিভারি নীতিমালা',
    'v3.2 (Nov 2026)',
    'November 1, 2026',
    '[
      {"en":"Instant Automated Delivery: Hosting & Cloud containers provision automatically within 2 to 10 seconds of payment webhook confirmation.","bn":"তাৎক্ষণিক অটোমেটেড ডেলিভারি: পেমেন্ট সম্পন্ন হওয়ার ২ থেকে ১০ সেকেন্ডের মধ্যে হোস্টিং ও ক্লাউড সার্ভার স্বয়ংক্রিয়ভাবে চালু হয়।"},
      {"en":"100% Code & Data Ownership: You retain full intellectual property over all source code, databases, and domains hosted on DevHost Cloud.","bn":"১০০% কোড ও ডেটা মালিকানা: আপনার সোর্স কোড, ডাটাবেস এবং ডোমেইনের সম্পূর্ণ মালিকানা আপনার নিজের।"},
      {"en":"Strict Resource Isolation: Every container runs inside an isolated CloudLinux LVE cage with guaranteed RAM, vCPU, and NVMe I/O.","bn":"রিসোর্স আইসোলেশন: প্রতিটি অ্যাকাউন্ট ডেডিকেটেড RAM, CPU এবং NVMe স্পিডসহ সম্পূর্ণ আলাদা কন্টেইনারে চলে।"},
      {"en":"Zero Tolerance for Phishing: Phishing, bank spoofing, or malware distribution triggers immediate automated quarantine.","bn":"ফিশিং ও ম্যালওয়্যার নিষিদ্ধ: ফিশিং বা ম্যালওয়্যার হোস্ট করলে স্বয়ংক্রিয়ভাবে ডোমেইন কোয়ারেন্টাইন করা হয়।"}
    ]'::jsonb,
    '[
      {
        "clauseNumber": "1.1",
        "heading_en": "Instant Digital Service Delivery Timeline (Merchant Compliance Disclosure)",
        "heading_bn": "ডিজিটাল সার্ভিস ডেলিভারি সময়সীমা (পেমেন্ট গেটওয়ে কমপ্লায়েন্স)",
        "content_en": "All web hosting, Node.js/Python cloud containers, and domain registrations ordered via bKash, Nagad, SSLCommerz, Stripe, or Account Wallet are provisioned 100% automatically within 2 to 10 seconds of payment verification. Credentials and cPanel SSO access are delivered immediately to your registered email and Cloud Console.",
        "content_bn": "বিকাশ, নগদ, কার্ড বা ওয়ালেটের মাধ্যমে অর্ডারকৃত সকল হোস্টিং ও ডোমেইন পেমেন্ট কনফার্ম হওয়ার ২ থেকে ১০ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে চালু হয় এবং ইমেইল ও ড্যাশবোর্ডে অ্যাক্সেস প্রদান করা হয়।"
      },
      {
        "clauseNumber": "1.2",
        "heading_en": "Account Security, 2FA Sudo Gate & Billing Renewal",
        "heading_bn": "অ্যাকাউন্ট নিরাপত্তা, 2FA ভেরিফিকেশন এবং রিনিউয়াল",
        "content_en": "Customers are responsible for maintaining strong credentials. Destructive actions (dropping databases, revealing .env secrets, or transferring ownership) require step-up 2FA Sudo verification. Subscriptions renew at the standard published rate unless cancelled prior to the renewal date.",
        "content_bn": "গ্রাহকের অ্যাকাউন্ট ও ডেটা সুরক্ষায় ডেটাবেস ডিলিট বা গোপন .env কি দেখার ক্ষেত্রে 2FA Sudo ভেরিফিকেশন বাধ্যতামূলক। রিনিউয়াল তারিখের পূর্বে ক্যানসেল না করলে নির্ধারিত মূল্যে বিল জেনারেট হবে।"
      }
    ]'::jsonb
),
(
    'privacy-policy',
    'Data Privacy, Zero-Knowledge .ENV Encryption & GDPR Policy',
    'ডেটা প্রাইভেসি, জিরো-নলেজ .ENV এনক্রিপশন এবং গোপনীয়তা নীতিমালা',
    'v3.2 (Nov 2026)',
    'November 1, 2026',
    '[
      {"en":"AES-256-GCM Encrypted Secrets: All project .env variables are encrypted at rest using Web Crypto PBKDF2 + AES-256-GCM.","bn":"AES-256-GCM এনক্রিপশন: আপনার প্রজেক্টের সকল .env ভেরিয়েবল সর্বোচ্চ সামরিক মানের এনক্রিপশনে সংরক্ষিত থাকে।"},
      {"en":"Zero Third-Party Data Selling: We never sell, rent, or monetize customer personal data, source code, or visitor analytics.","bn":"তৃতীয় পক্ষের কাছে তথ্য বিক্রি নিষিদ্ধ: আমরা কখনোই গ্রাহকের ব্যক্তিগত তথ্য, কোড বা ট্রাফিক ডেটা কোনো প্রতিষ্ঠানের কাছে বিক্রি করি না।"},
      {"en":"PCI-DSS & Mobile Payment Safety: We never store raw card numbers or bKash/Nagad PINs on our servers.","bn":"পেমেন্ট নিরাপত্তা: বিকাশ/নগদ পিন বা কার্ডের গোপন তথ্য আমাদের সার্ভারে কখনোই সংরক্ষণ করা হয় না।"},
      {"en":"1-Click Data Export & Right to Erasure: Export your full backups or request permanent account deletion anytime.","bn":"ডেটা এক্সপোর্ট ও ডিলিট করার অধিকার: যেকোনো সময় আপনার সম্পূর্ণ ব্যাকআপ ডাউনলোড বা অ্যাকাউন্ট মুছে ফেলার অনুরোধ করতে পারবেন।"}
    ]'::jsonb,
    '[
      {
        "clauseNumber": "2.1",
        "heading_en": "Information We Collect & Lawful Purpose",
        "heading_bn": "সংগ্রহীত তথ্য এবং ব্যবহারের উদ্দেশ্য",
        "content_en": "We collect only the minimum operational data required to provision cloud infrastructure, register ICANN domains, verify payment transaction IDs (trxID), and prevent automated abuse.",
        "content_bn": "ক্লাউড সার্ভার চালু করা, ডোমেইন রেজিস্ট্রেশন এবং পেমেন্ট ভেরিফিকেশনের জন্য শুধুমাত্র ন্যূনতম প্রয়োজনীয় তথ্য (নাম, ইমেইল, ফোন নম্বর ও ট্রানজেকশন আইডি) সংগ্রহ করা হয়।"
      },
      {
        "clauseNumber": "2.2",
        "heading_en": "Cryptographic Protection of Environment Variables & Backups",
        "heading_bn": "এনভায়রনমেন্ট ভেরিয়েবল এবং ব্যাকআপের ক্রিপ্টোগ্রাফিক সুরক্ষা",
        "content_en": "All sensitive API keys stored in the DevHost .ENV Vault are encrypted with AES-256-GCM and a unique 12-byte initialization vector. Offsite JetBackup snapshots are encrypted in Equinix SG1 object storage with a rolling 14-day retention window.",
        "content_bn": "ড্যাশবোর্ডে সংরক্ষিত সকল .ENV ভেরিয়েবল AES-256-GCM প্রযুক্তিতে এনক্রিপ্টেড থাকে এবং জেটব্যাকআপ স্ন্যাপশটগুলো সিঙ্গাপুর ডেটাসেন্টারে নিরাপদে সংরক্ষিত থাকে।"
      }
    ]'::jsonb
),
(
    'refund-and-cancellation',
    '30-Day Money-Back Guarantee & Free-Domain Deduction Policy',
    '৩০ দিনের মানি-ব্যাক গ্যারান্টি এবং ফ্রি ডোমেইন কর্তন নীতিমালা',
    'v3.2 (Nov 2026)',
    'November 1, 2026',
    '[
      {"en":"30-Day Hosting Money-Back Guarantee: Full refund on shared & developer cloud hosting plans cancelled within 30 days of initial purchase.","bn":"৩০ দিনের মানি-ব্যাক গ্যারান্টি: নতুন হোস্টিং কেনার ৩০ দিনের মধ্যে সার্ভিস পছন্দ না হলে রিফান্ড সুবিধা।"},
      {"en":"Free Domain Retention & Deduction Rule: If your annual plan included a Free Domain (.com/.xyz/.shop), the domain registration cost is deducted from the refund and you keep 100% ownership of the domain.","bn":"ফ্রি ডোমেইন কর্তন নিয়ম: বার্ষিক প্ল্যানে ফ্রি ডোমেইন নিয়ে থাকলে রিফান্ডের সময় ডোমেইনের রেজিস্ট্রেশন ফি কেটে বাকি টাকা ফেরত দেওয়া হবে এবং ডোমেইনটি আপনার নামেই থাকবে।"},
      {"en":"Affiliate Commission Clawback: Any pending affiliate commission tied to a refunded invoice is automatically voided.","bn":"অ্যাফিলিয়েট কমিশন বাতিল: কোনো অর্ডার রিফান্ড করা হলে তার বিপরীতে পেন্ডিং থাকা অ্যাফিলিয়েট কমিশন স্বয়ংক্রিয়ভাবে বাতিল হয়।"},
      {"en":"Fast 3–5 Business Day Settlement: Approved refunds are returned directly to your original bKash, Nagad, Card, or Instant Account Wallet.","bn":"দ্রুত রিফান্ড নিষ্পত্তি: অনুমোদিত রিফান্ড সরাসরি আপনার বিকাশ, নগদ, কার্ড অথবা তাৎক্ষণিকভাবে অ্যাকাউন্ট ওয়ালেটে ফেরত দেওয়া হয়।"}
    ]'::jsonb,
    '[
      {
        "clauseNumber": "3.1",
        "heading_en": "Mathematical Formula for Free-Domain Bundle Refunds (Anti-Loss Clause)",
        "heading_bn": "ফ্রি ডোমেইন বান্ডেলসহ হোস্টিং রিফান্ডের গাণিতিক হিসাব",
        "content_en": "Because ICANN/Registry domain registrations are irreversible and paid immediately upstream upon order creation, standalone domains and 1st-Year Free Bundled Domains cannot be cancelled at the registry. If you request a 30-day refund on an Annual Hosting Plan that included a Free Domain, your refundable amount is strictly calculated as: Refundable Amount = Total Invoice Paid - Standard Domain Registration Price (e.g., ৳1,350 for .com, ৳1,450 for .net, ৳290 for .xyz/.shop). You retain full ownership and EPP transfer rights to the domain.",
        "content_bn": "ডোমেইন রেজিস্ট্রেশন একবার সম্পন্ন হলে তা আন্তর্জাতিক রেজিস্ট্রি থেকে বাতিলযোগ্য নয়। তাই বার্ষিক হোস্টিং প্ল্যানে ফ্রি ডোমেইন গ্রহণ করার পর ৩০ দিনের মধ্যে রিফান্ড চাইলে মোট পরিশোধিত বিল থেকে উক্ত ডোমেইনের নির্ধারিত রেজিস্ট্রেশন মূল্য (যেমন .com ৳১,৩৫০ বা .xyz ৳২৯০) বাদ দিয়ে অবশিষ্ট টাকা রিফান্ড করা হবে এবং ডোমেইনটির সম্পূর্ণ মালিকানা গ্রাহকের কাছেই থাকবে।"
      },
      {
        "clauseNumber": "3.2",
        "heading_en": "Non-Refundable Items & Abuse Violations",
        "heading_bn": "অফেরতযোগ্য সেবা এবং নীতিমালা লঙ্ঘন",
        "content_en": "Dedicated Bare-Metal servers, software licenses, renewal invoices after the initial 30-day period, and accounts terminated for phishing, malware, or DMCA violations are strictly non-refundable.",
        "content_bn": "ডেডিকেটেড সার্ভার, রিনিউয়াল ইনভয়েস এবং ফিশিং বা ম্যালওয়্যারের কারণে সাসপেন্ড হওয়া অ্যাকাউন্টের ক্ষেত্রে কোনো রিফান্ড প্রযোজ্য নয়।"
      }
    ]'::jsonb
),
(
    'service-level-agreement',
    '99.99% Uptime Service Level Agreement (SLA) & Credit Schedule',
    '৯৯.৯৯% আপটাইম গ্যারান্টি (SLA) এবং ক্রেডিট ক্ষতিপূরণ নীতিমালা',
    'v3.2 (Nov 2026)',
    'November 1, 2026',
    '[
      {"en":"99.99% Network & Power Guarantee: Backed by Equinix SG1 (Singapore) and US-East Tier-IV redundant datacenters.","bn":"৯৯.৯৯% নেটওয়ার্ক ও পাওয়ার গ্যারান্টি: সিঙ্গাপুর Equinix SG1 এবং ইউএসএ Tier-IV ডেটাসেন্টার দ্বারা সুরক্ষিত।"},
      {"en":"Autonomous Self-Healing Engine: HTTP 503 Passenger hangs and SSL renewals are remediated automatically in < 2 seconds.","bn":"অটোমেটিক সেলফ-হিলিং ইঞ্জিন: সার্ভার হ্যাং বা 503 এরর ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে রিস্টার্ট ও সমাধান হয়।"},
      {"en":"Up to 100% Monthly Fee Credit: Tiered financial SLA credits if monthly availability ever drops below 99.9%.","bn":"১০০% পর্যন্ত বিল ক্রেডিট: মাসিক আপটাইম ৯৯.৯%-এর নিচে নামলে শর্তানুযায়ী ১০% থেকে ১০০% পর্যন্ত ক্রেডিট প্রদান করা হয়।"},
      {"en":"Real-Time Public Looking Glass: Live latency and 90-day component uptime are publicly auditable at /server-status.","bn":"পাবলিক লাইভ স্ট্যাটাস: আমাদের সকল সার্ভারের পিং এবং ৯০ দিনের আপটাইম /server-status পেজে সরাসরি যাচাইযোগ্য।"}
    ]'::jsonb,
    '[
      {
        "clauseNumber": "4.1",
        "heading_en": "Official SLA Uptime Credit Tier Schedule",
        "heading_bn": "আপটাইম ক্রেডিট ক্ষতিপূরণ তালিকা",
        "content_en": "If unscheduled infrastructure downtime causes your monthly availability to fall below our guaranteed threshold, you are entitled to account credits calculated as a percentage of your monthly hosting fee: (a) 99.90% to 99.99%: 0% (Target SLA Met); (b) 99.00% to 99.89% (>43m downtime): 10% Credit; (c) 95.00% to 98.99% (>7.2h downtime): 25% Credit; (d) Below 95.00% (>36h downtime): 100% Full Monthly Credit.",
        "content_bn": "অনির্ধারিত সার্ভার ডাউনটাইমের কারণে মাসিক আপটাইম কমে গেলে আপনি নিচের হারে অ্যাকাউন্ট ক্রেডিট পাবেন: (ক) ৯৯.০০% - ৯৯.৮৯%: ১০% ক্রেডিট; (খ) ৯৫.০০% - ৯৮.৯৯%: ২৫% ক্রেডিট; (গ) ৯৫.০০%-এর নিচে: ১০০% সম্পূর্ণ মাসের ফি ক্রেডিট।"
      }
    ]'::jsonb
),
(
    'acceptable-use-and-dmca',
    'Acceptable Use Policy (AUP), Anti-Phishing Shield & DMCA Notice Procedure',
    'গ্রহণযোগ্য ব্যবহার নীতিমালা (AUP), অ্যান্টি-ফিশিং এবং DMCA কপিরাইট নীতি',
    'v3.2 (Nov 2026)',
    'November 1, 2026',
    '[
      {"en":"Automated Anti-Phishing Quarantine: Any domain impersonating banks, MFS providers (bKash/Nagad), or global brands is quarantined immediately.","bn":"অটোমেটিক অ্যান্টি-ফিশিং শিল্ড: ব্যাংক, বিকাশ/নগদ বা অন্য কোনো ব্র্যান্ডের নামে ফিশিং সাইট খুললে তাৎক্ষণিক ব্লক করা হয়।"},
      {"en":"Zero Unsolicited Bulk Spam: Outbound SMTP port 25 abuse or bulk spam lists result in immediate mail relay suspension.","bn":"বাল্ক স্প্যাম ইমেইল নিষিদ্ধ: স্প্যাম বা বাল্ক ফিশিং ইমেইল পাঠালে তাৎক্ষণিকভাবে মেইল সার্ভিস বন্ধ করা হয়।"},
      {"en":"24-Hour DMCA Takedown Response: Verified copyright infringement notices submitted via /abuse are processed within 24 hours.","bn":"২৪ ঘণ্টায় DMCA নিষ্পত্তি: /abuse পেজের মাধ্যমে জমা দেওয়া বৈধ কপিরাইট অভিযোগ ২৪ ঘণ্টার মধ্যে নিষ্পত্তি করা হয়।"},
      {"en":"Cryptomining & Botnet Ban: Unauthorized CPU cryptominers, C2 botnets, and port scanners are terminated automatically.","bn":"ক্রিপ্টো মাইনিং ও বটনেট নিষিদ্ধ: সার্ভারে ক্রিপ্টো মাইনিং বা হ্যাকিং টুল চালালে সাথে সাথে টার্মিনেট করা হয়।"}
    ]'::jsonb,
    '[
      {
        "clauseNumber": "5.1",
        "heading_en": "Prohibited Cyber Activities & Upstream IP Reputation Protection",
        "heading_bn": "নিষিদ্ধ সাইবার কার্যক্রম এবং সার্ভার আইপি সুরক্ষা",
        "content_en": "To protect the IP reputation and BDIX routing integrity of all customers on our cluster, hosting phishing kits, credential harvesters, malware droppers, darknet markets, or DDoS stressor scripts is strictly prohibited. Our automated Abuse Shield Engine scans newly provisioned domains and quarantines high-risk targets immediately.",
        "content_bn": "ক্লাস্টারের সকল গ্রাহকের আইপি রেপুটেশন সুরক্ষিত রাখতে ফিশিং কিট, ম্যালওয়্যার বা হ্যাকিং স্ক্রিপ্ট হোস্ট করা সম্পূর্ণ নিষিদ্ধ। আমাদের অটোমেটেড অ্যাবিউজ শিল্ড ঝুঁকিপূর্ণ ডোমেইন তাৎক্ষণিকভাবে কোয়ারেন্টাইন করে।"
      }
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    title_en = EXCLUDED.title_en,
    title_bn = EXCLUDED.title_bn,
    version = EXCLUDED.version,
    effective_date = EXCLUDED.effective_date,
    summary_highlights_json = EXCLUDED.summary_highlights_json,
    sections_json = EXCLUDED.sections_json,
    updated_at = now();
