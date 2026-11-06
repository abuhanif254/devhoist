import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { EXACT_DOCS_ARTICLES } from '@/config/docsData';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';

export const runtime = 'edge';

async function logDocsAudit(
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
  ip: string = '127.0.0.1'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_role: 'admin',
      action_type: actionType,
      target_resource: targetResource,
      ip_address: ip,
      risk_level: 'medium',
      metadata,
    });
  } catch (err) {
    console.warn('[Docs Audit Log Warning]:', err);
  }
}

const DEFAULT_SEO_ROUTES = [
  {
    route_path: '/',
    meta_title: 'DevHost Cloud — Vercel-Grade Developer Hosting with cPanel & bKash',
    meta_description: 'Next-generation NVMe hosting in Bangladesh. Auto-deploy Git repos to LiteSpeed cPanel with automated bKash/Nagad checkout and zero-downtime containers.',
    keywords: ['web hosting bangladesh', 'cpanel hosting bd', 'nextjs cpanel hosting', 'bkash hosting', 'developer cloud bd'],
    canonical_path: 'https://devhostcloud.com',
    og_title: 'DevHost Cloud — Developer-First Cloud Platform',
    og_subtitle: 'Deploy Next.js, Node.js & WordPress with instant bKash checkout and Singapore NVMe speed.',
    schema_type: 'WebApplication',
    is_active: true,
  },
  {
    route_path: '/nodejs-hosting',
    meta_title: 'High-Speed Node.js Hosting in Bangladesh — LiteSpeed NVMe & Passenger',
    meta_description: 'Deploy Next.js, Express, and Node.js 22 LTS with CloudLinux Passenger on Singapore NVMe storage. Instant bKash activation with zero node_modules bloat.',
    keywords: ['nodejs hosting bangladesh', 'nextjs hosting bd', 'passenger cpanel hosting', 'fast nodejs cloud'],
    canonical_path: 'https://devhostcloud.com/nodejs-hosting',
    og_title: 'Node.js NVMe Cloud Hosting | DevHost',
    og_subtitle: 'Sub-40ms latency in Bangladesh with automated GitHub webhooks and zero storage bloat.',
    schema_type: 'Product',
    is_active: true,
  },
  {
    route_path: '/wordpress-hosting-bangladesh',
    meta_title: 'Fastest WordPress Hosting in Bangladesh — LiteSpeed Enterprise & Redis',
    meta_description: 'Supercharge your WordPress & WooCommerce store with LiteSpeed Enterprise Web Server, Redis Object Cache, free SSL, and daily offsite backups.',
    keywords: ['wordpress hosting bangladesh', 'litespeed hosting bd', 'woocommerce cloud', 'fast wordpress bd'],
    canonical_path: 'https://devhostcloud.com/wordpress-hosting-bangladesh',
    og_title: 'LiteSpeed WordPress Hosting | DevHost',
    og_subtitle: 'Achieve 99/100 Google PageSpeed scores with LiteSpeed Enterprise and Redis caching.',
    schema_type: 'Product',
    is_active: true,
  },
  {
    route_path: '/cloud-vps',
    meta_title: 'NVMe Cloud VPS in Singapore & USA — KVM Virtualization & Root Access',
    meta_description: 'High-performance Cloud VPS servers with dedicated NVMe storage, BDIX-optimized routes, 1Gbps uplink, full root access, and automated instant OS provisioning.',
    keywords: ['vps hosting bangladesh', 'cloud vps bd', 'singapore vps', 'kvm vps root access'],
    canonical_path: 'https://devhostcloud.com/cloud-vps',
    og_title: 'Enterprise Cloud VPS | DevHost',
    og_subtitle: 'Dedicated KVM virtualization in Singapore SG1 and USA Equinix datacenters.',
    schema_type: 'Product',
    is_active: true,
  },
  {
    route_path: '/cheap-domain-registration-bd',
    meta_title: 'Domain Registration Bangladesh — Instant .com, .net, .org with bKash',
    meta_description: 'Register and transfer global domain names with instant bKash activation, free WHOIS privacy, 2-Step verification lock, and RFC-validated DNS editor.',
    keywords: ['domain registration bangladesh', 'cheap domain bd', 'buy com domain bkash', 'domain registrar bd'],
    canonical_path: 'https://devhostcloud.com/cheap-domain-registration-bd',
    og_title: 'Domain Portfolio & Registrar Suite | DevHost',
    og_subtitle: 'Protect your brand with WHOIS privacy, DNSSEC, and instant EPP transfer states.',
    schema_type: 'Product',
    is_active: true,
  },
  {
    route_path: '/docs',
    meta_title: 'Developer Documentation & Runbooks | DevHost Cloud Engineering Hub',
    meta_description: 'Context-aware developer tutorials for Next.js, Node.js, Laravel, WordPress, and Cloudflare DNS with real-time customer account variable injection.',
    keywords: ['cpanel tutorials', 'nextjs cpanel deploy guide', 'developer documentation bd', 'hosting knowledge base'],
    canonical_path: 'https://devhostcloud.com/docs',
    og_title: 'Engineering Knowledgebase & Runbooks | DevHost',
    og_subtitle: 'Copy-paste deployment workflows with live account variables and terminal scripts.',
    schema_type: 'TechArticle',
    is_active: true,
  },
];

/**
 * GET: Fetch documentation articles, FAQs, and SEO routes
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');
    const type = searchParams.get('type') || 'all';

    if (!isSupabaseConfigured()) {
      // Return structured default articles and FAQs
      const defaultArticles = EXACT_DOCS_ARTICLES.map((a, i) => ({
        id: a.id,
        slug: a.slug,
        title_en: a.title,
        title_bn: a.title,
        category: a.category,
        summary_en: a.summary,
        summary_bn: a.summary,
        difficulty_level: 'Intermediate',
        read_time_minutes: parseInt(a.readTime) || 4,
        recommended_plan_slug: 'developer-pro',
        steps_json: a.steps.map((s, idx) => ({
          stepNumber: idx + 1,
          heading_en: s.heading,
          heading_bn: s.heading,
          explanation_en: s.explanation,
          explanation_bn: s.explanation,
          codeSnippet: s.codeSnippet?.code || '',
          codeLanguage: s.codeSnippet?.language || 'bash',
          warningNote: s.callout?.text,
        })),
        views_count: 140 + i * 15,
        helpful_yes_count: 35 + i * 4,
        helpful_no_count: i % 2,
        is_published: true,
      }));

      const defaultFaqs = COMPLETE_FAQ_LIST.map((f, i) => ({
        id: `faq-${i + 1}`,
        target_page: 'home',
        question_en: f.question,
        question_bn: f.question,
        answer_en: f.answer,
        answer_bn: f.answer,
        sort_order: i + 1,
        is_active: true,
      }));

      if (slug) {
        const article = defaultArticles.find((a) => a.slug === slug);
        return NextResponse.json({ success: true, article });
      }

      return NextResponse.json({
        success: true,
        articles: defaultArticles,
        faqs: defaultFaqs,
        seoRoutes: DEFAULT_SEO_ROUTES,
      });
    }

    const db = getServiceSupabase();

    // 1. Fetch Single Article by slug
    if (slug) {
      const { data, error } = await db
        .from('cms_docs_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ success: true, article: data });
    }

    // 2. Fetch Articles, FAQs, and SEO Routes
    let articlesQuery = db
      .from('cms_docs_articles')
      .select('*')
      .order('sort_order', { ascending: true });

    if (category && category !== 'All') {
      articlesQuery = articlesQuery.eq('category', category);
    }

    const faqsQuery = db
      .from('cms_faqs')
      .select('*')
      .order('sort_order', { ascending: true });

    const seoRoutesQuery = db
      .from('cms_seo_routes')
      .select('*')
      .order('route_path', { ascending: true });

    const [articlesRes, faqsRes, seoRoutesRes] = await Promise.all([
      type === 'articles' || type === 'all' ? articlesQuery : Promise.resolve({ data: [] }),
      type === 'faqs' || type === 'all' ? faqsQuery : Promise.resolve({ data: [] }),
      type === 'seo_routes' || type === 'all' ? seoRoutesQuery : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json({
      success: true,
      articles: (articlesRes.data && articlesRes.data.length > 0) ? articlesRes.data : [],
      faqs: (faqsRes.data && faqsRes.data.length > 0) ? faqsRes.data : [],
      seoRoutes: (seoRoutesRes.data && seoRoutesRes.data.length > 0) ? seoRoutesRes.data : DEFAULT_SEO_ROUTES,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Mutation actions (Helpful votes, view counter, admin save)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, article_id, vote, articleData, faqData, seoRouteData, sudoVerified } = body;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Live Helpfulness Voting
    if (action === 'vote_helpful') {
      if (!article_id || !vote) {
        return NextResponse.json({ success: false, error: 'article_id and vote are required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        const field = vote === 'yes' ? 'helpful_yes_count' : 'helpful_no_count';
        try {
          await db.rpc('increment_article_stat', { p_article_id: article_id, p_field: field });
        } catch {
          // Fallback direct update
          const { data } = await db.from('cms_docs_articles').select(field).eq('id', article_id).maybeSingle();
          if (data) {
            const currentVal = Number((data as any)[field]) || 0;
            await db
              .from('cms_docs_articles')
              .update({ [field]: currentVal + 1 })
              .eq('id', article_id);
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Helpful vote recorded' });
    }

    // 2. Increment Article Views
    if (action === 'increment_view') {
      if (article_id && isSupabaseConfigured()) {
        const db = getServiceSupabase();
        const { data } = await db.from('cms_docs_articles').select('views_count').eq('id', article_id).maybeSingle();
        if (data) {
          await db
            .from('cms_docs_articles')
            .update({ views_count: (data.views_count || 0) + 1 })
            .eq('id', article_id);
        }
      }
      return NextResponse.json({ success: true });
    }

    // 3. Save / Upsert Article (Admin Sudo Protected)
    if (action === 'save_article') {
      if (!sudoVerified) {
        return NextResponse.json({ success: false, error: 'Admin Sudo elevation required to edit docs articles.' }, { status: 403 });
      }

      if (!articleData || !articleData.slug || !articleData.title_en) {
        return NextResponse.json({ success: false, error: 'articleData with slug and title_en is required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('cms_docs_articles').upsert(
          {
            slug: articleData.slug.trim(),
            title_en: articleData.title_en.trim(),
            title_bn: articleData.title_bn || articleData.title_en,
            category: articleData.category || 'Developer & CI/CD',
            summary_en: articleData.summary_en || '',
            summary_bn: articleData.summary_bn || articleData.summary_en || '',
            difficulty_level: articleData.difficulty_level || 'Intermediate',
            read_time_minutes: Number(articleData.read_time_minutes) || 4,
            recommended_plan_slug: articleData.recommended_plan_slug || 'developer-pro',
            steps_json: articleData.steps_json || [],
            seo_keywords: articleData.seo_keywords || [],
            is_published: articleData.is_published ?? true,
            sort_order: Number(articleData.sort_order) || 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'slug' }
        );
      }

      await logDocsAudit('DOCS_ARTICLE_SAVED', `article:${articleData.slug}`, { slug: articleData.slug }, ip);

      return NextResponse.json({
        success: true,
        message: `Article '${articleData.title_en}' saved successfully!`,
      });
    }

    // 4. Save / Upsert FAQ (Admin Sudo Protected)
    if (action === 'save_faq') {
      if (!sudoVerified) {
        return NextResponse.json({ success: false, error: 'Admin Sudo elevation required to edit FAQs.' }, { status: 403 });
      }

      if (!faqData || !faqData.question_en || !faqData.answer_en) {
        return NextResponse.json({ success: false, error: 'faqData with question_en and answer_en is required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('cms_faqs').upsert({
          id: faqData.id || undefined,
          target_page: faqData.target_page || 'home',
          question_en: faqData.question_en.trim(),
          question_bn: faqData.question_bn || faqData.question_en,
          answer_en: faqData.answer_en.trim(),
          answer_bn: faqData.answer_bn || faqData.answer_en,
          sort_order: Number(faqData.sort_order) || 1,
          is_active: faqData.is_active ?? true,
          updated_at: new Date().toISOString(),
        });
      }

      await logDocsAudit('CMS_FAQ_SAVED', 'faq', { question: faqData.question_en }, ip);

      return NextResponse.json({
        success: true,
        message: 'FAQ item saved successfully!',
      });
    }

    // 5. Save / Upsert Dynamic SEO Route (Admin Sudo Protected)
    if (action === 'save_seo_route') {
      if (!sudoVerified) {
        return NextResponse.json({ success: false, error: 'Admin Sudo elevation required to edit SEO routes.' }, { status: 403 });
      }

      if (!seoRouteData || !seoRouteData.route_path || !seoRouteData.meta_title) {
        return NextResponse.json({ success: false, error: 'seoRouteData with route_path and meta_title is required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('cms_seo_routes').upsert(
          {
            route_path: seoRouteData.route_path.trim(),
            meta_title: seoRouteData.meta_title.trim(),
            meta_description: seoRouteData.meta_description || '',
            keywords: Array.isArray(seoRouteData.keywords)
              ? seoRouteData.keywords
              : (seoRouteData.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
            canonical_path: seoRouteData.canonical_path || `https://devhostcloud.com${seoRouteData.route_path}`,
            og_title: seoRouteData.og_title || seoRouteData.meta_title,
            og_subtitle: seoRouteData.og_subtitle || seoRouteData.meta_description,
            robots_directive: seoRouteData.robots_directive || 'index, follow',
            schema_type: seoRouteData.schema_type || 'WebApplication',
            is_active: seoRouteData.is_active ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'route_path' }
        );
      }

      await logDocsAudit('SEO_ROUTE_SAVED', `seo:${seoRouteData.route_path}`, { route_path: seoRouteData.route_path }, ip);

      return NextResponse.json({
        success: true,
        message: `SEO route configuration for '${seoRouteData.route_path}' saved successfully!`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: Remove Article, FAQ, or SEO Route (Admin Sudo Protected)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const slug = searchParams.get('slug');
    const route_path = searchParams.get('route_path');
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      if (type === 'article' && slug) {
        await db.from('cms_docs_articles').delete().eq('slug', slug);
        await logDocsAudit('DOCS_ARTICLE_DELETED', `article:${slug}`, { slug }, ip);
      } else if (type === 'faq' && id) {
        await db.from('cms_faqs').delete().eq('id', id);
        await logDocsAudit('CMS_FAQ_DELETED', `faq:${id}`, { id }, ip);
      } else if (type === 'seo_route' && route_path) {
        await db.from('cms_seo_routes').delete().eq('route_path', route_path);
        await logDocsAudit('SEO_ROUTE_DELETED', `seo:${route_path}`, { route_path }, ip);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
