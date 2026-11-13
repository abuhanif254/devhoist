'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'EN' | 'BN';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const TRANSLATIONS: Record<string, { en: string; bn: string }> = {
  // Navigation & Badges
  nav_hosting: { en: 'Hosting', bn: 'হোস্টিং' },
  nav_domains: { en: 'Domains & Tools', bn: 'ডোমেইন ও টুলস' },
  nav_migration: { en: 'Free Migration', bn: 'ফ্রি মাইগ্রেশন' },
  nav_status: { en: 'Server Status', bn: 'সার্ভার স্ট্যাটাস' },
  nav_docs: { en: 'Docs', bn: 'ডকুমেন্টেশন' },
  nav_deploy: { en: 'Deploy Now', bn: 'ডেপ্লয় করুন' },
  nav_sandbox: { en: 'Live Panel Demo', bn: 'লাইভ কন্ট্রোল প্যানেল' },
  nav_marketplace: { en: '1-Click Marketplace', bn: 'অ্যাপ মার্কেটপ্লেস' },
  nav_estimator: { en: 'Cost Estimator', bn: 'খরচ এস্টিমেটর' },

  // Hero & CTAs
  hero_badge: {
    en: '99.99% Verified Uptime SLA • Singapore & USA NVMe',
    bn: '৯৯.৯৯% ভেরিফাইড আপটাইম • সিঙ্গাপুর ও ইউএসএ NVMe',
  },
  hero_title_1: {
    en: 'Developer Experience of Vercel.',
    bn: 'ভার্সেল-এর মতো ডেভেলপার এক্সপেরিয়েন্স।',
  },
  hero_title_2: {
    en: 'Accessibility of cPanel.',
    bn: 'সাথে cPanel-এর সহজলভ্যতা।',
  },
  hero_subtitle: {
    en: 'Deploy Next.js, Node.js, Python, Docker & WordPress on R2 Edge or isolated NVMe containers. GitHub PR previews, direct ZIP upload, and instant bKash/Nagad checkout from ৳200/mo.',
    bn: 'Next.js, Node.js, Python, Docker ও WordPress ডেপ্লয় করুন R2 এজ বা আইসোলেটেড NVMe কন্টেইনারে। অটোমেটেড GitHub PR প্রিভিউ, সরাসরি ZIP আপলোড এবং বিকাশ/নগদ ইনস্ট্যান্ট পেমেন্ট ৳২০০/মাস থেকে।',
  },
  hero_cta_app: { en: 'Deploy Custom App', bn: 'কাস্টম অ্যাপ ডেপ্লয় করুন' },
  hero_cta_wp: { en: 'Launch WordPress', bn: 'ওয়ার্ডপ্রেস শুরু করুন' },
  cta_deploy_pro: { en: 'Deploy Developer Pro', bn: 'ডেভ প্রো ডেপ্লয় করুন' },
  cta_explore_pipeline: { en: 'Explore Pipeline Flow', bn: 'পাইপলাইন ফ্লো দেখুন' },
  cta_instant_checkout: { en: 'Proceed to Instant Checkout', bn: 'ইনস্ট্যান্ট চেকআউট' },
  badge_save_20: { en: 'SAVE 20%', bn: '২০% ছাড়' },
  badge_money_back: { en: '30-Day Money-Back SLA', bn: '৩০ দিনের মানিব্যাক গ্যারান্টি' },
  badge_bd_optimized: { en: 'Singapore Equinix (~38ms BD)', bn: 'সিঙ্গাপুর ইকুইনিক্স (~৩৮মি.সে. বিডি)' },
  domain_title: {
    en: 'Find & Secure Your Domain in Seconds',
    bn: 'কয়েক সেকেন্ডেই আপনার পারফেক্ট ডোমেইন খুঁজুন',
  },
  domain_subtitle: {
    en: 'Live DNS availability across .com, .xyz, .io, and .ai with instant free-domain annual bundle savings.',
    bn: '.com, .xyz, .io ও .ai ডোমেইনের লাইভ অ্যাভেইলেবিলিটি চেক করুন এবং বাৎসরিক প্ল্যানে ফ্রি ডোমেইন বুঝে নিন।',
  },
  deploy_badge: {
    en: 'Unified Hybrid Control Plane',
    bn: 'হাইব্রিড কন্ট্রোল প্লেন আর্কিটেকচার',
  },
  deploy_title: {
    en: 'Three Ways to Ship Live in Seconds',
    bn: 'মুহূর্তেই প্রোডাকশনে ডেপ্লয় করার ৩টি আধুনিক মাধ্যম',
  },
  deploy_subtitle: {
    en: 'Ship static apps to Cloudflare R2 Edge, run Node/Python/Docker builds, or launch LiteSpeed WordPress — managed in one native portal.',
    bn: 'Cloudflare R2 এজ, আইসোলেটেড কন্টেইনার বা LiteSpeed ওয়ার্ডপ্রেস—সবকিছু এক পোর্টাল থেকেই সম্পূর্ণ অটোমেটেড।',
  },
  pricing_badge: { en: 'Transparent Pricing Matrix', bn: 'স্বচ্ছ ও ফিক্সড প্রাইসিং' },
  pricing_title_1: { en: 'Predictable Power.', bn: 'নির্ভেজাল পারফরম্যান্স।' },
  pricing_title_2: { en: 'Zero Hidden Traps.', bn: 'রিনিউয়ালেও কোনো লুকানো চার্জ নেই।' },
  closing_title: {
    en: 'Ready to Ship Faster with Local & Global Speed?',
    bn: 'দ্রুতগতির ক্লাউড ও বিকাশ/নগদ অটোমেশনে আজই শুরু করুন',
  },
  closing_subtitle: {
    en: 'Deploy a new stack in 60 seconds, request free zero-downtime migration, or earn 30% recurring commission as a partner.',
    bn: '৬০ সেকেন্ডে নতুন অ্যাপ চালু করুন, সম্পূর্ণ ফ্রিতে পুরনো সাইট মাইগ্রেট করুন অথবা ৩০% রিকারিং অ্যাফিলিয়েট কমিশন আয় করুন।',
  },
  payout_notice: {
    en: 'Automated bKash & Nagad instant merchant checkout with zero transaction fees.',
    bn: 'বিকাশ ও নগদে সরাসরি ০% অতিরিক্ত ফি ছাড়াই তাৎক্ষণিক অটো-অ্যাক্টিভেশন।',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('EN');

  useEffect(() => {
    const saved = localStorage.getItem('devhost-lang') as Language | null;
    if (saved && (saved === 'EN' || saved === 'BN')) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('devhost-lang', lang);
  };

  const toggleLanguage = () => {
    const next = language === 'EN' ? 'BN' : 'EN';
    handleSetLanguage(next);
  };

  const t = (key: string): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return language === 'BN' ? entry.bn : entry.en;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
