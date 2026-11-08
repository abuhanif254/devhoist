import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { scanDomainForPhishing, quarantineAbuseDomain } from '@/lib/abuseShieldEngine';
import { sendTelegramAlert } from '@/lib/adminNotifier';

export const DEFAULT_LEGAL_DOCUMENTS = [
    {
        slug: 'terms-of-service',
        title_en: 'Master Terms of Service & Merchant Delivery Policy',
        title_bn: 'পরিষেবার মূল শর্তাবলি এবং তাৎক্ষণিক ডেলিভারি নীতিমালা',
        version: 'v3.2 (Nov 2026)',
        effective_date: 'November 1, 2026',
        summary_highlights_json: [
            {
                en: 'Instant Automated Delivery: Hosting & Cloud containers provision automatically within 2 to 10 seconds of payment webhook confirmation.',
                bn: 'তাৎক্ষণিক অটোমেটেড ডেলিভারি: পেমেন্ট সম্পন্ন হওয়ার ২ থেকে ১০ সেকেন্ডের মধ্যে হোস্টিং ও ক্লাউড সার্ভার স্বয়ংক্রিয়ভাবে চালু হয়।',
            },
            {
                en: '100% Code & Data Ownership: You retain full intellectual property over all source code, databases, and domains hosted on DevHost Cloud.',
                bn: '১০০% কোড ও ডেটা মালিকানা: আপনার সোর্স কোড, ডাটাবেস এবং ডোমেইনের সম্পূর্ণ মালিকানা আপনার নিজের।',
            },
            {
                en: 'Strict Resource Isolation: Every container runs inside an isolated CloudLinux LVE cage with guaranteed RAM, vCPU, and NVMe I/O.',
                bn: 'রিসোর্স আইসোলেশন: প্রতিটি অ্যাকাউন্ট ডেডিকেটেড RAM, CPU এবং NVMe স্পিডসহ সম্পূর্ণ আলাদা কন্টেইনারে চলে।',
            },
            {
                en: 'Zero Tolerance for Phishing: Phishing, bank spoofing, or malware distribution triggers immediate automated quarantine.',
                bn: 'ফিশিং ও ম্যালওয়্যার নিষিদ্ধ: ফিশিং বা ম্যালওয়্যার হোস্ট করলে স্বয়ংক্রিয়ভাবে ডোমেইন কোয়ারেন্টাইন করা হয়।',
            },
        ],
        sections_json: [
            {
                clauseNumber: '1.1',
                heading_en: 'Instant Digital Service Delivery Timeline (Merchant Compliance Disclosure)',
                heading_bn: 'ডিজিটাল সার্ভিস ডেলিভারি সময়সীমা (পেমেন্ট গেটওয়ে কমপ্লায়েন্স)',
                content_en:
                    'All web hosting, Node.js/Python cloud containers, and domain registrations ordered via bKash, Nagad, SSLCommerz, Stripe, or Account Wallet are provisioned 100% automatically within 2 to 10 seconds of payment verification. Credentials and cPanel SSO access are delivered immediately to your registered email and Cloud Console.',
                content_bn:
                    'বিকাশ, নগদ, কার্ড বা ওয়ালেটের মাধ্যমে অর্ডারকৃত সকল হোস্টিং ও ডোমেইন পেমেন্ট কনফার্ম হওয়ার ২ থেকে ১০ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে চালু হয় এবং ইমেইল ও ড্যাশবোর্ডে অ্যাক্সেস প্রদান করা হয়।',
            },
            {
                clauseNumber: '1.2',
                heading_en: 'Account Security, 2FA Sudo Gate & Billing Renewal',
                heading_bn: 'অ্যাকাউন্ট নিরাপত্তা, 2FA ভেরিফিকেশন এবং রিনিউয়াল',
                content_en:
                    'Customers are responsible for maintaining strong credentials. Destructive actions (dropping databases, revealing .env secrets, or transferring ownership) require step-up 2FA Sudo verification. Subscriptions renew at the standard published rate unless cancelled prior to the renewal date.',
                content_bn:
                    'গ্রাহকের অ্যাকাউন্ট ও ডেটা সুরক্ষায় ডেটাবেস ডিলিট বা গোপন .env কি দেখার ক্ষেত্রে 2FA Sudo ভেরিফিকেশন বাধ্যতামূলক। রিনিউয়াল তারিখের পূর্বে ক্যানসেল না করলে নির্ধারিত মূল্যে বিল জেনারেট হবে।',
            },
        ],
    },
    {
        slug: 'privacy-policy',
        title_en: 'Data Privacy, Zero-Knowledge .ENV Encryption & GDPR Policy',
        title_bn: 'ডেটা প্রাইভেসি, জিরো-নলেজ .ENV এনক্রিপশন এবং গোপনীয়তা নীতিমালা',
        version: 'v3.2 (Nov 2026)',
        effective_date: 'November 1, 2026',
        summary_highlights_json: [
            {
                en: 'AES-256-GCM Encrypted Secrets: All project .env variables are encrypted at rest using Web Crypto PBKDF2 + AES-256-GCM.',
                bn: 'AES-256-GCM এনক্রিপশন: আপনার প্রজেক্টের সকল .env ভেরিয়েবল সর্বোচ্চ সামরিক মানের এনক্রিপশনে সংরক্ষিত থাকে।',
            },
            {
                en: 'Zero Third-Party Data Selling: We never sell, rent, or monetize customer personal data, source code, or visitor analytics.',
                bn: 'তৃতীয় পক্ষের কাছে তথ্য বিক্রি নিষিদ্ধ: আমরা কখনোই গ্রাহকের ব্যক্তিগত তথ্য, কোড বা ট্রাফিক ডেটা কোনো প্রতিষ্ঠানের কাছে বিক্রি করি না।',
            },
            {
                en: 'PCI-DSS & Mobile Payment Safety: We never store raw card numbers or bKash/Nagad PINs on our servers.',
                bn: 'পেমেন্ট নিরাপত্তা: বিকাশ/নগদ পিন বা কার্ডের গোপন তথ্য আমাদের সার্ভারে কখনোই সংরক্ষণ করা হয় না।',
            },
            {
                en: '1-Click Data Export & Right to Erasure: Export your full backups or request permanent account deletion anytime.',
                bn: 'ডেটা এক্সপোর্ট ও ডিলিট করার অধিকার: যেকোনো সময় আপনার সম্পূর্ণ ব্যাকআপ ডাউনলোড বা অ্যাকাউন্ট মুছে ফেলার অনুরোধ করতে পারবেন।',
            },
        ],
        sections_json: [
            {
                clauseNumber: '2.1',
                heading_en: 'Information We Collect & Lawful Purpose',
                heading_bn: 'সংগ্রহীত তথ্য এবং ব্যবহারের উদ্দেশ্য',
                content_en:
                    'We collect only the minimum operational data required to provision cloud infrastructure, register ICANN domains, verify payment transaction IDs (trxID), and prevent automated abuse.',
                content_bn:
                    'ক্লাউড সার্ভার চালু করা, ডোমেইন রেজিস্ট্রেশন এবং পেমেন্ট ভেরিফিকেশনের জন্য শুধুমাত্র ন্যূনতম প্রয়োজনীয় তথ্য (নাম, ইমেইল, ফোন নম্বর ও ট্রানজেকশন আইডি) সংগ্রহ করা হয়।',
            },
            {
                clauseNumber: '2.2',
                heading_en: 'Cryptographic Protection of Environment Variables & Backups',
                heading_bn: 'এনভায়রনমেন্ট ভেরিয়েবল এবং ব্যাকআপের ক্রিপ্টোগ্রাফিক সুরক্ষা',
                content_en:
                    'All sensitive API keys stored in the DevHost .ENV Vault are encrypted with AES-256-GCM and a unique 12-byte initialization vector. Offsite JetBackup snapshots are encrypted in Equinix SG1 object storage with a rolling 14-day retention window.',
                content_bn:
                    'ড্যাশবোর্ডে সংরক্ষিত সকল .ENV ভেরিয়েবল AES-256-GCM প্রযুক্তিতে এনক্রিপ্টেড থাকে এবং জেটব্যাকআপ স্ন্যাপশটগুলো সিঙ্গাপুর ডেটাসেন্টারে নিরাপদে সংরক্ষিত থাকে।',
            },
        ],
    },
    {
        slug: 'refund-and-cancellation',
        title_en: '30-Day Money-Back Guarantee & Free-Domain Deduction Policy',
        title_bn: '৩০ দিনের মানি-ব্যাক গ্যারান্টি এবং ফ্রি ডোমেইন কর্তন নীতিমালা',
        version: 'v3.2 (Nov 2026)',
        effective_date: 'November 1, 2026',
        summary_highlights_json: [
            {
                en: '30-Day Hosting Money-Back Guarantee: Full refund on shared & developer cloud hosting plans cancelled within 30 days of initial purchase.',
                bn: '৩০ দিনের মানি-ব্যাক গ্যারান্টি: নতুন হোস্টিং কেনার ৩০ দিনের মধ্যে সার্ভিস পছন্দ না হলে রিফান্ড সুবিধা।',
            },
            {
                en: 'Free Domain Retention & Deduction Rule: If your annual plan included a Free Domain (.com/.xyz/.shop), the domain registration cost is deducted from the refund and you keep 100% ownership of the domain.',
                bn: 'ফ্রি ডোমেইন কর্তন নিয়ম: বার্ষিক প্ল্যানে ফ্রি ডোমেইন নিয়ে থাকলে রিফান্ডের সময় ডোমেইনের রেজিস্ট্রেশন ফি কেটে বাকি টাকা ফেরত দেওয়া হবে এবং ডোমেইনটি আপনার নামেই থাকবে।',
            },
            {
                en: 'Affiliate Commission Clawback: Any pending affiliate commission tied to a refunded invoice is automatically voided.',
                bn: 'অ্যাফিলিয়েট কমিশন বাতিল: কোনো অর্ডার রিফান্ড করা হলে তার বিপরীতে পেন্ডিং থাকা অ্যাফিলিয়েট কমিশন স্বয়ংক্রিয়ভাবে বাতিল হয়।',
            },
            {
                en: 'Fast 3–5 Business Day Settlement: Approved refunds are returned directly to your original bKash, Nagad, Card, or Instant Account Wallet.',
                bn: 'দ্রুত রিফান্ড নিষ্পত্তি: অনুমোদিত রিফান্ড সরাসরি আপনার বিকাশ, নগদ, কার্ড অথবা তাৎক্ষণিকভাবে অ্যাকাউন্ট ওয়ালেটে ফেরত দেওয়া হয়।',
            },
        ],
        sections_json: [
            {
                clauseNumber: '3.1',
                heading_en: 'Mathematical Formula for Free-Domain Bundle Refunds (Anti-Loss Clause)',
                heading_bn: 'ফ্রি ডোমেইন বান্ডেলসহ হোস্টিং রিফান্ডের গাণিতিক হিসাব',
                content_en:
                    'Because ICANN/Registry domain registrations are irreversible and paid immediately upstream upon order creation, standalone domains and 1st-Year Free Bundled Domains cannot be cancelled at the registry. If you request a 30-day refund on an Annual Hosting Plan that included a Free Domain, your refundable amount is strictly calculated as: Refundable Amount = Total Invoice Paid - Standard Domain Registration Price (e.g., ৳1,350 for .com, ৳1,450 for .net, ৳290 for .xyz/.shop). You retain full ownership and EPP transfer rights to the domain.',
                content_bn:
                    'ডোমেইন রেজিস্ট্রেশন একবার সম্পন্ন হলে তা আন্তর্জাতিক রেজিস্ট্রি থেকে বাতিলযোগ্য নয়। তাই বার্ষিক হোস্টিং প্ল্যানে ফ্রি ডোমেইন গ্রহণ করার পর ৩০ দিনের মধ্যে রিফান্ড চাইলে মোট পরিশোধিত বিল থেকে উক্ত ডোমেইনের নির্ধারিত রেজিস্ট্রেশন মূল্য (যেমন .com ৳১,৩৫০ বা .xyz ৳২৯০) বাদ দিয়ে অবশিষ্ট টাকা রিফান্ড করা হবে এবং ডোমেইনটির সম্পূর্ণ মালিকানা গ্রাহকের কাছেই থাকবে।',
            },
            {
                clauseNumber: '3.2',
                heading_en: 'Non-Refundable Items & Abuse Violations',
                heading_bn: 'অফেরতযোগ্য সেবা এবং নীতিমালা লঙ্ঘন',
                content_en:
                    'Dedicated Bare-Metal servers, software licenses, renewal invoices after the initial 30-day period, and accounts terminated for phishing, malware, or DMCA violations are strictly non-refundable.',
                content_bn:
                    'ডেডিকেটেড সার্ভার, রিনিউয়াল ইনভয়েস এবং ফিশিং বা ম্যালওয়্যারের কারণে সাসপেন্ড হওয়া অ্যাকাউন্টের ক্ষেত্রে কোনো রিফান্ড প্রযোজ্য নয়।',
            },
        ],
    },
    {
        slug: 'service-level-agreement',
        title_en: '99.99% Uptime Service Level Agreement (SLA) & Credit Schedule',
        title_bn: '৯৯.৯৯% আপটাইম গ্যারান্টি (SLA) এবং ক্রেডিট ক্ষতিপূরণ নীতিমালা',
        version: 'v3.2 (Nov 2026)',
        effective_date: 'November 1, 2026',
        summary_highlights_json: [
            {
                en: '99.99% Network & Power Guarantee: Backed by Equinix SG1 (Singapore) and US-East Tier-IV redundant datacenters.',
                bn: '৯৯.৯৯% নেটওয়ার্ক ও পাওয়ার গ্যারান্টি: সিঙ্গাপুর Equinix SG1 এবং ইউএসএ Tier-IV ডেটাসেন্টার দ্বারা সুরক্ষিত।',
            },
            {
                en: 'Autonomous Self-Healing Engine: HTTP 503 Passenger hangs and SSL renewals are remediated automatically in < 2 seconds.',
                bn: 'অটোমেটিক সেলফ-হিলিং ইঞ্জিন: সার্ভার হ্যাং বা 503 এরর ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে রিস্টার্ট ও সমাধান হয়।',
            },
            {
                en: 'Up to 100% Monthly Fee Credit: Tiered financial SLA credits if monthly availability ever drops below 99.9%.',
                bn: '১০০% পর্যন্ত বিল ক্রেডিট: মাসিক আপটাইম ৯৯.৯%-এর নিচে নামলে শর্তানুযায়ী ১০% থেকে ১০০% পর্যন্ত ক্রেডিট প্রদান করা হয়।',
            },
            {
                en: 'Real-Time Public Looking Glass: Live latency and 90-day component uptime are publicly auditable at /server-status.',
                bn: 'পাবলিক লাইভ স্ট্যাটাস: আমাদের সকল সার্ভারের পিং এবং ৯০ দিনের আপটাইম /server-status পেজে সরাসরি যাচাইযোগ্য।',
            },
        ],
        sections_json: [
            {
                clauseNumber: '4.1',
                heading_en: 'Official SLA Uptime Credit Tier Schedule',
                heading_bn: 'আপটাইম ক্রেডিট ক্ষতিপূরণ তালিকা',
                content_en:
                    'If unscheduled infrastructure downtime causes your monthly availability to fall below our guaranteed threshold, you are entitled to account credits calculated as a percentage of your monthly hosting fee: (a) 99.90% to 99.99%: 0% (Target SLA Met); (b) 99.00% to 99.89% (>43m downtime): 10% Credit; (c) 95.00% to 98.99% (>7.2h downtime): 25% Credit; (d) Below 95.00% (>36h downtime): 100% Full Monthly Credit.',
                content_bn:
                    'অনির্ধারিত সার্ভার ডাউনটাইমের কারণে মাসিক আপটাইম কমে গেলে আপনি নিচের হারে অ্যাকাউন্ট ক্রেডিট পাবেন: (ক) ৯৯.০০% - ৯৯.৮৯%: ১০% ক্রেডিট; (খ) ৯৫.০০% - ৯৮.৯৯%: ২৫% ক্রেডিট; (গ) ৯৫.০০%-এর নিচে: ১০০% সম্পূর্ণ মাসের ফি ক্রেডিট।',
            },
        ],
    },
    {
        slug: 'acceptable-use-and-dmca',
        title_en: 'Acceptable Use Policy (AUP), Anti-Phishing Shield & DMCA Notice Procedure',
        title_bn: 'গ্রহণযোগ্য ব্যবহার নীতিমালা (AUP), অ্যান্টি-ফিশিং এবং DMCA কপিরাইট নীতি',
        version: 'v3.2 (Nov 2026)',
        effective_date: 'November 1, 2026',
        summary_highlights_json: [
            {
                en: 'Automated Anti-Phishing Quarantine: Any domain impersonating banks, MFS providers (bKash/Nagad), or global brands is quarantined immediately.',
                bn: 'অটোমেটিক অ্যান্টি-ফিশিং শিল্ড: ব্যাংক, বিকাশ/নগদ বা অন্য কোনো ব্র্যান্ডের নামে ফিশিং সাইট খুললে তাৎক্ষণিক ব্লক করা হয়।',
            },
            {
                en: 'Zero Unsolicited Bulk Spam: Outbound SMTP port 25 abuse or bulk spam lists result in immediate mail relay suspension.',
                bn: 'বাল্ক স্প্যাম ইমেইল নিষিদ্ধ: স্প্যাম বা বাল্ক ফিশিং ইমেইল পাঠালে তাৎক্ষণিকভাবে মেইল সার্ভিস বন্ধ করা হয়।',
            },
            {
                en: '24-Hour DMCA Takedown Response: Verified copyright infringement notices submitted via /abuse are processed within 24 hours.',
                bn: '২৪ ঘণ্টায় DMCA নিষ্পত্তি: /abuse পেজের মাধ্যমে জমা দেওয়া বৈধ কপিরাইট অভিযোগ ২৪ ঘণ্টার মধ্যে নিষ্পত্তি করা হয়।',
            },
            {
                en: 'Cryptomining & Botnet Ban: Unauthorized CPU cryptominers, C2 botnets, and port scanners are terminated automatically.',
                bn: 'ক্রিপ্টো মাইনিং ও বটনেট নিষিদ্ধ: সার্ভারে ক্রিপ্টো মাইনিং বা হ্যাকিং টুল চালালে সাথে সাথে টার্মিনেট করা হয়।',
            },
        ],
        sections_json: [
            {
                clauseNumber: '5.1',
                heading_en: 'Prohibited Cyber Activities & Upstream IP Reputation Protection',
                heading_bn: 'নিষিদ্ধ সাইবার কার্যক্রম এবং সার্ভার আইপি সুরক্ষা',
                content_en:
                    'To protect the IP reputation and BDIX routing integrity of all customers on our cluster, hosting phishing kits, credential harvesters, malware droppers, darknet markets, or DDoS stressor scripts is strictly prohibited. Our automated Abuse Shield Engine scans newly provisioned domains and quarantines high-risk targets immediately.',
                content_bn:
                    'ক্লাস্টারের সকল গ্রাহকের আইপি রেপুটেশন সুরক্ষিত রাখতে ফিশিং কিট, ম্যালওয়্যার বা হ্যাকিং স্ক্রিপ্ট হোস্ট করা সম্পূর্ণ নিষিদ্ধ। আমাদের অটোমেটেড অ্যাবিউজ শিল্ড ঝুঁকিপূর্ণ ডোমেইন তাৎক্ষণিকভাবে কোয়ারেন্টাইন করে।',
            },
        ],
    },
];

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

        // Otherwise list abuse reports
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
