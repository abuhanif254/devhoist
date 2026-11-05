export interface DocArticle {
  id: string;
  slug: string;
  title: string;
  category: 'Deployments' | 'Next.js & Node.js' | 'WordPress' | 'DNS & Domains' | 'Troubleshooting' | 'Security';
  readTime: string;
  summary: string;
  keywords: string[];
  recommendedPlanId: string;
  sections: {
    heading: string;
    content: string;
    codeSnippet?: {
      language: string;
      code: string;
      filename?: string;
    };
    callout?: {
      type: 'tip' | 'warning' | 'info';
      text: string;
    };
  }[];
}

export const DOCS_ARTICLES: DocArticle[] = [
  {
    id: 'nextjs-cpanel-deploy',
    slug: 'how-to-auto-deploy-nextjs-from-github-to-cpanel',
    title: 'How to Auto-Deploy Next.js from GitHub to cPanel (Zero-Downtime)',
    category: 'Next.js & Node.js',
    readTime: '4 min read',
    summary: 'A step-by-step guide to building your Next.js standalone application on GitHub Actions free runners and pushing only production artifacts directly to cPanel.',
    keywords: ['nextjs', 'cpanel', 'github actions', 'auto-deploy', 'standalone', 'node.js', 'devops'],
    recommendedPlanId: 'developer-pro',
    sections: [
      {
        heading: '1. Configure Standalone Output in Next.js',
        content: 'To prevent uploading massive devDependencies and node_modules to your cPanel disk, enable Next.js standalone output. This packages only the required runtime dependencies into a tiny 40MB footprint.',
        codeSnippet: {
          language: 'typescript',
          filename: 'next.config.ts',
          code: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;`,
        },
        callout: {
          type: 'tip',
          text: 'Using standalone output reduces disk quota consumption by up to 80% and keeps Inode count under 1,500 per deployment.',
        },
      },
      {
        heading: '2. Set Up GitHub Actions Build Pipeline',
        content: 'Build the application using GitHub free runners so your cPanel CPU and RAM are never throttled during webpack compilation.',
        codeSnippet: {
          language: 'yaml',
          filename: '.github/workflows/deploy.yml',
          code: `name: Deploy Next.js to cPanel

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci
          npm run build
          cp -r public .next/standalone/public
          cp -r .next/static .next/standalone/.next/static

      - name: Deploy via Rsync / SSH
        uses: easingthemes/ssh-deploy@main
        env:
          SSH_PRIVATE_KEY: \${{ secrets.CPANEL_SSH_KEY }}
          REMOTE_HOST: \${{ secrets.CPANEL_HOST }}
          REMOTE_USER: \${{ secrets.CPANEL_USER }}
          TARGET: ~/repositories/myapp/
          SOURCE: .next/standalone/
          SCRIPT_AFTER: |
            touch ~/repositories/myapp/tmp/restart.txt`,
        },
      },
      {
        heading: '3. Enable In-Place Restart via Passenger',
        content: 'cPanel CloudLinux utilizes Phusion Passenger to run Node.js applications. To reload the app instantly without restarting the server or dropping active connections, touch the `tmp/restart.txt` file.',
        codeSnippet: {
          language: 'bash',
          filename: 'Terminal (Jailed SSH)',
          code: `mkdir -p ~/repositories/myapp/tmp
touch ~/repositories/myapp/tmp/restart.txt`,
        },
        callout: {
          type: 'info',
          text: 'Passenger detects changes to restart.txt within 1.2 seconds and reloads your worker threads with zero downtime.',
        },
      },
    ],
  },
  {
    id: 'cpanel-yml-config',
    slug: 'cpanel-yml-git-version-control-configuration',
    title: 'Automated Deployment with .cpanel.yml Git Version Control',
    category: 'Deployments',
    readTime: '3 min read',
    summary: 'Master the native cPanel Git Version Control engine using `.cpanel.yml` for automated post-receive deployments.',
    keywords: ['cpanel.yml', 'git', 'version control', 'webhook', 'deployment'],
    recommendedPlanId: 'developer-pro',
    sections: [
      {
        heading: '1. Creating the .cpanel.yml Configuration File',
        content: 'Place the `.cpanel.yml` file in the root of your Git repository. cPanel automatically triggers these shell instructions whenever a webhook receives a push event.',
        codeSnippet: {
          language: 'yaml',
          filename: '.cpanel.yml',
          code: `---
deployment:
  tasks:
    - export DEPLOYPATH=/home/username/public_html/
    - /bin/cp -rf * $DEPLOYPATH
    - /bin/chmod 755 $DEPLOYPATH`,
        },
        callout: {
          type: 'warning',
          text: 'Replace "/home/username/public_html/" with your exact cPanel home directory path visible in cPanel Dashboard > General Information.',
        },
      },
      {
        heading: '2. Connecting GitHub Webhook',
        content: 'In your GitHub repository Settings > Webhooks, add your cPanel Git push URL with payload format `application/json` to trigger hands-free zero-touch deployments.',
      },
    ],
  },
  {
    id: 'fixing-node-503',
    slug: 'fixing-nodejs-503-errors-cloudlinux-cpanel',
    title: 'Fixing Node.js 503 Service Unavailable Errors on CloudLinux',
    category: 'Troubleshooting',
    readTime: '5 min read',
    summary: 'Diagnose and resolve CloudLinux CageFS, Passenger memory limit, and Node.js startup file path errors in under 3 minutes.',
    keywords: ['503 error', 'cloudlinux', 'cagefs', 'passenger', 'nodejs', 'troubleshooting'],
    recommendedPlanId: 'developer-pro',
    sections: [
      {
        heading: '1. Inspect the Passenger Error Log',
        content: 'Unlike generic 503 errors, cPanel logs the exact stack trace in the user home directory.',
        codeSnippet: {
          language: 'bash',
          filename: 'Terminal (Jailed SSH)',
          code: `tail -n 100 ~/logs/passenger.log
# Or check the stderr stream directly:
cat ~/repositories/myapp/stderr.log`,
        },
      },
      {
        heading: '2. Verify Application Startup File Path',
        content: 'Inside cPanel "Setup Node.js App", ensure "Application startup file" is set to `server.js` or `app.js` and matches the exact relative path inside your root folder.',
        callout: {
          type: 'tip',
          text: 'If using Next.js standalone output, set the startup file to "server.js". Do not use "npm start" as the startup file.',
        },
      },
      {
        heading: '3. Increase Memory Limit Allocation',
        content: 'If your app exceeds the default 512MB RAM barrier during peak traffic, upgrade to Developer Pro (2GB RAM) or Business Max (4GB RAM) for dedicated memory headroom.',
      },
    ],
  },
  {
    id: 'custom-nameservers-cloudflare',
    slug: 'how-to-connect-custom-nameservers-and-cloudflare',
    title: 'How to Connect Custom Nameservers & Cloudflare DNS in 60 Seconds',
    category: 'DNS & Domains',
    readTime: '3 min read',
    summary: 'Point your registered domain name to DevHost Cloud high-speed NVMe servers or set up Cloudflare CDN integration for global edge caching.',
    keywords: ['nameservers', 'dns', 'cloudflare', 'domain setup', 'a record'],
    recommendedPlanId: 'starter',
    sections: [
      {
        heading: '1. DevHost Cloud Default Nameservers',
        content: 'If you want DevHost Cloud to automatically handle all your DNS, Mail, and Wildcard SSL records, update your domain nameservers to:',
        codeSnippet: {
          language: 'text',
          filename: 'DNS Records',
          code: `Primary Nameserver:   ns1.devhostcloud.com
Secondary Nameserver: ns2.devhostcloud.com`,
        },
      },
      {
        heading: '2. Connecting via Cloudflare DNS Proxy',
        content: 'If proxying through Cloudflare, create an `A` record pointing to your server dedicated IP address with Proxy Status set to Orange Cloud (Proxied).',
        codeSnippet: {
          language: 'text',
          filename: 'Cloudflare DNS Records',
          code: `Type: A   | Name: @   | Value: 103.xxx.xxx.xxx | Proxy: Proxied
Type: CNAME | Name: www | Value: @               | Proxy: Proxied`,
        },
      },
    ],
  },
  {
    id: 'wordpress-litespeed-optimization',
    slug: 'optimizing-wordpress-litespeed-cache-nvme',
    title: 'Optimizing WordPress for 100/100 PageSpeed with LiteSpeed Cache',
    category: 'WordPress',
    readTime: '4 min read',
    summary: 'Unlock sub-300ms Time-To-First-Byte (TTFB) and 100/100 Core Web Vitals using built-in LiteSpeed Enterprise server-level caching.',
    keywords: ['wordpress', 'litespeed', 'lscache', 'pagespeed', 'ttfb', 'woocommerce'],
    recommendedPlanId: 'business-max',
    sections: [
      {
        heading: '1. Activate LiteSpeed Cache Plugin',
        content: 'Our servers run LiteSpeed Enterprise at the web server layer. In your WordPress admin, install and activate the official LiteSpeed Cache plugin.',
      },
      {
        heading: '2. Recommended Presets Configuration',
        content: 'Navigate to LiteSpeed Cache > Presets and select the "Advanced (Recommended)" preset. This automatically configures HTML/CSS/JS minification, critical CSS generation, and server-side page caching.',
        callout: {
          type: 'tip',
          text: 'LiteSpeed cache is served directly from RAM without touching PHP or MySQL, handling over 10,000 requests per second effortlessly.',
        },
      },
    ],
  },
  {
    id: 'prevent-inode-exhaustion',
    slug: 'how-to-prevent-inode-and-disk-bloat-on-cpanel',
    title: 'How to Prevent Inode & Disk Bloat on cPanel with In-Place Overwrites',
    category: 'Deployments',
    readTime: '4 min read',
    summary: 'Discover how naive CI/CD pipelines blow up your cPanel storage quotas, and how our smart in-place overwrite strategy saves 80% disk space.',
    keywords: ['inode', 'disk quota', 'cpanel storage', 'clean deployments', 'git cleanup'],
    recommendedPlanId: 'developer-pro',
    sections: [
      {
        heading: '1. The Problem with Naive Git Pull Deployments',
        content: 'Running `npm install` on a live cPanel server generates 40,000+ tiny files inside `node_modules`. Doing this repeatedly or versioning multiple release directories quickly hits your 150,000 to 300,000 Inode limit.',
      },
      {
        heading: '2. The Smart In-Place Overwrite Solution',
        content: 'By building in GitHub Actions and using rsync `--delete` to overwrite only changed files, your live server stores only the final executable files. Unused assets and previous build hashes are pruned automatically.',
        codeSnippet: {
          language: 'bash',
          filename: 'Deploy Script',
          code: `rsync -avz --delete --exclude='.git' --exclude='node_modules' ./dist/ user@host:~/public_html/`,
        },
      },
    ],
  },
];
