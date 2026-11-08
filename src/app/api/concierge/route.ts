import { NextRequest, NextResponse } from 'next/server';
import {
    UNIVERSAL_MARKETPLACE_STACKS,
    PLAN_SLUG_TO_PID,
    getStackBlueprintBySlug,
} from '@/lib/stackProvisioner';
import { STANDARD_DOMAIN_RETAIL_PRICES_BDT } from '@/lib/profitEngine';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rawMessage = String(body.message || '').trim();
        const lower = rawMessage.toLowerCase();

        if (!rawMessage) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // =====================================================================
        // MODE 2: IN-CHAT INSTANT DOMAIN AVAILABILITY CHECKER
        // =====================================================================
        const domainMatch = rawMessage.match(
            /\b([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\.(com|net|org|io|xyz|shop|store|dev|cloud|bd)\b/i
        );
        if (
            domainMatch &&
            !lower.includes('error') &&
            !lower.includes('503') &&
            !lower.includes('prisma')
        ) {
            const fullDomain = domainMatch[0].toLowerCase();
            const tld = `.${domainMatch[2].toLowerCase()}`;
            const retailPriceBdt = STANDARD_DOMAIN_RETAIL_PRICES_BDT[tld] || 1350;

            // Check DNS via Cloudflare DoH to see if already registered/active
            let isTaken = false;
            try {
                const dohRes = await fetch(
                    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fullDomain)}&type=NS`,
                    { headers: { accept: 'application/dns-json' } }
                );
                if (dohRes.ok) {
                    const dohData = await dohRes.json();
                    isTaken = dohData.Status === 0 && Array.isArray(dohData.Answer) && dohData.Answer.length > 0;
                }
            } catch {
                isTaken = false;
            }

            const available = !isTaken;
            const reply = available
                ? `🎉 Great news! **${fullDomain}** is available for instant registration (Standard price: ৳${retailPriceBdt}/yr — or **৳0 FREE for the 1st year** when bundled with any Annual Cloud Hosting plan!).`
                : `⚠️ **${fullDomain}** is already registered. You can transfer it to DevHost Cloud or deploy your hosting container using this domain right now.`;

            return NextResponse.json({
                success: true,
                mode: 'domain_check',
                reply,
                domainCard: {
                    domain: fullDomain,
                    tld,
                    available,
                    retailPriceBdt,
                    freeWithAnnual: ['.com', '.net', '.org', '.xyz', '.shop'].includes(tld),
                },
            });
        }

        // =====================================================================
        // MODE 3: INSTANT DEVOPS ERROR RESOLVER & ESCALATION
        // =====================================================================
        if (
            lower.includes('503') ||
            lower.includes('eaddrinuse') ||
            lower.includes('prisma') ||
            lower.includes('nxdomain') ||
            lower.includes('oom') ||
            lower.includes('memory') ||
            lower.includes('error') ||
            lower.includes('crash')
        ) {
            let diagnosis =
                'CloudLinux Passenger or DNS configuration mismatch detected.';
            let commandFix = 'mkdir -p ~/app/tmp && touch ~/app/tmp/restart.txt';

            if (lower.includes('503') || lower.includes('eaddrinuse')) {
                diagnosis =
                    'HTTP 503 / EADDRINUSE: CloudLinux Phusion Passenger automatically injects the dynamic socket port via `process.env.PORT`. Make sure your entry file (`server.js` or `dist/main.js`) listens on `process.env.PORT || 3000` and trigger a zero-downtime Passenger restart.';
                commandFix = 'touch ~/app/tmp/restart.txt';
            } else if (lower.includes('prisma')) {
                diagnosis =
                    'PrismaClientInitializationError: Ensure `npx prisma generate` runs in your build step and `DATABASE_URL` in your AES-256-GCM .ENV Vault points to `127.0.0.1:5432` (PostgreSQL 16) or `127.0.0.1:3306` (MySQL 8.0).';
                commandFix = 'npx prisma generate && npx prisma migrate deploy';
            } else if (lower.includes('nxdomain') || lower.includes('dns')) {
                diagnosis =
                    'DNS_PROBE_FINISHED_NXDOMAIN: Your domain nameservers or root `@` A-record have not propagated yet. Point your domain to `ns1.devhost.cloud` / `ns2.devhost.cloud` or run the 1-Click DNS Auto-Fix in Dashboard -> AI Log Doctor.';
                commandFix = 'dig +short A yourdomain.com @1.1.1.1';
            }

            return NextResponse.json({
                success: true,
                mode: 'devops_resolver',
                reply: `🛠️ **AI DevOps Diagnosis:**\n${diagnosis}`,
                devopsCard: {
                    commandFix,
                    dashboardUrl: '/dashboard',
                    statusUrl: '/server-status',
                },
            });
        }

        // =====================================================================
        // MODE 1: SMART STACK & PLAN ADVISOR (BILINGUAL SALES CONCIERGE)
        // =====================================================================
        let matchedSlug = 'nextjs-15-standalone';
        if (lower.includes('laravel') || lower.includes('php') || lower.includes('filament')) {
            matchedSlug = 'laravel-11-saas';
        } else if (lower.includes('wordpress') || lower.includes('woocommerce') || lower.includes('উকমার্স') || lower.includes('ওয়ার্ডপ্রেস')) {
            matchedSlug = 'wordpress-woocommerce-turbo';
        } else if (lower.includes('vue') || lower.includes('nuxt')) {
            matchedSlug = 'vue-nuxt3-ssr';
        } else if (lower.includes('python') || lower.includes('fastapi') || lower.includes('django')) {
            matchedSlug = 'fastapi-django-python';
        } else if (lower.includes('nestjs')) {
            matchedSlug = 'nestjs-prisma-api';
        } else if (lower.includes('strapi')) {
            matchedSlug = 'strapi-headless-cms';
        } else if (lower.includes('n8n') || lower.includes('automation')) {
            matchedSlug = 'n8n-workflow-automation';
        } else if (lower.includes('socket') || lower.includes('websocket') || lower.includes('express') || lower.includes('chat')) {
            matchedSlug = 'express-realtime-websocket';
        } else if (lower.includes('medusa') || lower.includes('directus')) {
            matchedSlug = 'medusa-headless-commerce';
        } else if (lower.includes('astro')) {
            matchedSlug = 'astro-mdx-blog';
        } else if (lower.includes('svelte')) {
            matchedSlug = 'sveltekit-fullstack';
        } else if (lower.includes('kuma') || lower.includes('monitor')) {
            matchedSlug = 'uptime-kuma-monitor';
        }

        const stack = getStackBlueprintBySlug(matchedSlug) || UNIVERSAL_MARKETPLACE_STACKS[0];
        const plan = PLAN_SLUG_TO_PID[stack.recommended_plan_slug] || PLAN_SLUG_TO_PID['developer-pro'];

        const hasBengali = /[\u0980-\u09FF]/.test(rawMessage);
        const reply = hasBengali
            ? `আপনার প্রজেক্টের জন্য **${stack.name}** এবং আমাদের **${plan.planName} (৳${plan.monthlyBdt}/মাস)** প্ল্যানটি সবচেয়ে উপযুক্ত! এতে রয়েছে **${plan.ramMb / 1024} GB Dedicated RAM**, **${plan.cpuCores} Core vCPU**, **${plan.storageGb} GB Pure NVMe SSD**, অটোমেটিক **${stack.requires_database}** ডাটাবেস এবং বার্ষিক প্ল্যানে ১ম বছর **ফ্রি .com/.xyz ডোমেইন**।`
            : `For your workload, I recommend our **${stack.name}** blueprint running on **${plan.planName} (৳${plan.monthlyBdt}/mo)**. It provisions **${plan.ramMb / 1024} GB Dedicated RAM**, **${plan.cpuCores} vCPU**, **${plan.storageGb} GB NVMe SSD**, auto-configured **${stack.default_runtime_version}**, encrypted **.env Vault**, and includes a **1st-Year FREE Domain** on annual billing!`;

        return NextResponse.json({
            success: true,
            mode: 'stack_advisor',
            reply,
            deployAction: {
                stackSlug: stack.slug,
                stackName: stack.name,
                runtimeVersion: stack.default_runtime_version,
                pid: plan.pid,
                planName: plan.planName,
                monthlyBdt: plan.monthlyBdt,
                ramGb: plan.ramMb / 1024,
                cpuCores: plan.cpuCores,
                storageGb: plan.storageGb,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Concierge error' },
            { status: 500 }
        );
    }
}
