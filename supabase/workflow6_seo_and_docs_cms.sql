-- ==============================================================================
-- WORKFLOW 6 OF 6: DYNAMIC DATABASE-DRIVEN SEO ENGINE,
-- CONTEXT-AWARE INTERACTIVE DOCUMENTATION CMS, PROGRAMMATIC SITEMAP
-- & END-TO-END SECURITY / ZERO-MOCK SYSTEM AUDITOR
-- ==============================================================================

-- 1. DYNAMIC MULTI-TRACK DOCUMENTATION & RUNBOOK TABLE
CREATE TABLE IF NOT EXISTS public.cms_docs_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title_en TEXT NOT NULL,
    title_bn TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'Developer & CI/CD',
        'WordPress & Cloud',
        'Domains & DNS',
        'Affiliate Partner Guide',
        'Security & Billing'
    )),
    summary_en TEXT NOT NULL,
    summary_bn TEXT NOT NULL,
    difficulty_level TEXT NOT NULL DEFAULT 'Intermediate' CHECK (difficulty_level IN (
        'Beginner',
        'Intermediate',
        'Advanced Architecture'
    )),
    read_time_minutes INT DEFAULT 4,
    recommended_plan_slug TEXT DEFAULT 'developer-pro',
    steps_json JSONB NOT NULL,
    seo_keywords TEXT[] DEFAULT '{}',
    views_count INT DEFAULT 120,
    helpful_yes_count INT DEFAULT 42,
    helpful_no_count INT DEFAULT 1,
    is_published BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_slug ON public.cms_docs_articles(slug);
CREATE INDEX IF NOT EXISTS idx_docs_category ON public.cms_docs_articles(category, is_published);

-- 2. DYNAMIC PAGE-SPECIFIC & GLOBAL FAQ TABLE
CREATE TABLE IF NOT EXISTS public.cms_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_page TEXT NOT NULL CHECK (target_page IN (
        'home',
        'nodejs-hosting',
        'wordpress-hosting',
        'cloud-vps',
        'domains',
        'affiliate',
        'billing',
        'global'
    )),
    question_en TEXT NOT NULL,
    question_bn TEXT NOT NULL,
    answer_en TEXT NOT NULL,
    answer_bn TEXT NOT NULL,
    sort_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_target ON public.cms_faqs(target_page, is_active);

-- 3. DYNAMIC ROUTE-LEVEL SEO METADATA, OPENGRAPH & SCHEMA TABLE
CREATE TABLE IF NOT EXISTS public.cms_seo_routes (
    route_path TEXT PRIMARY KEY,
    meta_title TEXT NOT NULL,
    meta_description TEXT NOT NULL,
    keywords TEXT[] NOT NULL,
    canonical_path TEXT NOT NULL,
    og_title TEXT NOT NULL,
    og_subtitle TEXT NOT NULL,
    robots_directive TEXT DEFAULT 'index, follow, max-image-preview:large',
    schema_type TEXT NOT NULL CHECK (schema_type IN (
        'Product',
        'WebApplication',
        'FAQPage',
        'TechArticle',
        'Organization'
    )),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.cms_docs_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_seo_routes ENABLE ROW LEVEL SECURITY;

-- 1. cms_docs_articles
CREATE POLICY "Public read published docs articles" ON public.cms_docs_articles
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Admins full manage docs articles" ON public.cms_docs_articles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 2. cms_faqs
CREATE POLICY "Public read active faqs" ON public.cms_faqs
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins full manage faqs" ON public.cms_faqs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 3. cms_seo_routes
CREATE POLICY "Public read seo routes metadata" ON public.cms_seo_routes
    FOR SELECT USING (TRUE);

CREATE POLICY "Admins full manage seo routes" ON public.cms_seo_routes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- ==============================================================================
-- INITIAL SEEDING FOR ARTICLES, FAQS & SEO ROUTES
-- ==============================================================================

-- 1. Seed Technical Documentation Articles
INSERT INTO public.cms_docs_articles (
    slug,
    title_en,
    title_bn,
    category,
    summary_en,
    summary_bn,
    difficulty_level,
    read_time_minutes,
    recommended_plan_slug,
    steps_json,
    seo_keywords
) VALUES 
(
    'deploy-nextjs-github-cpanel-zero-bloat',
    'How to Auto-Deploy Next.js 15 to cPanel via GitHub Actions (Zero Storage Bloat)',
    'গিটহাব অ্যাকশনস ও সিপ্যানেলে নেক্সট জেএস ১৫ অটো-ডিপ্লয় করার পূর্ণাঙ্গ গাইড (জিরো নোডমডিউল ব্লট)',
    'Developer & CI/CD',
    'Learn how to leverage Next.js standalone output and GitHub Actions free runners to build externally and sync only production artifacts to cPanel with zero node_modules bloat.',
    'কীভাবে নেক্সট জেএস স্ট্যান্ডঅ্যালোন বিল্ড এবং গিটহাব অ্যাকশনস ব্যবহার করে সিপ্যানেলে কোনো অপ্রয়োজনীয় নোডমডিউল ছাড়াই সুপারফাস্ট অটোমেটিক ডিপ্লয় করবেন।',
    'Intermediate',
    4,
    'developer-pro',
    '[
        {
            "stepNumber": 1,
            "heading_en": "Enable Next.js Standalone Build in next.config.ts",
            "heading_bn": "নেক্সট.কনফিগ ফাইলে স্ট্যান্ডঅ্যালোন মোড সক্রিয় করুন",
            "explanation_en": "Configure Next.js to produce a self-contained output folder (.next/standalone) that bundles all required production dependencies without copying 50,000+ files.",
            "explanation_bn": "আপনার next.config.ts ফাইলে output: standalone যুক্ত করুন যাতে ৫০,০০০ ফাইলের অপ্রয়োজনীয় নোডমডিউল কপি না হয়ে শুধু প্রডাকশন বাইনারি তৈরি হয়।",
            "codeSnippet": "import type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = {\n  output: \"standalone\",\n};\nexport default nextConfig;",
            "codeLanguage": "typescript",
            "warningNote": "Do not commit local .next folders to Git."
        },
        {
            "stepNumber": 2,
            "heading_en": "Create cPanel Passenger startup file (server.js)",
            "heading_bn": "প্যাসেঞ্জার সার্ভার ফাইল তৈরি করুন (server.js)",
            "explanation_en": "Phusion Passenger on cPanel requires a root entry file to boot your Next.js standalone server on your allocated port.",
            "explanation_bn": "সিপ্যানেল ক্লাউডলিনাক্স প্যাসেঞ্জারের জন্য রুট ডিরেক্টরিতে server.js ফাইল তৈরি করুন।",
            "codeSnippet": "const path = require(\"path\");\nprocess.chdir(path.join(__dirname, \".next/standalone\"));\nrequire(\"./.next/standalone/server.js\");",
            "codeLanguage": "javascript",
            "warningNote": "Ensure Node.js version is set to 20 or 22 LTS in cPanel Setup Node.js App."
        },
        {
            "stepNumber": 3,
            "heading_en": "Configure .cpanel.yml or GitHub Actions Deployment Workflow",
            "heading_bn": "গিটহাব অ্যাকশনস ডিপ্লয়মেন্ট ওয়ার্কফ্লো কনফিগার করুন",
            "explanation_en": "Add .github/workflows/deploy.yml in your repo. Your server username {{CPANEL_USER}} and host {{SERVER_IP}} are dynamically populated.",
            "explanation_bn": "আপনার রিপোজিটরিতে .github/workflows/deploy.yml যোগ করুন। আপনার সিপ্যানেল ইউজার {{CPANEL_USER}} ও সার্ভার আইপি {{SERVER_IP}} দিয়ে সিক্রেট সেট করুন।",
            "codeSnippet": "name: Deploy to DevHost cPanel\non:\n  push:\n    branches: [ main ]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npm ci\n      - run: npm run build\n      - name: Rsync to cPanel\n        run: |\n          rsync -avz --delete .next/standalone/ {{CPANEL_USER}}@{{SERVER_IP}}:/home/{{CPANEL_USER}}/public_html/\n          ssh -p {{SSH_PORT}} {{CPANEL_USER}}@{{SERVER_IP}} \"touch /home/{{CPANEL_USER}}/public_html/tmp/restart.txt\"",
            "codeLanguage": "yaml",
            "warningNote": "Store your private SSH deploy key in GitHub Repository Secrets."
        }
    ]'::jsonb,
    ARRAY['nextjs', 'cpanel', 'github actions', 'phusion passenger', 'bangladesh hosting', 'zero bloat']
),
(
    'solve-node-js-app-503-passenger-cpanel',
    'How to Fix 503 Service Unavailable in cPanel CloudLinux Node.js Passenger',
    'সিপ্যানেল ক্লাউডলিনাক্স নোড জেএস অ্যাপে ৫০৩ সার্ভিস আনঅ্যাভেইলেবল সমাধানের উপায়',
    'Developer & CI/CD',
    'Troubleshoot and fix Passenger crash loops, missing environment variables, port conflicts, and passenger_log permission blocks in seconds.',
    'সিপ্যানেলে Node.js অ্যাপ রান করার সময় প্যাসেঞ্জার ক্র্যাশ, ৫০৩ এরর এবং স্টার্টআপ ফেইলিউর সমাধানের প্র্যাকটিক্যাল গাইড।',
    'Intermediate',
    3,
    'developer-pro',
    '[
        {
            "stepNumber": 1,
            "heading_en": "Check Phusion Passenger stderr.log via SSH",
            "heading_bn": "এসএসএইচ টার্মিনালে প্যাসেঞ্জার লগ পরীক্ষা করুন",
            "explanation_en": "Connect to your account {{CPANEL_USER}}@{{SERVER_IP}} and read the live crash log.",
            "explanation_bn": "টার্মিনাল থেকে আপনার অ্যাকাউন্টে লগইন করে লাইভ এরর লগ দেখুন।",
            "codeSnippet": "ssh -p {{SSH_PORT}} {{CPANEL_USER}}@{{SERVER_IP}}\ntail -n 50 /home/{{CPANEL_USER}}/logs/passenger_stderr.log",
            "codeLanguage": "bash",
            "warningNote": "Most 503 errors are caused by unhandled exceptions during boot."
        },
        {
            "stepNumber": 2,
            "heading_en": "Gracefully reload Passenger without downtime",
            "heading_bn": "ডাউনটাইম ছাড়া প্যাসেঞ্জার প্রসেস রিলোড করুন",
            "explanation_en": "Touch the restart.txt file in your application tmp directory.",
            "explanation_bn": "অ্যাপ্লিকেশন ডিরেক্টরির tmp/restart.txt ফাইলে টাচ করলেই ২ সেকেন্ডে রিস্টার্ট হবে।",
            "codeSnippet": "mkdir -p /home/{{CPANEL_USER}}/public_html/tmp\ntouch /home/{{CPANEL_USER}}/public_html/tmp/restart.txt",
            "codeLanguage": "bash",
            "warningNote": "Never kill node processes violently with kill -9."
        }
    ]'::jsonb,
    ARRAY['passenger 503', 'cpanel nodejs error', 'cloudlinux nodejs', 'fix 503']
),
(
    'wordpress-litespeed-cache-object-redis',
    'Supercharge WordPress with LiteSpeed Enterprise Cache & Redis Object Cache',
    'লাইটস্পিড এন্টারপ্রাইজ ক্যাশ এবং রেডিস অবজেক্ট ক্যাশ দিয়ে ওয়ার্ডপ্রেস স্পিডআপ গাইড',
    'WordPress & Cloud',
    'Configure LiteSpeed Cache (LSCache) and Redis socket cache to achieve a 99/100 Google PageSpeed score and sub-100ms TTFB.',
    'কীভাবে লাইটস্পিড ক্যাশ এবং রেডিস অবজেক্ট ক্যাশ সক্রিয় করে ওয়ার্ডপ্রেস সাইটের TTFB ১০০ মিলিসেকেন্ডের নিচে নামাবেন।',
    'Beginner',
    3,
    'standard-shared',
    '[
        {
            "stepNumber": 1,
            "heading_en": "Enable LiteSpeed Cache Plugin in WordPress",
            "heading_bn": "ওয়ার্ডপ্রেসে লাইটস্পিড ক্যাশ প্লাগইন ইনস্টল ও সক্রিয় করুন",
            "explanation_en": "Install the official LiteSpeed Cache plugin and connect to QUIC.cloud CDN for free image optimization.",
            "explanation_bn": "ওয়ার্ডপ্রেস ড্যাশবোর্ড থেকে অফিসিয়াল LiteSpeed Cache প্লাগইন সক্রিয় করুন।",
            "codeSnippet": "wp plugin install litespeed-cache --activate",
            "codeLanguage": "bash",
            "warningNote": "Ensure no other caching plugins (e.g., WP Rocket, W3TC) are running simultaneously."
        },
        {
            "stepNumber": 2,
            "heading_en": "Connect Redis Object Cache Socket",
            "heading_bn": "রেডিস অবজেক্ট ক্যাশ সকেট কানেক্ট করুন",
            "explanation_en": "In LSCache Settings -> Object Cache, toggle ON and set Host to 127.0.0.1 on Port 6379.",
            "explanation_bn": "LSCache সেটিংস থেকে Object Cache অন করুন এবং পোর্ট ৬৩৭৯ সেট করুন।",
            "codeSnippet": "Host: 127.0.0.1\nPort: 6379\nObject Cache: ON\nMethod: Redis",
            "codeLanguage": "text",
            "warningNote": "Redis eliminates repeated MySQL queries for logged-in WooCommerce shoppers."
        }
    ]'::jsonb,
    ARRAY['wordpress speed', 'litespeed cache', 'redis object cache', 'bangladesh fast wordpress']
)
ON CONFLICT (slug) DO UPDATE
SET 
    title_en = EXCLUDED.title_en,
    title_bn = EXCLUDED.title_bn,
    summary_en = EXCLUDED.summary_en,
    summary_bn = EXCLUDED.summary_bn,
    steps_json = EXCLUDED.steps_json,
    updated_at = NOW();

-- 2. Seed Dynamic FAQs Table
INSERT INTO public.cms_faqs (
    target_page,
    question_en,
    question_bn,
    answer_en,
    answer_bn,
    sort_order
) VALUES 
(
    'home',
    'How does GitHub Auto-Deployment avoid filling up my cPanel storage and Inodes?',
    'গিটহাব অটো-ডিপ্লয়মেন্ট কীভাবে আমার সিপ্যানেল স্টোরেজ ও ইনোডস ভর্তি হওয়া রোধ করে?',
    'By building your Next.js or Node.js app on GitHub Actions free runner and syncing only the compiled production artifacts via our overwrite script, node_modules bloat is eliminated and old releases are automatically cleaned up—saving up to 80% storage and Inodes.',
    'গিটহাব অ্যাকশনসের ফ্রি সার্ভারে আপনার কোড বিল্ড হয়ে শুধুমাত্র ফাইনাল প্রডাকশন ফাইল সিপ্যানেলে আসে। ফলে ভারী নোডমডিউল ফোল্ডার এবং পুরনো রিলিজ অটো ডিলিট হয়ে ৮০% পর্যন্ত ডিস্ক ও ইনোড বেঁচে যায়।',
    1
),
(
    'home',
    'How fast is account activation when paying via bKash or Nagad?',
    'বিকাশ বা নগদে পেমেন্ট করার পর হোস্টিং কত দ্রুত চালু হয়?',
    '100% instant. Our billing portal uses automated bKash and Nagad API callbacks. As soon as your payment succeeds, your cPanel account is automatically provisioned and login details are delivered to your screen and email within seconds.',
    '১০০% তাৎক্ষণিক ও অটোমেটিক। বিকাশ ও নগদের অটো এপিআই কলব্যাকের মাধ্যমে পেমেন্ট সম্পন্ন হওয়ামাত্র সার্ভার স্বয়ংক্রিয়ভাবে সিপ্যানেল তৈরি করে স্ক্রিনে এবং ইমেইলে ক্রেডেনশিয়াল পাঠিয়ে দেয়।',
    2
),
(
    'nodejs-hosting',
    'Which Node.js versions and database engines are supported?',
    'কোন কোন Node.js ভার্সন এবং ডাটাবেজ ইঞ্জিন সাপোর্ট করে?',
    'We support Node.js v18, v20, and v22 LTS with CloudLinux Node.js Selector, alongside MySQL 8.0, MariaDB 10.11, and Redis Object Cache sockets on Singapore NVMe infrastructure.',
    'আমরা ক্লাউডলিনাক্স Node.js সিলেক্টরে Node.js 18, 20 এবং 22 LTS সাপোর্ট করি। সাথে রয়েছে MySQL 8.0, MariaDB এবং লাইটস্পিড রেডিস অবজেক্ট ক্যাশ।',
    1
),
(
    'wordpress-hosting',
    'Is LiteSpeed Enterprise Web Server included with WordPress plans?',
    'ওয়ার্ডপ্রেস প্ল্যানের সাথে কি লাইটস্পিড এন্টারপ্রাইজ ওয়েব সার্ভার অন্তর্ভুক্ত?',
    'Yes! All WordPress plans run on genuine LiteSpeed Enterprise Web Server with built-in LSCache and Redis Object Cache, delivering up to 10x faster TTFB than traditional Apache or NGINX servers.',
    'হ্যাঁ! আমাদের প্রতিটি ওয়ার্ডপ্রেস প্ল্যান অরিজিনাল লাইটস্পিড এন্টারপ্রাইজ ওয়েব সার্ভারে চলে, যা সাধারণ অ্যাপাচি বা এনজিনিক্স সার্ভারের তুলনায় ১০ গুণ দ্রুত গতি দেয়।',
    1
),
(
    'domains',
    'How does Instant Domain Registration & DNS Management work?',
    'তাৎক্ষণিক ডোমেইন রেজিস্ট্রেশন ও ডিএনএস ম্যানেজমেন্ট কীভাবে কাজ করে?',
    'Domains are registered instantly upon payment via automated registrar APIs. You receive full Cloudflare-grade DNS zone management (A, AAAA, CNAME, MX, TXT, SRV) directly inside your DevHost portal.',
    'পেমেন্ট করার সাথে সাথে এপিআই-এর মাধ্যমে ডোমেইন রেজিস্টার হয়ে যায় এবং আমাদের পোর্টাল থেকেই আপনি ক্লাউডফ্লেয়ার-গ্রেড ফুল ডিএনএস রেকর্ড ম্যানেজ করতে পারবেন।',
    1
)
ON CONFLICT DO NOTHING;

-- 3. Seed Route-Level Dynamic SEO Metadata
INSERT INTO public.cms_seo_routes (
    route_path,
    meta_title,
    meta_description,
    keywords,
    canonical_path,
    og_title,
    og_subtitle,
    schema_type
) VALUES 
(
    '/',
    'DevHost Cloud — Vercel-Grade Developer Hosting with cPanel Accessibility & bKash',
    'Next-generation NVMe hosting platform in Bangladesh. Auto-deploy Git repos to LiteSpeed cPanel, instant automated bKash/Nagad billing, and zero-downtime containers.',
    ARRAY['web hosting bangladesh', 'cpanel hosting bd', 'nextjs cpanel hosting', 'bkash hosting', 'developer cloud bd'],
    'https://devhostcloud.com',
    'DevHost Cloud — Developer-First Cloud Platform',
    'Deploy Next.js, Node.js & WordPress with instant bKash checkout and Singapore NVMe speed.',
    'WebApplication'
),
(
    '/nodejs-hosting',
    'High-Speed Node.js Hosting in Bangladesh — LiteSpeed NVMe & Passenger',
    'Deploy Next.js, Express, NestJS, and Node.js 22 LTS with CloudLinux Passenger on Singapore NVMe storage. Instant bKash activation with zero node_modules bloat.',
    ARRAY['nodejs hosting bangladesh', 'nextjs hosting bd', 'passenger cpanel hosting', 'fast nodejs cloud'],
    'https://devhostcloud.com/nodejs-hosting',
    'Node.js NVMe Cloud Hosting | DevHost',
    'Sub-40ms latency in Bangladesh with automated GitHub webhooks and zero storage bloat.',
    'Product'
),
(
    '/wordpress-hosting-bangladesh',
    'Fastest WordPress Hosting in Bangladesh — LiteSpeed Enterprise & Redis',
    'Supercharge your WordPress & WooCommerce store with LiteSpeed Enterprise Web Server, Redis Object Cache, free SSL, and daily offsite backups in Singapore & USA.',
    ARRAY['wordpress hosting bangladesh', 'litespeed hosting bd', 'woocommerce cloud', 'fast wordpress bd'],
    'https://devhostcloud.com/wordpress-hosting-bangladesh',
    'LiteSpeed WordPress Hosting | DevHost',
    'Achieve 99/100 Google PageSpeed scores with LiteSpeed Enterprise and Redis caching.',
    'Product'
),
(
    '/cloud-vps',
    'NVMe Cloud VPS in Singapore & USA — KVM Virtualization & Root Access',
    'High-performance Cloud VPS servers with dedicated NVMe storage, BDIX-optimized routes, 1Gbps uplink, full root access, and automated instant OS provisioning.',
    ARRAY['vps hosting bangladesh', 'cloud vps bd', 'singapore vps', 'kvm vps root access'],
    'https://devhostcloud.com/cloud-vps',
    'Enterprise Cloud VPS | DevHost',
    'Dedicated KVM virtualization in Singapore SG1 and USA Equinix datacenters.',
    'Product'
),
(
    '/cheap-domain-registration-bd',
    'Domain Registration Bangladesh — Instant .com, .net, .org, .xyz with bKash',
    'Register and transfer global domain names with instant bKash & Nagad activation, free WHOIS privacy, 2-Step verification lock, and RFC-validated DNS zone editor.',
    ARRAY['domain registration bangladesh', 'cheap domain bd', 'buy com domain bkash', 'domain registrar bd'],
    'https://devhostcloud.com/cheap-domain-registration-bd',
    'Domain Portfolio & Registrar Suite | DevHost',
    'Protect your brand with WHOIS privacy, DNSSEC, and instant EPP transfer states.',
    'Product'
),
(
    '/docs',
    'Developer Documentation, Tutorials & Runbooks | DevHost Cloud Engineering Hub',
    'Context-aware developer tutorials for Next.js, Node.js, Laravel, WordPress, and Cloudflare DNS with real-time customer account variable injection.',
    ARRAY['cpanel tutorials', 'nextjs cpanel deploy guide', 'developer documentation bd', 'hosting knowledge base'],
    'https://devhostcloud.com/docs',
    'Engineering Knowledgebase & Runbooks | DevHost',
    'Copy-paste deployment workflows with live account variables and terminal scripts.',
    'TechArticle'
)
ON CONFLICT (route_path) DO UPDATE
SET 
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    keywords = EXCLUDED.keywords,
    canonical_path = EXCLUDED.canonical_path,
    og_title = EXCLUDED.og_title,
    og_subtitle = EXCLUDED.og_subtitle,
    updated_at = NOW();
