/**
 * Complete Documentation Knowledgebase Dataset
 * Exact 6-article technical knowledgebase for /docs and Command Palette (Ctrl+K).
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
  category: 'Git & CI/CD Deployment' | 'Node.js & Custom Apps' | 'Troubleshooting' | 'Domains & DNS' | 'WordPress & E-Commerce' | 'AI Website Builder';
  readTime: string;
  summary: string;
  recommendedPlanId: number;
  steps: DocStep[];
}

export const EXACT_DOCS_ARTICLES: DocArticle[] = [
  {
    id: 'doc-1',
    slug: 'deploy-nextjs-github-cpanel-zero-bloat',
    title: 'How to Auto-Deploy Next.js to cPanel via GitHub Actions (Zero Storage Bloat)',
    category: 'Git & CI/CD Deployment',
    readTime: '4 min read',
    summary:
      'Learn how to leverage Next.js standalone output and GitHub Actions free runners to build externally and sync only production artifacts to cPanel with zero node_modules bloat.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Configure Next.js Standalone Output',
        explanation:
          'Add output: "standalone" inside next.config.mjs so Next.js traces only essential production dependencies instead of requiring a 600MB node_modules folder.',
        codeSnippet: {
          language: 'javascript',
          filename: 'next.config.mjs',
          code: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;`,
        },
        callout: {
          type: 'tip',
          text: 'Using standalone output reduces production bundle size to ~40MB and limits file count under 1,500 Inodes.',
        },
      },
      {
        heading: '2. Generate Jailed SSH Keys in cPanel',
        explanation:
          'Navigate to cPanel -> Security -> SSH Access -> Manage SSH Keys, generate a new 4096-bit RSA keypair without passphrase, click Manage -> Authorize, and copy the Private Key into your GitHub Repo Secrets as CPANEL_SSH_KEY (alongside CPANEL_HOST, CPANEL_USER, and CPANEL_SSH_PORT).',
        codeSnippet: {
          language: 'bash',
          filename: 'GitHub Repository Secrets',
          code: `CPANEL_HOST=your-server-ip-or-hostname
CPANEL_USER=your_cpanel_username
CPANEL_SSH_PORT=22
CPANEL_SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
..."`,
        },
      },
      {
        heading: '3. Create the CloudLinux Node.js Application',
        explanation:
          'Open cPanel -> Setup Node.js App, select Node.js v20, set Application Mode to Production, Application Root to apps/my-app-current, and Application Startup File to server.js.',
        callout: {
          type: 'info',
          text: 'Next.js standalone build generates server.js inside the root of .next/standalone. Do not use npm start or app.js.',
        },
      },
      {
        heading: '4. Push to main Branch',
        explanation:
          'Add the .github/workflows/deploy.yml script from our Developer Hub. Every git push origin main will build on GitHub\'s free runner, overwrite old files in place, and restart Phusion Passenger automatically via touch tmp/restart.txt.',
        codeSnippet: {
          language: 'bash',
          filename: 'Terminal',
          code: `git add .
git commit -m "feat: zero-downtime deployment pipeline"
git push origin main`,
        },
      },
    ],
  },
  {
    id: 'doc-2',
    slug: 'host-nodejs-express-api-cloudlinux',
    title: 'Hosting Node.js, Express & WebSocket APIs on CloudLinux NVMe',
    category: 'Node.js & Custom Apps',
    readTime: '3 min read',
    summary:
      'A practical guide to deploying Express.js REST APIs and real-time WebSockets on CloudLinux Phusion Passenger with dynamic port binding.',
    recommendedPlanId: 2,
    steps: [
      {
        heading: '1. Bind to Passenger Dynamic Port',
        explanation:
          'On CloudLinux Passenger, never hardcode port 3000 without fallback. Always use process.env.PORT to bind to Passenger\'s internal assigned socket:',
        codeSnippet: {
          language: 'javascript',
          filename: 'server.js',
          code: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'operational', runtime: process.version });
});

app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));`,
        },
      },
      {
        heading: '2. Set Environment Variables Safely',
        explanation:
          'Inside cPanel -> Setup Node.js App, scroll down to Environment Variables and add DATABASE_URL, JWT_SECRET, and NODE_ENV=production directly in the UI rather than committing sensitive .env files to Git.',
      },
      {
        heading: '3. Install Dependencies via Virtual Environment',
        explanation:
          'SSH into your account and run the CloudLinux virtual environment activation command displayed at the top of your Node.js Selector screen before executing npm ci --omit=dev.',
        codeSnippet: {
          language: 'bash',
          filename: 'Jailed SSH Terminal',
          code: `source /home/username/nodevenv/apps/my-app-current/20/bin/activate
cd ~/apps/my-app-current
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
          code: `tail -n 50 ~/apps/my-app-current/stderr.log`,
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
mkdir -p ~/apps/my-app-current/tmp
touch ~/apps/my-app-current/tmp/restart.txt`,
        },
      },
    ],
  },
  {
    id: 'doc-4',
    slug: 'connect-custom-nameservers-cloudflare-dns',
    title: 'Pointing Your Domain Nameservers & Configuring Cloudflare Zero-Downtime SSL',
    category: 'Domains & DNS',
    readTime: '2 min read',
    summary:
      'How to connect your domain using DevHost Cloud default nameservers or route via Cloudflare Proxy with Full (Strict) SSL encryption.',
    recommendedPlanId: 1,
    steps: [
      {
        heading: '1. Use Our White-Label Global Nameservers',
        explanation:
          'Update your domain registrar\'s nameservers to our primary cluster for automatic DNS zone provisioning and cPanel AutoSSL integration:',
        codeSnippet: {
          language: 'text',
          filename: 'Authoritative Nameservers',
          code: `ns1.yourdomain.com
ns2.yourdomain.com`,
        },
      },
      {
        heading: '2. Using Cloudflare Proxy (Orange Cloud)',
        explanation:
          'If managing DNS via Cloudflare, create an A record for @ and www pointing to your shared server IP, and set SSL/TLS encryption mode to Full (Strict) so Cloudflare communicates securely with our automated cPanel AutoSSL certificates.',
        codeSnippet: {
          language: 'text',
          filename: 'Cloudflare DNS Records',
          code: `Type: A     | Name: @   | Content: 103.xxx.xxx.xxx | Proxy status: Proxied
Type: CNAME | Name: www | Content: @               | Proxy status: Proxied
SSL/TLS Encryption Mode: Full (Strict)`,
        },
      },
    ],
  },
  {
    id: 'doc-5',
    slug: 'wordpress-litespeed-cache-100-pagespeed-setup',
    title: '1-Click WordPress Setup & LiteSpeed Cache (LSCache) Optimization for 100/100 Speed',
    category: 'WordPress & E-Commerce',
    readTime: '3 min read',
    summary:
      'Configure LiteSpeed Enterprise Web Server + LSCache on cPanel to achieve 100/100 Google Core Web Vitals and sub-62ms TTFB.',
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
      },
    ],
  },
  {
    id: 'doc-6',
    slug: 'build-website-with-sitejet-ai-builder',
    title: 'Generating a Complete Business Website in 60 Seconds with Sitejet AI Builder',
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
];
