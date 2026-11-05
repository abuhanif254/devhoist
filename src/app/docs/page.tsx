import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DocsViewer from '@/components/docs/DocsViewer';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation & Tutorials | DevHost Cloud Developer Guides',
  description:
    'Comprehensive guides for Next.js, Node.js, and WordPress deployment on cPanel. Setup automated GitHub webhooks, Jailed SSH, and prevent Inode exhaustion.',
  openGraph: {
    title: 'Developer Documentation & Tutorials | DevHost Cloud',
    description:
      'Step-by-step guides for zero-downtime GitHub Actions deployments, CloudLinux Node.js tuning, and LiteSpeed cache optimization.',
    url: 'https://devhostcloud.com/docs',
  },
  alternates: {
    canonical: 'https://devhostcloud.com/docs',
  },
};

export default function DocsPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-12 sm:py-16 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-slate-600 dark:text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-zinc-300 mr-2" />
                <span>Loading Developer Documentation...</span>
              </div>
            }
          >
            <DocsViewer />
          </Suspense>
        </div>
      </main>

      <Footer />
    </>
  );
}
