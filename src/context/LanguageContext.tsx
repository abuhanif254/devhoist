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
  hero_title_1: { en: 'Git Push to Production.', bn: 'গিট পুশেই প্রোডাকশন লাইভ।' },
  hero_title_2: { en: 'Zero Downtime.', bn: 'জিরো ডাউনটাইম ক্লাউড।' },
  hero_subtitle: {
    en: 'Say goodbye to tedious FTP uploads. Our Smart Pipeline combines GitHub Actions runners with cPanel NVMe storage, slashing disk bloat by 80% and reloading Passenger workers in 2.8s.',
    bn: 'ম্যানুয়াল এফটিপি আপলোডকে বিদায় জানান। আমাদের স্মার্ট পাইপলাইন গিটহাব অ্যাকশন্সের সাথে cPanel NVMe স্টোরেজ যুক্ত করে ৮০% ডিস্ক স্পেস বাঁচায় এবং ২.৮ সেকেন্ডে প্যাসেঞ্জার রিলোড করে।',
  },
  cta_deploy_pro: { en: 'Deploy Developer Pro', bn: 'ডেভ প্রোপ্যাকেজ ডেপ্লয়' },
  cta_explore_pipeline: { en: 'Explore Pipeline Flow', bn: 'পাইপলাইন ফ্লো দেখুন' },
  cta_instant_checkout: { en: 'Proceed to Instant Checkout', bn: 'ইনস্ট্যান্ট চেকআউট' },
  badge_save_20: { en: 'SAVE 20%', bn: '২০% ছাড়' },
  badge_money_back: { en: '30-Day Money-Back Guarantee', bn: '৩০ দিনের মানিব্যাক গ্যারান্টি' },
  badge_bd_optimized: { en: 'Singapore Equinix (~38ms BD)', bn: 'সিঙ্গাপুর ইকুইনিক্স (~৩৮মি.সে. বিডি)' },
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
