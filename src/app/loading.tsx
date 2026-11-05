import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col justify-between transition-colors duration-200" aria-busy="true">
      {/* Top Edge Progress Bar Shimmer */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-zinc-900 z-50 overflow-hidden">
        <div className="h-full bg-blue-600 dark:bg-emerald-500 animate-pulse w-full [animation-duration:1s]" />
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-24 space-y-12">
        {/* Hero Skeleton Header */}
        <div className="max-w-3xl mx-auto text-center space-y-5 animate-pulse">
          <div className="h-6 w-48 bg-slate-200 dark:bg-zinc-850 rounded-full mx-auto" />
          <div className="h-12 w-3/4 bg-slate-200 dark:bg-zinc-800 rounded-lg mx-auto" />
          <div className="h-4 w-2/3 bg-slate-200 dark:bg-zinc-850 rounded mx-auto" />
        </div>

        {/* 3-Column Card Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/40 p-6 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="h-5 w-1/3 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-zinc-850 rounded" />
                <div className="h-8 w-1/2 bg-slate-200 dark:bg-zinc-800 rounded-md mt-4" />
              </div>
              <div className="h-10 w-full bg-slate-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
