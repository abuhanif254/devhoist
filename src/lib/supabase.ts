import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase (with live production project fallback)
const LIVE_SUPABASE_URL = 'https://senlgfzhomodiyhnclfg.supabase.co';
const LIVE_SUPABASE_ANON_KEY = 'sb_publishable_6gzAgaJBxEW53W7hfUhA4Q_v1A3ZX_I';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || LIVE_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  LIVE_SUPABASE_ANON_KEY;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

// Detect if Supabase is actively configured with valid live credentials
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('placeholder') &&
    (supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('eyJ'))
  );
};

// Client-side / Public Supabase Client (Anon Key with RLS enforcement)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// Server-side Admin Supabase Client (Bypasses RLS for automated webhooks & WHM provisioning)
export const getServiceSupabase = (): SupabaseClient => {
  const serviceKey = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

// Database Entity Types matching supabase/schema.sql
export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  role: 'client' | 'admin';
  wallet_balance_bdt: number;
  affiliate_code?: string;
  referred_by?: string;
  created_at: string;
}

export interface DbHostingService {
  id: string;
  user_id: string;
  domain: string;
  plan_id: string;
  plan_name: string;
  whm_package_name: string;
  cpanel_username: string;
  server_node: 'sg1' | 'us1';
  ip_address: string;
  status: 'active' | 'suspended' | 'pending' | 'terminated';
  disk_limit_gb: number;
  disk_used_gb: number;
  ram_limit_mb: number;
  ram_used_mb: number;
  inode_limit: number;
  inode_used: number;
  git_repo_url?: string;
  git_branch?: string;
  auto_deploy?: boolean;
  php_version?: string;
  nodejs_version?: string;
  billing_cycle: 'monthly' | 'annually' | 'triennially';
  price_bdt: number;
  next_due_date: string;
  created_at: string;
}

export interface DbDomain {
  id: string;
  user_id: string;
  domain_name: string;
  tld: string;
  status: 'Active' | 'Expired' | 'Transferring' | 'Pending';
  registrar_lock: boolean;
  whois_privacy: boolean;
  auto_renew: boolean;
  nameservers: string[];
  dns_records: Array<{
    id: string;
    type: string;
    name: string;
    value: string;
    ttl: number;
    proxied?: boolean;
    priority?: number;
  }>;
  child_nameservers?: Array<{ hostname: string; ip: string }>;
  expiry_date: string;
  created_at: string;
}

export interface DbInvoice {
  id: string;
  invoice_number: string;
  user_id: string;
  items: Array<{
    description: string;
    cycle: string;
    amount: number;
  }>;
  subtotal_bdt: number;
  discount_bdt: number;
  total_bdt: number;
  status: 'unpaid' | 'paid' | 'refunded' | 'cancelled';
  payment_method?: string;
  trx_id?: string;
  due_date: string;
  paid_at?: string;
  created_at: string;
}
