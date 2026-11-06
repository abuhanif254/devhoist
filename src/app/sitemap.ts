import { MetadataRoute } from 'next';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { EXACT_DOCS_ARTICLES } from '@/config/docsData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://devhostcloud.com';
  const currentDate = new Date();

  const coreRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: currentDate, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/nodejs-hosting`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/wordpress-hosting-bangladesh`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/cloud-vps`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/cheap-domain-registration-bd`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/marketplace`, lastModified: currentDate, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/github-deploy-hosting`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/docs`, lastModified: currentDate, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/estimator`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/compare`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/free-migration`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/server-status`, lastModified: currentDate, changeFrequency: 'always', priority: 0.8 },
    { url: `${baseUrl}/panel-preview`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/security`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/partners`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/enterprise`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/terms`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/refund-policy`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Fetch all published documentation runbooks dynamically
  let docsArticles = EXACT_DOCS_ARTICLES.map((a) => ({
    slug: a.slug,
    updated_at: currentDate.toISOString(),
  }));

  if (isSupabaseConfigured()) {
    try {
      const db = getServiceSupabase();
      const { data } = await db
        .from('cms_docs_articles')
        .select('slug, updated_at')
        .eq('is_published', true);

      if (data && data.length > 0) {
        docsArticles = data;
      }
    } catch (err) {
      console.warn('[Sitemap] Failed to fetch docs articles:', err);
    }
  }

  const docsRoutes: MetadataRoute.Sitemap = docsArticles.map((art) => ({
    url: `${baseUrl}/docs?article=${encodeURIComponent(art.slug)}`,
    lastModified: art.updated_at ? new Date(art.updated_at) : currentDate,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...coreRoutes, ...docsRoutes];
}
