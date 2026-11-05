'use client';

import React, { useState } from 'react';
import { Wand2, Laptop, Globe } from 'lucide-react';

export default function SitejetPreview() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [businessName, setBusinessName] = useState('Dhaka Craft Bakery');
  const [industry, setIndustry] = useState('Artisan Pastries & Coffee Shop');
  const [tone, setTone] = useState('Modern, Warm & Friendly');

  return (
    <div className="w-full transition-colors duration-200">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 p-6 sm:p-8 shadow-sm glass-card relative overflow-hidden">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono mb-3 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Built-in Sitejet AI Engine</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            Publish a Professional Site with 3 Simple Prompts
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
            No coding, no hiring expensive agencies. Included 100% free with all cPanel plans.
          </p>
        </div>

        {/* Interactive Step Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Interactive 3-Prompt Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
                  Sitejet AI Prompt Assistant
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/5 font-semibold">
                  Step {activeStep} of 3
                </span>
              </div>

              {/* Prompt 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                  Prompt 1: What is your Business Name?
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden font-sans"
                />
              </div>

              {/* Prompt 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                  Prompt 2: What products or services do you offer?
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden font-sans"
                />
              </div>

              {/* Prompt 3 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                  Prompt 3: Brand Tone &amp; Aesthetic
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden font-sans"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep === 3 ? 1 : (activeStep + 1 as 1 | 2 | 3))}
                  className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{activeStep === 3 ? 'Regenerate Preview' : 'Generate Website Preview'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Simulated Live Website Preview */}
          <div className="lg:col-span-7 w-full">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-900 dark:bg-zinc-950 overflow-hidden shadow-xl">
              {/* Browser chrome header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 dark:bg-zinc-900/60 border-b border-slate-700 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[11px] font-mono text-slate-300 dark:text-zinc-400 ml-2">
                    https://{businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <Globe className="w-3 h-3" />
                  <span>SSL Active</span>
                </div>
              </div>

              {/* Preview screen content */}
              <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white space-y-5 min-h-[260px] flex flex-col justify-center">
                <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[11px] font-mono text-emerald-300 backdrop-blur-xs w-max">
                  {industry}
                </div>
                <h4 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  Welcome to {businessName}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed max-w-md">
                  Crafted with {tone.toLowerCase()} styling. Responsive on all devices with automated SEO meta tags and LiteSpeed caching enabled.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <span className="px-4 py-2 rounded-lg bg-blue-600 font-semibold text-xs text-white shadow-xs">
                    Explore Menu &amp; Catalog
                  </span>
                  <span className="px-4 py-2 rounded-lg bg-white/10 font-semibold text-xs text-white border border-white/20">
                    Order Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
