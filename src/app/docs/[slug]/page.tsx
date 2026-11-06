import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DocsViewer from '@/components/docs/DocsViewer';
import { Loader2 } from 'lucide-react';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { EXACT_DOCS_ARTICLES } from '@/config/docsData';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let title = 'Developer Runbook & Tutorial | DevHost Cloud';
  let description =
    'Step-by-step developer guide with real-time cPanel account variables and Jailed SSH commands.';

  const fallback = EXACT_DOCS_ARTICLES.find((a) => a.slug === slug);
  if (fallback) {
    title = `${fallback.title} | DevHost Cloud Engineering Hub`;
    description = fallback.summary;
  }

  if (isSupabaseConfigured()) {
    try {
      const db = getServiceSupabase();
      const { data } = await db
        .from('cms_docs_articles')
        .select('title_en, summary_en')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        title = `${data.title_en} | DevHost Cloud Engineering Hub`;
        description = data.summary_en || description;
      }
    } catch {}
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://devhostcloud.com/docs/${slug}`,
      siteName: 'DevHost Cloud',
    },
    alternates: {
      canonical: `https://devhostcloud.com/docs/${slug}`,
    },
  };
}

export default async function DynamicArticlePage({ params }: Props) {
  const { slug } = await params;

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
                <span>Loading Developer Runbook...</span>
              </div>
            }
          >
            <DocsViewer initialSlug={slug} />
          </Suspense>
        </div>
      </main>

      <Footer />
    </>
  );
}
