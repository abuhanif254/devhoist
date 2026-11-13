'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface HomeSectionHeaderProps {
  variant: 'domain' | 'deploy';
}

/**
 * Bilingual section header wrapper preserving Server Component rendering on src/app/page.tsx.
 */
export default function HomeSectionHeader({ variant }: HomeSectionHeaderProps) {
  const { language, t } = useLanguage();
  const isBN = language === 'BN';

  if (variant === 'domain') {
    return (
      <div className="text-center max-w-xl mx-auto mb-6">
        <h3
          className={`text-xl sm:text-2xl font-bold text-slate-900 dark:text-white ${
            isBN ? 'font-bengali' : ''
          }`}
        >
          {t('domain_title')}
        </h3>
        <p
          className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed ${
            isBN ? 'font-bengali' : ''
          }`}
        >
          {t('domain_subtitle')}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center max-w-3xl mx-auto mb-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-3">
        <Zap className="w-3.5 h-3.5" />
        <span className={isBN ? 'font-bengali' : ''}>{t('deploy_badge')}</span>
      </div>
      <h2
        className={`text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white ${
          isBN ? 'font-bengali' : ''
        }`}
      >
        {t('deploy_title')}
      </h2>
      <p
        className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 max-w-2xl mx-auto leading-relaxed ${
          isBN ? 'font-bengali' : ''
        }`}
      >
        {t('deploy_subtitle')}
      </p>
    </div>
  );
}
