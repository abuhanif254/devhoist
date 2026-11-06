'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Bell,
  DollarSign,
  CreditCard,
  FileText,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';

export default function AdminCmsConfigView() {
  const { requireSudo } = useSudoGate();
  const [activeSubTab, setActiveSubTab] = useState<'banner' | 'currency' | 'gateways' | 'hero' | 'lockdown'>('banner');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // CMS State
  const [bannerConfig, setBannerConfig] = useState({
    enabled: true,
    badge_en: '99.99% Global Uptime SLA',
    badge_bn: '৯৯.৯৯% গ্লোবাল আপটাইম গ্যারান্টি',
    text_en: 'Instant bKash & Nagad Account Activation — Save 20% on Annual Plans with code LAUNCH20',
    text_bn: 'বিকাশ ও নগদে তাৎক্ষণিক অটোমেটিক হোস্টিং চালু — বার্ষিক প্ল্যানে ২০% ছাড় কোড LAUNCH20',
    promo_code: 'LAUNCH20',
    link_url: '/#pricing',
  });

  const [currencyConfig, setCurrencyConfig] = useState({
    usd_exchange_rate_bdt: 120,
    default_currency: 'BDT',
    vat_percent: 0,
  });

  const [gatewaysConfig, setGatewaysConfig] = useState({
    bkash_active: true,
    bkash_merchant_label: '01789-234567 (Automated Merchant)',
    nagad_active: true,
    nagad_merchant_label: '01889-234567 (Automated Merchant)',
    stripe_active: true,
    manual_trxid_fallback: true,
  });

  const [heroConfig, setHeroConfig] = useState({
    headline_line1: 'Developer Experience of Vercel.',
    headline_line2: 'Accessibility of cPanel.',
    subheadline_en: 'Deploy Git repos with LiteSpeed NVMe speed, instant automated bKash/Nagad checkout, and 1-click staging containers in Singapore & USA.',
    subheadline_bn: 'গিট রিপোজিটরি ডিপ্লয় করুন লাইটস্পিড NVMe স্পিডে, বিকাশ ও নগদে অটো অ্যাক্টিভেশন এবং সিঙ্গাপুর ও ইউএসএ ডাটা সেন্টারে ১-ক্লিকে হোস্টিং।',
    starting_price_badge: '৳200/mo',
    cta_button_en: 'Get Started — 30-Day Money Back',
    cta_button_bn: 'শুরু করুন — ৩০ দিনের মানিব্যাক',
  });

  const [lockdownConfig, setLockdownConfig] = useState({
    under_attack_mode: false,
    freeze_all_withdrawals: false,
    block_new_signups: false,
    require_2fa_for_all: false,
    maintenance_mode: false,
  });

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/cms-config');
      const data = await res.json();
      if (data.success && data.configs) {
        if (data.configs.announcement_banner) setBannerConfig(data.configs.announcement_banner);
        if (data.configs.currency_settings) setCurrencyConfig(data.configs.currency_settings);
        if (data.configs.payment_gateways_config) setGatewaysConfig(data.configs.payment_gateways_config);
        if (data.configs.hero_cms_content) setHeroConfig(data.configs.hero_cms_content);
        if (data.configs.security_lockdown) setLockdownConfig(data.configs.security_lockdown);
      }
    } catch (err) {
      console.warn('Failed to fetch CMS configs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveConfig = (key: string, value: any, label: string) => {
    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/cms-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            value,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`${label} updated successfully!`);
        fetchConfigs();
      } catch (err: any) {
        alert(err.message);
      }
    }, `Update ${label}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-mono text-xs shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            <span>Headless CMS, FX Exchange Rate &amp; Gateway Configurator</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold">
              Dynamic PostgreSQL
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Modify sitewide headlines, top announcement bar, USD rate, and payment methods in real time
          </p>
        </div>

        <button
          type="button"
          onClick={fetchConfigs}
          className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer self-start sm:self-auto"
          title="Refresh Configs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
        </button>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 overflow-x-auto text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveSubTab('banner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'banner'
              ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Top Announcement Banner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('currency')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'currency'
              ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>USD/BDT Exchange &amp; VAT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('gateways')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'gateways'
              ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Gateways</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('hero')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'hero'
              ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Hero Headlines &amp; Copy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('lockdown')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSubTab === 'lockdown'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Emergency Lockdown</span>
        </button>
      </div>

      {/* Subtab 1: Top Announcement Banner */}
      {activeSubTab === 'banner' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
            <div>
              <strong className="text-sm text-slate-900 dark:text-white">Announcement Header Strip</strong>
              <p className="text-slate-400 text-[11px]">Displays at the very top of Navbar across all pages</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bannerConfig.enabled}
                onChange={(e) => setBannerConfig({ ...bannerConfig, enabled: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600"
              />
              <span className="font-bold">{bannerConfig.enabled ? 'ACTIVE ON SITE' : 'PAUSED'}</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 font-bold">English Badge:</label>
              <input
                type="text"
                value={bannerConfig.badge_en}
                onChange={(e) => setBannerConfig({ ...bannerConfig, badge_en: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Bengali Badge:</label>
              <input
                type="text"
                value={bannerConfig.badge_bn}
                onChange={(e) => setBannerConfig({ ...bannerConfig, badge_bn: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 font-bold">English Announcement Text:</label>
            <input
              type="text"
              value={bannerConfig.text_en}
              onChange={(e) => setBannerConfig({ ...bannerConfig, text_en: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 font-bold">Bengali Announcement Text:</label>
            <input
              type="text"
              value={bannerConfig.text_bn}
              onChange={(e) => setBannerConfig({ ...bannerConfig, text_bn: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Promo Coupon Code:</label>
              <input
                type="text"
                value={bannerConfig.promo_code}
                onChange={(e) => setBannerConfig({ ...bannerConfig, promo_code: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 uppercase font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Banner Destination URL:</label>
              <input
                type="text"
                value={bannerConfig.link_url}
                onChange={(e) => setBannerConfig({ ...bannerConfig, link_url: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig('announcement_banner', bannerConfig, 'Top Announcement Banner')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save Announcement Banner</span>
            </button>
          </div>
        </div>
      )}

      {/* Subtab 2: Currency & Exchange Rate */}
      {activeSubTab === 'currency' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5">
            <strong className="text-sm text-slate-900 dark:text-white">Currency Conversion &amp; VAT Settings</strong>
            <p className="text-slate-400 text-[11px]">Controls pricing calculations for international vs local payments</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 font-bold">USD to BDT Exchange Rate (৳):</label>
              <input
                type="number"
                value={currencyConfig.usd_exchange_rate_bdt}
                onChange={(e) => setCurrencyConfig({ ...currencyConfig, usd_exchange_rate_bdt: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-base font-bold text-blue-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">e.g. $10.00 Domain = ৳{(10 * currencyConfig.usd_exchange_rate_bdt).toLocaleString()} BDT</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 font-bold">Default Platform Currency:</label>
              <select
                value={currencyConfig.default_currency}
                onChange={(e) => setCurrencyConfig({ ...currencyConfig, default_currency: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              >
                <option value="BDT">BDT (Bangladeshi Taka ৳)</option>
                <option value="USD">USD (United States Dollar $)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 font-bold">VAT / Tax Percentage (%):</label>
              <input
                type="number"
                value={currencyConfig.vat_percent}
                onChange={(e) => setCurrencyConfig({ ...currencyConfig, vat_percent: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig('currency_settings', currencyConfig, 'Currency & FX Settings')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Update Exchange Rates</span>
            </button>
          </div>
        </div>
      )}

      {/* Subtab 3: Payment Gateways */}
      {activeSubTab === 'gateways' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5">
            <strong className="text-sm text-slate-900 dark:text-white">Active Payment Gateways &amp; Numbers</strong>
            <p className="text-slate-400 text-[11px]">Enable or disable payment options in Checkout Drawer</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* bKash Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <strong className="font-bold text-slate-900 dark:text-white">bKash Merchant Routing</strong>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gatewaysConfig.bkash_active}
                    onChange={(e) => setGatewaysConfig({ ...gatewaysConfig, bkash_active: e.target.checked })}
                    className="w-4 h-4 rounded text-pink-600"
                  />
                  <span className="text-[10px] font-bold">{gatewaysConfig.bkash_active ? 'ACTIVE' : 'DISABLED'}</span>
                </label>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Merchant Number / Label:</label>
                <input
                  type="text"
                  value={gatewaysConfig.bkash_merchant_label}
                  onChange={(e) => setGatewaysConfig({ ...gatewaysConfig, bkash_merchant_label: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>
            </div>

            {/* Nagad Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <strong className="font-bold text-slate-900 dark:text-white">Nagad Merchant Routing</strong>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gatewaysConfig.nagad_active}
                    onChange={(e) => setGatewaysConfig({ ...gatewaysConfig, nagad_active: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-600"
                  />
                  <span className="text-[10px] font-bold">{gatewaysConfig.nagad_active ? 'ACTIVE' : 'DISABLED'}</span>
                </label>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Merchant Number / Label:</label>
                <input
                  type="text"
                  value={gatewaysConfig.nagad_merchant_label}
                  onChange={(e) => setGatewaysConfig({ ...gatewaysConfig, nagad_merchant_label: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5">
            <div>
              <strong className="text-slate-800 dark:text-zinc-200">Manual TrxID Fallback Option</strong>
              <div className="text-[11px] text-slate-400">Allows clients to submit bKash/Nagad TrxID manually if instant gateway times out</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gatewaysConfig.manual_trxid_fallback}
                onChange={(e) => setGatewaysConfig({ ...gatewaysConfig, manual_trxid_fallback: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600"
              />
              <span className="font-bold">{gatewaysConfig.manual_trxid_fallback ? 'ENABLED' : 'OFF'}</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig('payment_gateways_config', gatewaysConfig, 'Payment Gateway Rules')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save Payment Gateways</span>
            </button>
          </div>
        </div>
      )}

      {/* Subtab 4: Hero Headlines & Copy */}
      {activeSubTab === 'hero' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5">
            <strong className="text-sm text-slate-900 dark:text-white">Hero Section Copy &amp; Badges</strong>
            <p className="text-slate-400 text-[11px]">Live headline and value proposition on the homepage</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Headline Line 1:</label>
              <input
                type="text"
                value={heroConfig.headline_line1}
                onChange={(e) => setHeroConfig({ ...heroConfig, headline_line1: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Headline Line 2 (Gradient Highlight):</label>
              <input
                type="text"
                value={heroConfig.headline_line2}
                onChange={(e) => setHeroConfig({ ...heroConfig, headline_line2: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 font-bold text-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 font-bold">Subheadline (English):</label>
            <textarea
              rows={2}
              value={heroConfig.subheadline_en}
              onChange={(e) => setHeroConfig({ ...heroConfig, subheadline_en: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 font-bold">Subheadline (Bengali):</label>
            <textarea
              rows={2}
              value={heroConfig.subheadline_bn}
              onChange={(e) => setHeroConfig({ ...heroConfig, subheadline_bn: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 font-bold">Starting Price Badge:</label>
              <input
                type="text"
                value={heroConfig.starting_price_badge}
                onChange={(e) => setHeroConfig({ ...heroConfig, starting_price_badge: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 font-bold text-emerald-600"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-bold">CTA Button Label:</label>
              <input
                type="text"
                value={heroConfig.cta_button_en}
                onChange={(e) => setHeroConfig({ ...heroConfig, cta_button_en: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig('hero_cms_content', heroConfig, 'Hero Headlines & Copy')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save Hero Content</span>
            </button>
          </div>
        </div>
      )}

      {/* Subtab 5: Emergency Security Lockdown */}
      {activeSubTab === 'lockdown' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-rose-200 dark:border-rose-900/40 shadow-xs space-y-4 font-mono text-xs">
          <div className="pb-3 border-b border-rose-100 dark:border-rose-900/20 flex items-center justify-between">
            <div>
              <strong className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Global Emergency Threat Lockdown Switches</span>
              </strong>
              <p className="text-slate-400 text-[11px]">Enforced directly at Cloudflare Edge before backend execution</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 dark:text-white">Cloudflare Under Attack Mode</strong>
                <p className="text-[11px] text-slate-400">Enforces challenge interstitials and aggressive rate limiting on all requests</p>
              </div>
              <input
                type="checkbox"
                checked={lockdownConfig.under_attack_mode}
                onChange={(e) => setLockdownConfig({ ...lockdownConfig, under_attack_mode: e.target.checked })}
                className="w-5 h-5 rounded text-rose-600 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 dark:text-white">Freeze All Affiliate &amp; Wallet Withdrawals</strong>
                <p className="text-[11px] text-slate-400">Instantly blocks all outbound bKash/Nagad payout approvals across all accounts</p>
              </div>
              <input
                type="checkbox"
                checked={lockdownConfig.freeze_all_withdrawals}
                onChange={(e) => setLockdownConfig({ ...lockdownConfig, freeze_all_withdrawals: e.target.checked })}
                className="w-5 h-5 rounded text-rose-600 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 dark:text-white">Block New Account Registrations</strong>
                <p className="text-[11px] text-slate-400">Rejects all new user signup requests at the Edge during active DDoS or bot attacks</p>
              </div>
              <input
                type="checkbox"
                checked={lockdownConfig.block_new_signups}
                onChange={(e) => setLockdownConfig({ ...lockdownConfig, block_new_signups: e.target.checked })}
                className="w-5 h-5 rounded text-rose-600 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <strong className="text-slate-900 dark:text-white">Full Maintenance Mode</strong>
                <p className="text-[11px] text-slate-400">Renders 503 Maintenance page to all public visitors (Founder Admin remains accessible)</p>
              </div>
              <input
                type="checkbox"
                checked={lockdownConfig.maintenance_mode}
                onChange={(e) => setLockdownConfig({ ...lockdownConfig, maintenance_mode: e.target.checked })}
                className="w-5 h-5 rounded text-rose-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig('security_lockdown', lockdownConfig, 'Emergency Security Lockdown')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Apply Emergency Lockdown (Sudo Verified)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
