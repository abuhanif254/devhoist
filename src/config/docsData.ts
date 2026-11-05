/**
 * Complete Documentation Knowledgebase Dataset
 * Exact 12-article technical knowledgebase for /docs and Command Palette (Ctrl+K).
 */

export interface DocStep {
  heading: string;
  explanation: string;
  codeSnippet?: {
    language: string;
    code: string;
    filename?: string;
  };
  callout?: {
    type: 'tip' | 'warning' | 'info';
    text: string;
  };
}

export interface DocArticle {
  id: string;
  slug: string;
  title: string;
  category:
    | 'Git & CI/CD Deployment'
    | 'Node.js & Custom Apps'
    | 'Troubleshooting'
    | 'Domains & DNS'
    | 'WordPress & E-Commerce'
    | 'AI Website Builder'
    | 'Affiliate Program & Growth'
    | 'Security, Billing & Operations';
  readTime: string;
  summary: string;
  recommendedPlanId: number;
  steps: DocStep[];
}

export const EXACT_DOCS_ARTICLES: DocArticle[] = [
  // ==========================================
  // TRACK 1: DEVELOPER CI/CD & CUSTOM APPS
  // ==========================================
  {
    id: 'doc-1',
    slug: 'deploy-nextjs-github-cpanel-zero-bloat',
    title: 'How to Auto-Deploy Next.js 15 to cPanel via GitHub Actions (Zero Storage Bloat)',
    category: 'Git & CI/CD Deployment',
    readTime: '4 min read',
    summary:
      'Learn how to leverage Next.js standalone output and GitHub Actions free runners to build externally and sync only production artifacts to cPanel with zero node_modules bloat.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Configure Next.js Standalone Output',
        explanation:
          'Add output: "standalone" inside next.config.ts (or next.config.mjs) so Next.js traces only essential production dependencies instead of requiring a 600MB node_modules directory.',
        codeSnippet: {
          language: 'typescript',
          filename: 'next.config.ts',
          code: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;`,
        },
        callout: {
          type: 'tip',
          text: 'Using standalone output reduces production bundle size to ~35MB and limits file count under 1,500 Inodes, keeping you well under cPanel limits.',
        },
      },
      {
        heading: '2. Generate Jailed SSH Keys in cPanel',
        explanation:
          'Navigate to cPanel -> Security -> SSH Access -> Manage SSH Keys. Generate a new 4096-bit RSA keypair without a passphrase, click Manage -> Authorize, and copy the Private Key into your GitHub Repo Secrets as CPANEL_SSH_KEY (alongside CPANEL_HOST, CPANEL_USER, and CPANEL_SSH_PORT=22).',
        codeSnippet: {
          language: 'bash',
          filename: 'GitHub Repository Secrets',
          code: `CPANEL_HOST=sg1.devhostcloud.com
CPANEL_USER=your_cpanel_username
CPANEL_SSH_PORT=22
CPANEL_SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...
-----END OPENSSH PRIVATE KEY-----"`,
        },
      },
      {
        heading: '3. Create the CloudLinux Node.js Application',
        explanation:
          'Open cPanel -> Setup Node.js App, select Node.js v20 (LTS), set Application Mode to Production, Application Root to apps/my-app, and Application Startup File to server.js.',
        callout: {
          type: 'info',
          text: 'Next.js standalone build generates server.js inside the root of .next/standalone. Phusion Passenger binds directly to this file.',
        },
      },
      {
        heading: '4. GitHub Actions Zero-Downtime Workflow',
        explanation:
          'Create .github/workflows/deploy.yml in your repository. Every git push origin main will build on GitHub, copy standalone files to cPanel, and trigger instant reload via touch tmp/restart.txt.',
        codeSnippet: {
          language: 'yaml',
          filename: '.github/workflows/deploy.yml',
          code: `name: Deploy Next.js to DevHost cPanel

on:
  push:
    branches: [main]

jobs:
  build-and-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install & Build Standalone
        run: |
          npm ci
          npm run build
          cp -r public .next/standalone/
          cp -r .next/static .next/standalone/.next/

      - name: Sync Artifacts via Rsync over SSH
        uses: easingthemes/ssh-deploy@v5.1.0
        with:
          SSH_PRIVATE_KEY: \${{ secrets.CPANEL_SSH_KEY }}
          REMOTE_HOST: \${{ secrets.CPANEL_HOST }}
          REMOTE_USER: \${{ secrets.CPANEL_USER }}
          REMOTE_PORT: \${{ secrets.CPANEL_SSH_PORT }}
          SOURCE: ".next/standalone/"
          TARGET: "/home/\${{ secrets.CPANEL_USER }}/apps/my-app/"
          SCRIPT_AFTER: |
            mkdir -p /home/\${{ secrets.CPANEL_USER }}/apps/my-app/tmp
            touch /home/\${{ secrets.CPANEL_USER }}/apps/my-app/tmp/restart.txt`,
        },
      },
    ],
  },
  {
    id: 'doc-2',
    slug: 'host-nodejs-express-api-cloudlinux',
    title: 'Hosting Node.js, Express, NestJS & WebSockets on CloudLinux NVMe',
    category: 'Node.js & Custom Apps',
    readTime: '3 min read',
    summary:
      'A practical guide to deploying Express.js REST APIs and real-time WebSockets on CloudLinux Phusion Passenger with dynamic port binding.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Bind to Passenger Dynamic Port',
        explanation:
          'On CloudLinux Passenger, never hardcode port 3000 or 8080 without fallback. Always listen on process.env.PORT to bind to Passenger\'s internal IPC socket:',
        codeSnippet: {
          language: 'javascript',
          filename: 'server.js',
          code: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

app.listen(PORT, () => {
  console.log(\`[DevHost] Application listening on dynamic port \${PORT}\`);
});`,
        },
      },
      {
        heading: '2. Set Environment Variables Safely',
        explanation:
          'Inside cPanel -> Setup Node.js App, scroll to Environment Variables and add DATABASE_URL, JWT_SECRET, and NODE_ENV=production directly in the UI rather than committing sensitive .env files to Git.',
      },
      {
        heading: '3. Install Dependencies via Jailed Virtual Environment',
        explanation:
          'SSH into your account and run the CloudLinux virtual environment activation command displayed at the top of your Node.js Selector screen before executing npm ci --omit=dev.',
        codeSnippet: {
          language: 'bash',
          filename: 'Jailed SSH Terminal',
          code: `source /home/username/nodevenv/apps/my-app/20/bin/activate
cd ~/apps/my-app
npm ci --omit=dev --prefer-offline`,
        },
      },
    ],
  },
  {
    id: 'doc-3',
    slug: 'fix-nodejs-503-service-unavailable-cpanel',
    title: 'Troubleshooting Node.js 503 Service Unavailable & Inode Quota Errors',
    category: 'Troubleshooting',
    readTime: '3 min read',
    summary:
      'Step-by-step diagnostic procedures for resolving Phusion Passenger startup crashes, 503 errors, and Inode quota exhaustion on cPanel.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Inspect Passenger Error Logs',
        explanation:
          'Check ~/apps/your-app/stderr.log via cPanel File Manager or SSH to identify missing environment variables, syntax errors, or crashed startup scripts:',
        codeSnippet: {
          language: 'bash',
          filename: 'Jailed SSH Terminal',
          code: `tail -n 50 ~/apps/my-app/stderr.log`,
        },
      },
      {
        heading: '2. Verify Startup Entry File',
        explanation:
          'Ensure the Application startup file in Node.js Selector matches your compiled entry point (dist/main.js for NestJS, server.js for Next.js standalone, or index.js for Express).',
      },
      {
        heading: '3. Clear Stale Lockfiles & Restart Passenger',
        explanation:
          'If memory or entry processes spiked during a manual build, remove local build caches and trigger a clean Passenger restart:',
        codeSnippet: {
          language: 'bash',
          filename: 'Terminal',
          code: `rm -rf ~/.npm/_cacache
mkdir -p ~/apps/my-app/tmp
touch ~/apps/my-app/tmp/restart.txt`,
        },
      },
    ],
  },

  // ==========================================
  // TRACK 2: WORDPRESS, AI & INFRASTRUCTURE
  // ==========================================
  {
    id: 'doc-4',
    slug: 'connect-custom-nameservers-cloudflare-dns',
    title: 'Setting Up Custom Glue Nameservers, RDAP Whois & Cloudflare Full SSL',
    category: 'Domains & DNS',
    readTime: '3 min read',
    summary:
      'How to connect your domain using DevHost Cloud default nameservers or route via Cloudflare Proxy with Full (Strict) SSL encryption.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Use Our White-Label Global Nameservers',
        explanation:
          'Update your domain registrar\'s authoritative nameservers to our primary cluster for automatic DNS zone provisioning and cPanel AutoSSL integration:',
        codeSnippet: {
          language: 'text',
          filename: 'Authoritative Nameservers',
          code: `ns1.devhostcloud.com (103.205.71.18)
ns2.devhostcloud.com (103.205.71.19)`,
        },
      },
      {
        heading: '2. Using Cloudflare Proxy (Orange Cloud)',
        explanation:
          'If managing DNS via Cloudflare, create an A record for @ and www pointing to your shared server IP, and set SSL/TLS encryption mode to Full (Strict) so Cloudflare communicates securely with our automated cPanel AutoSSL certificates.',
        codeSnippet: {
          language: 'text',
          filename: 'Cloudflare DNS Records',
          code: `Type: A     | Name: @   | Content: 103.205.71.18 | Proxy status: Proxied
Type: CNAME | Name: www | Content: @               | Proxy status: Proxied
SSL/TLS Encryption Mode: Full (Strict)`,
        },
      },
    ],
  },
  {
    id: 'doc-5',
    slug: 'wordpress-litespeed-cache-100-pagespeed-setup',
    title: '1-Click WordPress Setup, Redis Object Caching & LiteSpeed Optimization for 100/100 Core Web Vitals',
    category: 'WordPress & E-Commerce',
    readTime: '3 min read',
    summary:
      'Configure LiteSpeed Enterprise Web Server + LSCache on cPanel to achieve 100/100 Google Core Web Vitals and sub-40ms TTFB over BDIX.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Install WordPress via Softaculous',
        explanation:
          'Open cPanel -> Softaculous Apps Installer -> WordPress, select https://, choose your domain, and keep LiteSpeed Cache checked.',
        callout: {
          type: 'tip',
          text: 'Softaculous automatically configures MySQL database credentials, utf8mb4 encoding, and installs the official LSCache plugin.',
        },
      },
      {
        heading: '2. Enable Object Cache (Redis/Memcached) & WebP Replacement',
        explanation:
          'Inside WP Admin -> LiteSpeed Cache -> Presets, apply the Advanced (Recommended) preset and enable Image Optimization -> Auto Request Cron & WebP Replacement for sub-second TTFB.',
        codeSnippet: {
          language: 'apache',
          filename: '.htaccess (LiteSpeed Cache Rules)',
          code: `### BEGIN LiteSpeed Cache
<IfModule Litespeed>
CacheLookup on
CacheEngine on
CacheMaxAge 86400
RewriteEngine on
RewriteRule .* - [E=Cache-Control:max-age=3600]
</IfModule>
### END LiteSpeed Cache`,
        },
      },
    ],
  },
  {
    id: 'doc-6',
    slug: 'build-website-with-sitejet-ai-builder',
    title: 'Generating Production Business Websites in 60 Seconds with Sitejet AI Builder',
    category: 'AI Website Builder',
    readTime: '2 min read',
    summary:
      'How non-technical users and agency founders can generate responsive business landing pages with Sitejet AI directly inside cPanel.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Launch Sitejet from cPanel',
        explanation:
          'Log in to cPanel, navigate to Domains -> Sitejet Builder, and click Try Sitejet next to your domain.',
      },
      {
        heading: '2. Enter AI Prompts & Publish',
        explanation:
          'Describe your business industry, target audience, and preferred tone in 3 short sentences. Sitejet AI automatically generates copy, layout, and royalty-free visuals—click Publish to compile straight to your NVMe public_html directory.',
        callout: {
          type: 'info',
          text: 'Sitejet AI compiles pure static HTML/CSS/JS without heavyweight database overhead, delivering instant 99+ Core Web Vitals scores.',
        },
      },
    ],
  },
  {
    id: 'doc-7',
    slug: 'automated-jetbackup-disaster-recovery',
    title: 'JetBackup 5 Enterprise: Instant Zero-Data-Loss Restores & Offsite S3 Snapshots',
    category: 'WordPress & E-Commerce',
    readTime: '3 min read',
    summary:
      'Discover how DevHost Cloud automated daily JetBackup snapshots protect your files, MySQL databases, and mailboxes with 1-click self-service point-in-time restores.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Access JetBackup 5 Self-Service Portal',
        explanation:
          'Log in to your cPanel account or click "1-Click JetBackup" from the Client Dashboard. You will see point-in-time incremental snapshots stored in geographically isolated AWS S3 storage vaults.',
      },
      {
        heading: '2. Restore Specific Files or Full cPanel Directory',
        explanation:
          'Select "File Backups" to restore individual corrupted files or "Full Backups" to roll back your complete cPanel environment (including SSL, CRON, and email accounts) to any chosen timestamp in under 45 seconds.',
        codeSnippet: {
          language: 'bash',
          filename: 'CLI Restore Verification (Optional)',
          code: `# Verify current webroot timestamp vs backup snapshot
ls -lah ~/public_html/wp-config.php
# JetBackup runs in the background with zero lock on active MySQL transactions`,
        },
        callout: {
          type: 'tip',
          text: 'Snapshots are retained for 30 rolling days with hourly MySQL binary log replication, guaranteeing zero data loss even during hardware anomalies.',
        },
      },
    ],
  },

  // ==========================================
  // TRACK 3: AFFILIATE PARTNER PROGRAM
  // ==========================================
  {
    id: 'doc-8',
    slug: 'affiliate-partner-program-guide',
    title: 'DevHost Cloud Partner Program: 90-Day Cookie Attribution & Sub-ID Tracking',
    category: 'Affiliate Program & Growth',
    readTime: '4 min read',
    summary:
      'A complete blueprint for YouTube creators, bloggers, and web agencies to earn up to 30% recurring commissions using deep-links, sub-ID channel tracking, and 90-day cookies.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Activate Your Affiliate ID & Custom Referral Links',
        explanation:
          'Navigate to Client Area -> Affiliate Program. Your unique referral ID is automatically generated. You can append ?ref=YOUR_CODE to any public DevHost Cloud landing page or plan.',
        codeSnippet: {
          language: 'text',
          filename: 'Affiliate Deep-Link Structure',
          code: `https://devhostcloud.com/?ref=AFF-7842
https://devhostcloud.com/pricing?ref=AFF-7842&subid=youtube-oct
https://devhostcloud.com/wordpress?ref=AFF-7842&subid=blog-sidebar`,
        },
        callout: {
          type: 'info',
          text: 'Our edge middleware sets an encrypted, HttpOnly 90-day cookie (devhost_aff_ref). Even if the prospect purchases 2 months later, you receive the full commission credit.',
        },
      },
      {
        heading: '2. Multi-Channel Campaign Tracking with Sub-IDs',
        explanation:
          'Segment your marketing channels by adding the &subid= parameter. Track which specific YouTube video, Facebook ad, or newsletter generated higher click-through and signup conversions in real-time.',
      },
      {
        heading: '3. Embed Promotional High-Converting Banners',
        explanation:
          'Copy responsive banner code snippets from the Partner Toolkit into your website sidebar or footer for instant visual conversion.',
      },
    ],
  },
  {
    id: 'doc-9',
    slug: 'affiliate-commission-tiers-35day-hold',
    title: 'Commission Tier Progression (20% to 30%), 35-Day Hold & Automated bKash Payouts',
    category: 'Affiliate Program & Growth',
    readTime: '4 min read',
    summary:
      'Understand our transparent 3-tier commission scale, automated 35-day maturity hold policy, and instant local mobile banking disbursements (bKash/Nagad/Bank Transfer).',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. 3-Tier Commission Scale',
        explanation:
          'Every partner starts at Tier 1 (20% commission). As your referral volume grows, our automated PostgreSQL trigger elevates your tier and retroactive commission multipliers:',
        codeSnippet: {
          language: 'text',
          filename: 'Commission Tier Breakdown',
          code: `• Tier 1 (Starter Affiliate): 1 – 10 Referrals -> 20% Commission per sale
• Tier 2 (Silver Partner):    11 – 50 Referrals -> 25% Commission per sale
• Tier 3 (Gold VIP Master):   51+ Referrals     -> 30% Commission per sale`,
        },
      },
      {
        heading: '2. 35-Day Maturity Hold Guarantee',
        explanation:
          'DevHost Cloud offers an unconditional 30-day money-back guarantee to all customers. To safeguard the partner fund against chargebacks, all earned commissions enter a 35-day security clearance period. On day 36, funds automatically transition to Cleared Available Balance.',
        callout: {
          type: 'warning',
          text: 'If a referred customer requests a refund within 30 days, the corresponding pending commission is systematically clawed back with an immutable audit log entry.',
        },
      },
      {
        heading: '3. Minimum Payout Threshold & 1-Click Withdrawal',
        explanation:
          'Once your cleared balance reaches ৳1,000 BDT, request payout directly to your Personal or Merchant bKash/Nagad account. Funds are processed within 24 hours with an official MFS Transaction ID.',
      },
    ],
  },
  {
    id: 'doc-10',
    slug: 'anti-fraud-self-referral-policy',
    title: 'Anti-Fraud Shield: Strict Prohibition of Self-Referrals, Duplicate TrxIDs & Multi-Account Abuse',
    category: 'Affiliate Program & Growth',
    readTime: '3 min read',
    summary:
      'Learn about our 4-signal automated fraud detection engine that permanently bans self-referrals, proxy rings, and duplicate payment manipulation.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. The 4-Signal Self-Referral Detection Engine',
        explanation:
          'Our Cloudflare Edge and Supabase security triggers monitor four distinct signals during checkout to verify referral integrity:',
        codeSnippet: {
          language: 'text',
          filename: 'Anti-Self-Referral Signals',
          code: `Signal 1: Same Client IP between Click & Order (/api/affiliate)
Signal 2: Matching Billing Email / Account Domain
Signal 3: Same Mobile Wallet Number (bKash/Nagad sender phone)
Signal 4: Browser Device Fingerprint & Subnet Correlation`,
        },
      },
      {
        heading: '2. Penalty for Abuse',
        explanation:
          'Creating a separate account to purchase hosting using your own affiliate link is considered a zero-tolerance violation. When detected, the commission is immediately revoked, the affiliate account is frozen, and associated IPs are permanently blacklisted by our WAF.',
        callout: {
          type: 'warning',
          text: 'Zero exceptions are made for self-referral attempts. If you need a hosting discount for your own agency sites, please contact sales for enterprise volume discounts.',
        },
      },
    ],
  },

  // ==========================================
  // TRACK 4: SECURITY, BILLING & OPERATIONS
  // ==========================================
  {
    id: 'doc-11',
    slug: 'bkash-nagad-instant-checkout-billing',
    title: 'Instant bKash & Nagad Tokenized Checkout, Ledger Invoicing & Dunning Grace Periods',
    category: 'Security, Billing & Operations',
    readTime: '3 min read',
    summary:
      'How our automated payment validation and dunning engine keeps your hosting, domains, and cloud resources online without sudden service interruptions.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Instant bKash & Nagad Payment Validation',
        explanation:
          'DevHost Cloud supports instant mobile financial services checkout. Enter your 10-character alphanumeric bKash or Nagad Transaction ID (e.g., 9K72LM89QP). Our system validates the regex format, cross-checks uniqueness, and provisions your service in under 3.2 seconds.',
        codeSnippet: {
          language: 'regex',
          filename: 'MFS Validation Pattern',
          code: `bKash: /^[A-Za-z0-9]{10}$/
Nagad: /^[0-9]{8,12}$/ or alphanumeric voucher code`,
        },
      },
      {
        heading: '2. 7-Day Dunning Grace Period & Auto-Suspension',
        explanation:
          'We understand business cashflows. Renewal invoices are generated 14 days before due date with automated email and SMS reminders. If an invoice remains unpaid after the due date, a 7-day grace period is provided before cPanel resources are suspended. Your data remains 100% intact for 30 days.',
      },
    ],
  },
  {
    id: 'doc-12',
    slug: 'platform-security-cagefs-imunify360-waf',
    title: 'Enterprise Platform Security: CloudLinux CageFS Isolation, Imunify360 WAF & 2FA Zero-Trust',
    category: 'Security, Billing & Operations',
    readTime: '4 min read',
    summary:
      'An in-depth architectural breakdown of how DevHost Cloud isolates every customer vHost inside a virtualized CageFS container with real-time AI malware scanning.',
    recommendedPlanId: 3,
    steps: [
      {
        heading: '1. CloudLinux OS & CageFS Virtualized Isolation',
        explanation:
          'On traditional shared servers, a compromised site can see other users\' directories. At DevHost Cloud, every client account runs inside an isolated CloudLinux CageFS cage with dedicated virtualized /proc, /tmp, and /etc. No user can view or interact with neighboring vHosts.',
        codeSnippet: {
          language: 'bash',
          filename: 'CageFS Isolation Architecture',
          code: `# Every cPanel user is restricted to a virtualized filesystem
/home/user1 -> Isolated namespace (Memory: 2GB, CPU: 200%, I/O: 10MB/s)
/home/user2 -> Isolated namespace (Memory: 2GB, CPU: 200%, I/O: 10MB/s)
# Cross-account symlink attacks are mathematically impossible`,
        },
      },
      {
        heading: '2. Imunify360 AI Web Application Firewall (WAF)',
        explanation:
          'All inbound traffic is inspected in real-time by the Imunify360 proactive defense engine. Zero-day PHP exploits, malicious file uploads, SQL injection, and automated brute-force password cracking are neutralized before reaching your application layer.',
      },
      {
        heading: '3. Zero-Trust Admin & Customer Two-Factor Authentication',
        explanation:
          'Protect your account using Time-based One-Time Passwords (TOTP) compatible with Google Authenticator, Authy, or 1Password. Account logins from unknown IP ranges trigger immediate device authorization prompts.',
        callout: {
          type: 'tip',
          text: 'Super Admin command operations (like IP ban and commission clawbacks) require secondary session PIN verification for strict SOC2 compliance.',
        },
      },
    ],
  },
];
