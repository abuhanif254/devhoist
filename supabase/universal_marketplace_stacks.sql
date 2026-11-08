-- =============================================================================
-- UNIVERSAL MULTI-STACK DEPLOYMENT ENGINE & INTERNATIONAL APP MARKETPLACE
-- 16 Production Stack Blueprints with Authentic Server Bridges & CI/CD Pipelines
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalog_marketplace_stacks (
    slug text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL CHECK (category IN (
        'Full-Stack JS & Vue',
        'PHP, Laravel & CMS',
        'API, Python & WebSockets',
        'AI, Automation & Monitors'
    )),
    tagline_en text NOT NULL,
    tagline_bn text NOT NULL,
    runtime_family text NOT NULL CHECK (runtime_family IN (
        'nodejs_passenger',
        'php_litespeed',
        'python_wsgi_asgi',
        'static_edge',
        'docker_kvm_vps'
    )),
    default_runtime_version text NOT NULL,
    root_directory text NOT NULL DEFAULT '/',
    document_root_subpath text NOT NULL DEFAULT '/public',
    install_command text NOT NULL DEFAULT 'npm ci --production=false',
    build_command text NOT NULL DEFAULT 'npm run build',
    startup_entry_file text NOT NULL DEFAULT 'server.js',
    requires_database text NOT NULL DEFAULT 'none' CHECK (requires_database IN (
        'none',
        'mysql_8',
        'postgresql_16',
        'sqlite_volume'
    )),
    requires_redis boolean NOT NULL DEFAULT false,
    requires_websocket_proxy boolean NOT NULL DEFAULT false,
    persistent_volume_paths text[] NOT NULL DEFAULT '{}'::text[],
    min_ram_mb int NOT NULL DEFAULT 1024,
    min_cpu_cores int NOT NULL DEFAULT 1,
    min_storage_gb int NOT NULL DEFAULT 2,
    recommended_plan_slug text NOT NULL DEFAULT 'developer-pro' CHECK (recommended_plan_slug IN (
        'starter-pack',
        'developer-pro',
        'business-max',
        'cloud-kvm-1'
    )),
    default_env_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
    github_workflow_yaml text NOT NULL,
    server_bridge_script text NOT NULL DEFAULT '',
    popularity_installs int NOT NULL DEFAULT 1200,
    is_featured boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_marketplace_stacks_category
    ON public.catalog_marketplace_stacks(category, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_marketplace_stacks_active
    ON public.catalog_marketplace_stacks(is_active, sort_order);

ALTER TABLE public.catalog_marketplace_stacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active marketplace stacks" ON public.catalog_marketplace_stacks;
CREATE POLICY "Public can view active marketplace stacks"
    ON public.catalog_marketplace_stacks
    FOR SELECT
    USING (is_active = true OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins can manage marketplace stacks" ON public.catalog_marketplace_stacks;
CREATE POLICY "Admins can manage marketplace stacks"
    ON public.catalog_marketplace_stacks
    FOR ALL
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- =============================================================================
-- SEED ALL 16 PRODUCTION STACK BLUEPRINTS
-- =============================================================================

INSERT INTO public.catalog_marketplace_stacks (
    slug, name, category, tagline_en, tagline_bn, runtime_family, default_runtime_version,
    root_directory, document_root_subpath, install_command, build_command, startup_entry_file,
    requires_database, requires_redis, requires_websocket_proxy, persistent_volume_paths,
    min_ram_mb, min_cpu_cores, min_storage_gb, recommended_plan_slug,
    default_env_schema, github_workflow_yaml, server_bridge_script,
    popularity_installs, is_featured, is_active, sort_order
) VALUES
(
    'nextjs-15-standalone',
    'Next.js 15/16 App Router (Standalone SSR)',
    'Full-Stack JS & Vue',
    'Production App Router SSR with standalone trace bundling (82% lower RAM & 90% fewer inodes on CloudLinux Passenger).',
    'স্ট্যান্ডঅ্যালোন SSR এবং ন্যূনতম মেমরি খরচে Next.js 15/16 অ্যাপ রাউটার প্রোডাকশন ডিপ্লয়মেন্ট।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/.next/standalone/public',
    'npm ci --production=false',
    'npm run build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/',
    '.next/standalone/server.js',
    'postgresql_16',
    false,
    false,
    ARRAY['/.next/cache', '/public/uploads'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"HOSTNAME","value":"0.0.0.0","isSecret":false,"generator":"static"},
      {"key":"NEXTAUTH_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"NEXTAUTH_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"}
    ]'::jsonb,
    'name: Deploy Next.js 15 Standalone to DevHost Cloud
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Copy Static Assets into Standalone Bundle
        run: |
          cp -r public .next/standalone/public
          cp -r .next/static .next/standalone/.next/static
      - name: Rsync Standalone Artifact & Zero-Downtime Passenger Restart
        run: |
          rsync -avz --delete .next/standalone/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "mkdir -p ~/app/tmp && touch ~/app/tmp/restart.txt"',
    '# CloudLinux Phusion Passenger Node.js Bridge (.htaccess)
PassengerEnabled on
PassengerAppRoot /home/${CPANEL_USER}/app
PassengerAppType node
PassengerStartupFile .next/standalone/server.js
PassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node',
    5420,
    true,
    true,
    1
),
(
    'vue-nuxt3-ssr',
    'Vue.js 3 + Nuxt 3 Universal SSR (Nitro Engine)',
    'Full-Stack JS & Vue',
    'High-speed Vue 3 & Nuxt 3 Nitro server engine with zero-dependency .output/server/index.mjs execution.',
    'Vue 3 এবং Nuxt 3 Nitro ইঞ্জিনের আল্ট্রা-ফাস্ট ইউনিভার্সাল SSR ডিপ্লয়মেন্ট।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/.output/public',
    'npm ci --production=false',
    'npx nuxi build',
    '.output/server/index.mjs',
    'postgresql_16',
    false,
    false,
    ARRAY['/.output/public/uploads'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"NITRO_PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"NITRO_HOST","value":"0.0.0.0","isSecret":false,"generator":"static"},
      {"key":"NUXT_SESSION_PASSWORD","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"NUXT_PUBLIC_SITE_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"}
    ]'::jsonb,
    'name: Deploy Vue 3 / Nuxt 3 Nitro SSR
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx nuxi build
      - name: Sync Nitro .output Bundle & Restart Passenger
        run: |
          rsync -avz --delete .output/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/.output/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "mkdir -p ~/app/tmp && touch ~/app/tmp/restart.txt"',
    '# Nitro Universal SSR Entry Bridge (server.cjs -> .output/server/index.mjs)
PassengerEnabled on
PassengerAppType node
PassengerStartupFile .output/server/index.mjs
PassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node',
    3190,
    true,
    true,
    2
),
(
    'laravel-11-saas',
    'Laravel 11 SaaS Boilerplate (Octane + Queue + MySQL 8)',
    'PHP, Laravel & CMS',
    'Enterprise Laravel 11 stack with automated composer optimization, artisan migrations, storage symlink, and 1-minute scheduler cron.',
    'অটোমেটেড ডাটাবেস মাইগ্রেশন, কিউ ওয়ার্কার এবং ক্রন শিডিউলারসহ Laravel 11 SaaS স্ট্যাক।',
    'php_litespeed',
    'PHP 8.3 (OPcache + JIT)',
    '/',
    '/public',
    'composer install --no-dev --optimize-autoloader',
    'php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan migrate --force',
    'public/index.php',
    'mysql_8',
    true,
    false,
    ARRAY['/storage/app/public', '/storage/logs'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"APP_NAME","value":"DevHostLaravelSaaS","isSecret":false,"generator":"static"},
      {"key":"APP_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"APP_DEBUG","value":"false","isSecret":false,"generator":"static"},
      {"key":"APP_KEY","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"APP_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"DB_CONNECTION","value":"mysql","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"CACHE_STORE","value":"redis","isSecret":false,"generator":"static"},
      {"key":"QUEUE_CONNECTION","value":"database","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Deploy Laravel 11 SaaS to LiteSpeed Enterprise
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.3"
      - run: composer install --no-dev --prefer-dist --optimize-autoloader
      - run: npm ci && npm run build
      - name: Deploy & Run Artisan Zero-Downtime Hooks
        run: |
          rsync -avz --exclude=".env" --exclude="storage" ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && php artisan storage:link && php artisan migrate --force && php artisan optimize"',
    '# Laravel 11 Scheduler & Queue Worker Cron + LiteSpeed Rewrite
# Cron: * * * * * cd /home/${CPANEL_USER}/app && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
<IfModule LiteSpeed>
  CacheLookup on
</IfModule>
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/public/
RewriteRule ^(.*)$ public/$1 [L]',
    4890,
    true,
    true,
    3
),
(
    'wordpress-woocommerce-turbo',
    'WordPress 6.7 + WooCommerce Turbo (LSCache + Redis)',
    'PHP, Laravel & CMS',
    'Pre-hardened eCommerce & publishing stack with LiteSpeed Enterprise Page Cache, Redis Object Cache, and bKash/Nagad checkout readiness.',
    'LSCache, Redis অবজেক্ট ক্যাশ এবং ই-কমার্স অপ্টিমাইজেশনসহ সুপার-ফাস্ট ওয়ার্ডপ্রেস ও উকমার্স।',
    'php_litespeed',
    'PHP 8.3 (LSCache + Redis)',
    '/',
    '/',
    'wp core download --skip-content',
    'wp plugin install litespeed-cache woocommerce redis-cache --activate && wp redis enable',
    'index.php',
    'mysql_8',
    true,
    false,
    ARRAY['/wp-content/uploads', '/wp-content/cache'],
    1024,
    1,
    2,
    'starter-pack',
    '[
      {"key":"WP_HOME","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"WP_SITEURL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"AUTH_KEY","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"SECURE_AUTH_KEY","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"WP_REDIS_DISABLED","value":"false","isSecret":false,"generator":"static"},
      {"key":"WP_MEMORY_LIMIT","value":"512M","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Deploy Custom WordPress Theme & Plugins
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync wp-content & Flush LiteSpeed Cache
        run: |
          rsync -avz wp-content/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/public_html/wp-content/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/public_html && wp litespeed-purge all && wp cache flush"',
    '# LiteSpeed Enterprise LSCache + XML-RPC Brute-Force Block (.htaccess)
<IfModule LiteSpeed>
  CacheLookup on
  RewriteEngine On
  RewriteCond %{REQUEST_METHOD} ^HEAD|GET$
  RewriteRule .* - [E=Cache-Control:max-age=3600]
</IfModule>
<Files xmlrpc.php>
  Order Deny,Allow
  Deny from all
</Files>',
    8450,
    true,
    true,
    4
),
(
    'nestjs-prisma-api',
    'NestJS 11 + Prisma ORM Microservice API',
    'API, Python & WebSockets',
    'Enterprise TypeScript backend with automated npx prisma generate, zero-downtime schema migrations, and Swagger OpenAPI docs.',
    'অটোমেটেড Prisma মাইগ্রেশন এবং টাইপস্ক্রিপ্ট আর্কিটেকচারসহ NestJS এন্টারপ্রাইজ API স্ট্যাক।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/public',
    'npm ci --production=false',
    'npx prisma generate && npx prisma migrate deploy && npm run build',
    'dist/main.js',
    'postgresql_16',
    true,
    true,
    ARRAY['/uploads'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"JWT_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"CORS_ORIGIN","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"}
    ]'::jsonb,
    'name: Deploy NestJS + Prisma API
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
      - name: Deploy Dist & Run Prisma Migrations
        run: |
          rsync -avz dist/ prisma/ package*.json ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && npx prisma migrate deploy && mkdir -p tmp && touch tmp/restart.txt"',
    '# NestJS Passenger Startup & WebSocket Upgrade Proxy
PassengerEnabled on
PassengerAppType node
PassengerStartupFile dist/main.js
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*) ws://127.0.0.1:3000/$1 [P,L]',
    3640,
    true,
    true,
    5
),
(
    'strapi-headless-cms',
    'Strapi v5 Headless CMS (REST + GraphQL)',
    'Full-Stack JS & Vue',
    'Production-ready Strapi v5 Headless CMS with auto-generated cryptographic APP_KEYS, JWT tokens, and persistent media storage.',
    'অটো-জেনারেটেড সিকিউরিটি কী এবং REST/GraphQL এন্ডপয়েন্টসহ Strapi v5 হেডলেস CMS।',
    'nodejs_passenger',
    'Node.js 20 LTS',
    '/',
    '/public',
    'npm ci --production=false',
    'NODE_ENV=production npm run build',
    'server.js',
    'mysql_8',
    false,
    false,
    ARRAY['/public/uploads'],
    4096,
    2,
    10,
    'business-max',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"HOST","value":"0.0.0.0","isSecret":false,"generator":"static"},
      {"key":"PORT","value":"1337","isSecret":false,"generator":"static"},
      {"key":"APP_KEYS","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"API_TOKEN_SALT","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"ADMIN_JWT_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"TRANSFER_TOKEN_SALT","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"JWT_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"}
    ]'::jsonb,
    'name: Build & Deploy Strapi v5 Headless CMS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: NODE_ENV=production npm run build
      - name: Sync Build & Preserve /public/uploads
        run: |
          rsync -avz --exclude="public/uploads" ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "mkdir -p ~/app/tmp && touch ~/app/tmp/restart.txt"',
    '// Strapi v5 Production Entry File (server.js)
const strapi = require("@strapi/strapi");
strapi.createStrapi({ distDir: "./dist" }).start();',
    2480,
    false,
    true,
    6
),
(
    'ghost-publishing',
    'Ghost v5 Pro Publishing & Newsletter Platform',
    'Full-Stack JS & Vue',
    'Ultra-fast Node.js publication, membership, and paid newsletter engine backed by MySQL 8 and Cloudflare CDN caching.',
    'মেম্বারশিপ, পেইড নিউজলেটার এবং আল্ট্রা-ফাস্ট ব্লগিংয়ের জন্য Ghost v5 পাবলিশিং প্ল্যাটফর্ম।',
    'nodejs_passenger',
    'Node.js 20 LTS',
    '/',
    '/content/files',
    'npm ci --production',
    'npx knex-migrator init',
    'current/index.js',
    'mysql_8',
    false,
    false,
    ARRAY['/content/images', '/content/files', '/content/themes'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"url","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"database__client","value":"mysql2","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"mail__transport","value":"SMTP","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Deploy Custom Ghost v5 Theme
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync Theme & Restart Ghost Instance
        run: |
          rsync -avz ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/content/themes/custom-theme/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "mkdir -p ~/app/tmp && touch ~/app/tmp/restart.txt"',
    '# Ghost v5 Passenger Node Bridge
PassengerEnabled on
PassengerAppType node
PassengerStartupFile current/index.js
PassengerNodejs /opt/alt/alt-nodejs20/root/usr/bin/node',
    1920,
    false,
    true,
    7
),
(
    'fastapi-django-python',
    'Python FastAPI / Django 5 (WSGI / ASGI Bridge)',
    'API, Python & WebSockets',
    'Production Python 3.12 virtualenv stack with automatic a2wsgi ASGI-to-WSGI bridge for FastAPI and Django 5 + PostgreSQL 16.',
    'Python 3.12, অটোমেটিক ASGI-to-WSGI ব্রিজ এবং PostgreSQL 16 সহ FastAPI ও Django 5 স্ট্যাক।',
    'python_wsgi_asgi',
    'Python 3.12 (ASGI/WSGI)',
    '/',
    '/static',
    'pip install --upgrade pip && pip install -r requirements.txt a2wsgi',
    'python manage.py collectstatic --noinput || true',
    'passenger_wsgi.py',
    'postgresql_16',
    true,
    false,
    ARRAY['/media', '/static'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"PYTHONUNBUFFERED","value":"1","isSecret":false,"generator":"static"},
      {"key":"SECRET_KEY","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"DEBUG","value":"False","isSecret":false,"generator":"static"},
      {"key":"ALLOWED_HOSTS","value":"*","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"}
    ]'::jsonb,
    'name: Deploy Python FastAPI / Django to CloudLinux Python Selector
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync Python App & Install Requirements in Virtualenv
        run: |
          rsync -avz --exclude="venv" ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "source ~/virtualenv/app/3.12/bin/activate && cd ~/app && pip install -r requirements.txt a2wsgi && mkdir -p tmp && touch tmp/restart.txt"',
    '# Auto-Generated passenger_wsgi.py (Supports both FastAPI ASGI & Django WSGI)
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

try:
    # FastAPI / Starlette ASGI-to-WSGI Bridge
    from a2wsgi import ASGIMiddleware
    from main import app as fastapi_app
    application = ASGIMiddleware(fastapi_app)
except ImportError:
    # Django 5 Standard WSGI Fallback
    from django.core.wsgi import get_wsgi_application
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    application = get_wsgi_application()',
    3410,
    true,
    true,
    8
),
(
    'express-realtime-websocket',
    'Express.js + Socket.io Real-Time WebSocket Engine',
    'API, Python & WebSockets',
    'Low-latency Node.js event server with pre-configured LiteSpeed WebSocket Proxy (RewriteRule [P,L]) for live chat, gaming, and telemetry.',
    'লাইভ চ্যাট, নোটিফিকেশন এবং রিয়েল-টাইম ডেটার জন্য Express.js ও Socket.io WebSocket সার্ভার।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/public',
    'npm ci --production',
    'npm run build --if-present',
    'src/server.js',
    'postgresql_16',
    true,
    true,
    ARRAY['/uploads'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"WS_PING_INTERVAL","value":"25000","isSecret":false,"generator":"static"},
      {"key":"JWT_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"CORS_ORIGIN","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"}
    ]'::jsonb,
    'name: Deploy Express + Socket.io Real-Time Server
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          rsync -avz --exclude="node_modules" ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && npm ci --production && mkdir -p tmp && touch tmp/restart.txt"',
    '# LiteSpeed Enterprise WebSocket Upgrade Tunnel (.htaccess)
RewriteEngine On
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteCond %{HTTP:Connection} upgrade [NC]
RewriteRule ^/?(.*) "ws://127.0.0.1:3000/$1" [P,L]
PassengerEnabled on
PassengerStartupFile src/server.js',
    2790,
    false,
    true,
    9
),
(
    'sitejet-ai-corporate',
    'Sitejet AI Website Builder (Zero-Code Edge Static)',
    'PHP, Laravel & CMS',
    'AI-assisted drag-and-drop corporate & agency website builder with sub-15ms BDIX delivery and zero database attack surface.',
    'কোনো কোডিং ছাড়াই এআই-চালিত ড্র্যাগ-অ্যান্ড-ড্রপ কর্পোরেট ওয়েবসাইট বিল্ডার।',
    'static_edge',
    'Static HTML5 / PHP 8.3 Forms',
    '/',
    '/public_html',
    'echo "Zero dependency static bundle"',
    'echo "Sitejet AI static compile complete"',
    'index.html',
    'none',
    false,
    false,
    ARRAY['/assets/media'],
    1024,
    1,
    2,
    'starter-pack',
    '[
      {"key":"SITE_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"CONTACT_FORM_TOKEN","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"}
    ]'::jsonb,
    'name: Deploy Static Edge Bundle
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: rsync -avz --delete ./ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/public_html/',
    '# Ultra-Fast Brotli + Immutable Asset Caching (.htaccess)
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
</IfModule>',
    4120,
    false,
    true,
    10
),
(
    'uptime-kuma-monitor',
    'Uptime Kuma Self-Hosted SLA & Status Page Engine',
    'AI, Automation & Monitors',
    'Self-hosted status page and multi-protocol monitoring suite (HTTP/s, TCP, DNS, Docker, SSL expiry alerts via Telegram & Slack).',
    'Telegram ও Slack অ্যালার্টসহ সেলফ-হোস্টেড সার্ভার মনিটরিং এবং পাবলিক স্ট্যাটাস পেজ।',
    'nodejs_passenger',
    'Node.js 20 LTS',
    '/',
    '/dist',
    'npm ci --production',
    'npm run download-dist',
    'server/server.js',
    'sqlite_volume',
    false,
    true,
    ARRAY['/data'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"UPTIME_KUMA_PORT","value":"3001","isSecret":false,"generator":"static"},
      {"key":"DATA_DIR","value":"./data/","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Update Uptime Kuma Instance
on:
  workflow_dispatch:
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Pull Latest Release & Restart Monitor
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && git fetch --all && npm ci --production && npm run download-dist && touch tmp/restart.txt"',
    '# Uptime Kuma WebSocket & SQLite Persistent Volume Bridge
RewriteEngine On
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteRule ^/?(.*) "ws://127.0.0.1:3001/$1" [P,L]
PassengerEnabled on
PassengerStartupFile server/server.js',
    2850,
    true,
    true,
    11
),
(
    'n8n-workflow-automation',
    'n8n AI Workflow & Webhook Automation Studio',
    'AI, Automation & Monitors',
    'Fair-code AI agent & workflow automation platform (400+ integrations, OpenAI/Claude chains, webhook triggers, PostgreSQL persistence).',
    '৪০০+ ইন্টিগ্রেশন এবং AI এজেন্ট ওয়ার্কফ্লো অটোমেশনের জন্য সেলফ-হোস্টেড n8n স্টুডিও।',
    'docker_kvm_vps',
    'Node.js 20 / Docker KVM',
    '/',
    '/public',
    'npm install -g n8n',
    'n8n db:migration:run',
    'node_modules/n8n/bin/n8n',
    'postgresql_16',
    true,
    true,
    ARRAY['/.n8n'],
    4096,
    2,
    10,
    'business-max',
    '[
      {"key":"N8N_ENCRYPTION_KEY","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"N8N_HOST","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"WEBHOOK_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"DB_TYPE","value":"postgresdb","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"EXECUTIONS_MODE","value":"regular","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Backup & Sync n8n Workflows
on:
  push:
    branches: [main]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          rsync -avz workflows/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/workflows/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "n8n import:workflow --separate --input=~/app/workflows/"',
    '# n8n Webhook & SSE Tunnel Configuration
RewriteEngine On
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteRule ^/?(.*) "ws://127.0.0.1:5678/$1" [P,L]
ProxyPass / http://127.0.0.1:5678/
ProxyPassReverse / http://127.0.0.1:5678/',
    3310,
    true,
    true,
    12
),
(
    'astro-mdx-blog',
    'Astro 5 Content Islands + MDX (Zero-JS Edge Speed)',
    'Full-Stack JS & Vue',
    '100/100 Lighthouse performance content & documentation stack with Astro 5 Server Islands and optional Node.js SSR adapter.',
    '১০০/১০০ লাইটহাউস পারফরম্যান্স এবং আল্ট্রা-ফাস্ট ব্লগ ও ডকুমেন্টেশনের জন্য Astro 5 + MDX স্ট্যাক।',
    'static_edge',
    'Node.js 22 Build -> Static/Hybrid',
    '/',
    '/dist',
    'npm ci --production=false',
    'npm run build',
    'dist/server/entry.mjs',
    'none',
    false,
    false,
    ARRAY['/public/images'],
    1024,
    1,
    2,
    'starter-pack',
    '[
      {"key":"PUBLIC_SITE_URL","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"}
    ]'::jsonb,
    'name: Build & Deploy Astro 5 Bundle
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci && npm run build
      - run: rsync -avz --delete dist/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/public_html/',
    '# Astro 5 Clean URLs & Immutable Asset Headers (.htaccess)
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+)$ $1.html [L,QSA]',
    2240,
    false,
    true,
    13
),
(
    'sveltekit-fullstack',
    'SvelteKit 2 Full-Stack SSR (@sveltejs/adapter-node)',
    'Full-Stack JS & Vue',
    'Compiled, surgical DOM reactivity with Svelte 5 Runes and @sveltejs/adapter-node running at sub-50MB RAM footprint.',
    'মাত্র ৫০MB RAM খরচে সুপার-ফাস্ট Svelte 5 এবং SvelteKit 2 ফুল-স্ট্যাক SSR।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/build/client',
    'npm ci --production=false',
    'npm run build',
    'build/index.js',
    'postgresql_16',
    false,
    false,
    ARRAY['/uploads'],
    1024,
    1,
    2,
    'starter-pack',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"ORIGIN","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"AUTH_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"}
    ]'::jsonb,
    'name: Deploy SvelteKit 2 Adapter-Node
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci && npm run build
      - run: |
          rsync -avz build/ package*.json ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && npm ci --omit=dev && mkdir -p tmp && touch tmp/restart.txt"',
    '# SvelteKit adapter-node Passenger Bridge
PassengerEnabled on
PassengerAppType node
PassengerStartupFile build/index.js
PassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node',
    1870,
    false,
    true,
    14
),
(
    'remix-react-router',
    'Remix / React Router v7 Full-Stack SSR',
    'Full-Stack JS & Vue',
    'Web-standard nested routing, parallel loader data fetching, and progressive enhancement on Node.js 22 LTS + PostgreSQL.',
    'নেস্টেড রাউটিং এবং প্যারালাল ডেটা লোডিংসহ Remix / React Router v7 ফুল-স্ট্যাক স্ট্যাক।',
    'nodejs_passenger',
    'Node.js 22 LTS',
    '/',
    '/build/client',
    'npm ci --production=false',
    'npm run build',
    'server.js',
    'postgresql_16',
    false,
    false,
    ARRAY['/public/uploads'],
    2048,
    2,
    5,
    'developer-pro',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"PORT","value":"3000","isSecret":false,"generator":"static"},
      {"key":"SESSION_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"}
    ]'::jsonb,
    'name: Deploy Remix / React Router v7
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci && npm run build
      - run: |
          rsync -avz build/ package*.json server.js ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && npm ci --omit=dev && mkdir -p tmp && touch tmp/restart.txt"',
    '# Remix Express Server Bridge
PassengerEnabled on
PassengerAppType node
PassengerStartupFile server.js
PassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node',
    1640,
    false,
    true,
    15
),
(
    'medusa-headless-commerce',
    'MedusaJS v2 / Directus Headless Commerce & Data Engine',
    'API, Python & WebSockets',
    'Composable multi-currency headless commerce & instant SQL-to-REST/GraphQL data studio powered by PostgreSQL 16 & Redis.',
    'মাল্টি-কারেন্সি হেডলেস ই-কমার্স এবং ইনস্ট্যান্ট SQL-to-API ইঞ্জিনের জন্য MedusaJS v2 / Directus স্ট্যাক।',
    'nodejs_passenger',
    'Node.js 20 LTS',
    '/',
    '/.medusa/server/public',
    'npm ci --production=false',
    'npx medusa build && npx medusa db:migrate',
    '.medusa/server/index.js',
    'postgresql_16',
    true,
    false,
    ARRAY['/uploads'],
    4096,
    2,
    10,
    'business-max',
    '[
      {"key":"NODE_ENV","value":"production","isSecret":false,"generator":"static"},
      {"key":"JWT_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"COOKIE_SECRET","value":"auto_secret_32","isSecret":true,"generator":"auto_secret_32"},
      {"key":"DATABASE_URL","value":"auto_database_url","isSecret":true,"generator":"auto_database_url"},
      {"key":"STORE_CORS","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"},
      {"key":"ADMIN_CORS","value":"auto_site_url","isSecret":false,"generator":"auto_site_url"}
    ]'::jsonb,
    'name: Deploy MedusaJS v2 Headless Commerce
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci && npx medusa build
      - run: |
          rsync -avz .medusa/server/ ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:~/app/
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "cd ~/app && npx medusa db:migrate && mkdir -p tmp && touch tmp/restart.txt"',
    '# MedusaJS v2 Production Passenger Bridge
PassengerEnabled on
PassengerAppType node
PassengerStartupFile .medusa/server/index.js
PassengerNodejs /opt/alt/alt-nodejs20/root/usr/bin/node',
    1780,
    false,
    true,
    16
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    tagline_en = EXCLUDED.tagline_en,
    tagline_bn = EXCLUDED.tagline_bn,
    runtime_family = EXCLUDED.runtime_family,
    default_runtime_version = EXCLUDED.default_runtime_version,
    root_directory = EXCLUDED.root_directory,
    document_root_subpath = EXCLUDED.document_root_subpath,
    install_command = EXCLUDED.install_command,
    build_command = EXCLUDED.build_command,
    startup_entry_file = EXCLUDED.startup_entry_file,
    requires_database = EXCLUDED.requires_database,
    requires_redis = EXCLUDED.requires_redis,
    requires_websocket_proxy = EXCLUDED.requires_websocket_proxy,
    persistent_volume_paths = EXCLUDED.persistent_volume_paths,
    min_ram_mb = EXCLUDED.min_ram_mb,
    min_cpu_cores = EXCLUDED.min_cpu_cores,
    min_storage_gb = EXCLUDED.min_storage_gb,
    recommended_plan_slug = EXCLUDED.recommended_plan_slug,
    default_env_schema = EXCLUDED.default_env_schema,
    github_workflow_yaml = EXCLUDED.github_workflow_yaml,
    server_bridge_script = EXCLUDED.server_bridge_script,
    popularity_installs = EXCLUDED.popularity_installs,
    is_featured = EXCLUDED.is_featured,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
