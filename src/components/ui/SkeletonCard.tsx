'use client';

import React from 'react';

interface SkeletonCardProps {
  heightClass?: string;
  className?: string;
  lines?: number;
}

export default function SkeletonCard({
  heightClass = 'h-64',
  className = '',
  lines = 3,
}: SkeletonCardProps) {
  return (
    <div
      className={`w-full rounded-xl border border-white/[0.08] bg-zinc-900/40 p-6 sm:p-8 flex flex-col justify-between animate-pulse ${heightClass} ${className}`}
      aria-busy="true"
      aria-label="Loading content..."
    >
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between">
          <div className="h-6 w-1/3 bg-zinc-800 rounded-md" />
          <div className="h-5 w-16 bg-zinc-800/80 rounded" />
        </div>
        <div className="space-y-2.5 pt-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3.5 bg-zinc-800/60 rounded"
              style={{ width: `${85 - i * 15}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-white/[0.04]">
        <div className="h-4 w-24 bg-zinc-800/70 rounded" />
        <div className="h-8 w-28 bg-zinc-800 rounded-md" />
      </div>
    </div>
  );
}
