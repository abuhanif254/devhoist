/**
 * GitHub OAuth Integration, AES-256-GCM Token Vault, Repository/Branch API Client,
 * Automatic Webhook Manager & Ephemeral PR Preview Helpers.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { timingSafeEqualStr } from '@/lib/authGuard';
import {
  decryptEnvValue,
  encryptEnvValue,
  getMaskedPreview,
} from '@/lib/projectEngine';
import {
  getServiceSupabase,
  isDevSandboxMode,
  isSupabaseConfigured,
} from '@/lib/supabase';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_OAUTH_NONCE_COOKIE = 'devhost_github_oauth_nonce';
const REPO_FULL_NAME_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,38})\/[a-zA-Z0-9._-]{1,100}$/;

export interface GitHubOAuthStateClaims {
  v: 1;
  purpose: 'github_oauth_state';
  userId: string;
  serviceId: string;
  returnTo: string;
  nonce: string;
  expMs: number;
}

export interface GitHubViewerProfile {
  id: number;
  login: string;
  avatarUrl: string | null;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  updatedAt: string;
}

export interface GitHubBranchSummary {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface StoredGitHubAccount {
  id: string;
  userId: string;
  githubUserId: number;
  githubLogin: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  scopes: string | null;
  updatedAt: string;
}

export interface ServiceGitConnectionRecord {
  id: string;
  service_id: string;
  user_id: string;
  github_account_id: string | null;
  provider: 'github';
  repo_id: number | null;
  repo_full_name: string;
  repo_html_url: string;
  clone_url: string;
  default_branch: string;
  selected_branch: string;
  is_private: boolean;
  auto_deploy_on_push: boolean;
  pr_previews_enabled: boolean;
  webhook_id: number | null;
  webhook_url: string | null;
  webhook_secret_encrypted?: string | null;
  last_commit_sha?: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = 'GITHUB_API_ERROR') {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.code = code;
  }
}

const sandboxGitHubAccounts = new Map<string, StoredGitHubAccount>();
const sandboxGitConnections = new Map<string, ServiceGitConnectionRecord>();

export function getCanonicalSiteUrl(requestOrigin?: string): string {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.DEVHOST_CONTROL_PLANE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (configured) return configured;

  const fallback = (requestOrigin || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(fallback)) {
    return fallback;
  }
  return 'http://localhost:3000';
}

export function getGitHubOAuthConfig(requestOrigin?: string): {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
} {
  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
  const baseOrigin = getCanonicalSiteUrl(requestOrigin);

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri: `${baseOrigin}/api/integrations/github/callback`,
    scopes: 'repo read:user admin:repo_hook',
  };
}

export function isGitHubOAuthConfigured(): boolean {
  return getGitHubOAuthConfig().configured;
}

function getOAuthStateSigningSecret(): string | null {
  const secret = (
    process.env.DEVHOST_SUDO_HMAC_SECRET ||
    process.env.DEVHOST_UPLOAD_SECRET ||
    process.env.DEVHOST_COMPUTE_AGENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (secret) return secret;
  if (isDevSandboxMode()) return 'devhost-sandbox-github-oauth-state-secret';
  return null;
}

export function sanitizeReturnToPath(rawPath?: string | null): string {
  const val = String(rawPath || '/dashboard').trim();
  if (/^\/(?!\/)[a-zA-Z0-9/_?=&%-]*$/.test(val) && !val.includes('..') && !val.includes('\\')) {
    return val;
  }
  return '/dashboard';
}

export function validateRepoFullName(rawRepo: string): string | null {
  const clean = String(rawRepo || '').trim().replace(/\.git$/i, '');
  if (!clean || clean.includes('..') || clean.includes('\\')) return null;
  if (!REPO_FULL_NAME_REGEX.test(clean)) return null;
  return clean;
}

export function buildGitHubAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string;
}): string {
  const url = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scopes);
  url.searchParams.set('state', params.state);
  return url.toString();
}

export function signGitHubOAuthState(params: {
  userId: string;
  serviceId?: string;
  returnTo?: string;
  nonce?: string;
  ttlMs?: number;
}): string | null {
  const secret = getOAuthStateSigningSecret();
  if (!secret) return null;

  const claims: GitHubOAuthStateClaims = {
    v: 1,
    purpose: 'github_oauth_state',
    userId: params.userId,
    serviceId: (params.serviceId || '').trim(),
    returnTo: sanitizeReturnToPath(params.returnTo),
    nonce: params.nonce || randomBytes(16).toString('hex'),
    expMs: Date.now() + Math.max(60_000, Math.min(params.ttlMs ?? 10 * 60_000, 30 * 60_000)),
  };

  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sigHex = createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${sigHex}`;
}

export function verifyGitHubOAuthState(stateToken: string): GitHubOAuthStateClaims | null {
  const secret = getOAuthStateSigningSecret();
  if (!secret || !stateToken || typeof stateToken !== 'string') return null;

  const parts = stateToken.trim().split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !sigHex) return null;

  const expectedSigHex = createHmac('sha256', secret).update(payloadB64).digest('hex');
  if (!timingSafeEqualStr(sigHex.toLowerCase(), expectedSigHex.toLowerCase())) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as GitHubOAuthStateClaims;
    if (
      !parsed ||
      parsed.v !== 1 ||
      parsed.purpose !== 'github_oauth_state' ||
      !parsed.userId ||
      typeof parsed.expMs !== 'number' ||
      Date.now() > parsed.expMs
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildIsolatedPreviewTarget(params: {
  serviceId: string;
  domain: string;
  prNumber: number;
  branchName: string;
}): {
  previewSiteKey: string;
  previewSlug: string;
  previewHostname: string;
  previewUrl: string;
} {
  const slugBranch = String(params.branchName || 'staging')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  const serviceShort = params.serviceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'app';
  const previewSlug = `pr-${params.prNumber}-${slugBranch || 'preview'}-${serviceShort}`;
  const cleanSiteId = params.serviceId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const previewSiteKey = `${cleanSiteId}--pr-${params.prNumber}`;

  const wildcardHost = (
    process.env.DEVHOST_PREVIEW_BASE_DOMAIN ||
    process.env.EDGE_SITES_WILDCARD_DOMAIN ||
    ''
  )
    .trim()
    .replace(/^\*\./, '')
    .replace(/^\./, '')
    .replace(/\/+$/, '');

  const edgeOrigin = (process.env.EDGE_SITES_ORIGIN || '').trim().replace(/\/+$/, '');

  if (wildcardHost) {
    const host = `${previewSlug}.${wildcardHost}`;
    return {
      previewSiteKey,
      previewSlug,
      previewHostname: host,
      previewUrl: `https://${host}`,
    };
  }

  if (edgeOrigin) {
    const host = `${previewSlug}.${params.domain}`;
    return {
      previewSiteKey,
      previewSlug,
      previewHostname: host,
      previewUrl: `${edgeOrigin}/api/edge-site?site=${encodeURIComponent(previewSiteKey)}`,
    };
  }

  const host = `${previewSlug}.${params.domain}`;
  return {
    previewSiteKey,
    previewSlug,
    previewHostname: host,
    previewUrl: `https://${host}`,
  };
}

async function githubApiFetch<T>(
  pathOrUrl: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GITHUB_API_BASE}${pathOrUrl}`;
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'DevHost-Cloud-ControlPlane/1.0');
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `GitHub API returned HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) msg = parsed.message;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new GitHubApiError(
      msg,
      res.status,
      res.status === 401 ? 'GITHUB_TOKEN_REVOKED' : 'GITHUB_API_ERROR'
    );
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export async function exchangeGitHubOAuthCode(params: {
  code: string;
  redirectUri: string;
  requestOrigin?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  scopes: string | null;
  expiresAt: string | null;
}> {
  if (isDevSandboxMode() && !isGitHubOAuthConfigured() && params.code.startsWith('sandbox_')) {
    return {
      accessToken: `gho_sandbox_${params.code.slice(0, 16)}`,
      refreshToken: null,
      scopes: 'repo,read:user,admin:repo_hook',
      expiresAt: null,
    };
  }

  const cfg = getGitHubOAuthConfig(params.requestOrigin);
  if (!cfg.configured) {
    throw new GitHubApiError('GitHub OAuth application credentials are not configured.', 503, 'SERVICE_UNAVAILABLE');
  }

  const res = await fetch(GITHUB_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'DevHost-Cloud-ControlPlane/1.0',
    },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
    signal: AbortSignal.timeout(12000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new GitHubApiError(
      data.error_description || data.error || 'GitHub OAuth token exchange failed.',
      400,
      'GITHUB_OAUTH_EXCHANGE_FAILED'
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    scopes: data.scope || null,
    expiresAt:
      typeof data.expires_in === 'number'
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
  };
}

export async function fetchGitHubViewer(accessToken: string): Promise<GitHubViewerProfile> {
  if (isDevSandboxMode() && accessToken.startsWith('gho_sandbox_')) {
    return { id: 900100, login: 'devhost-sandbox-user', avatarUrl: null };
  }
  const raw = await githubApiFetch<{
    id: number;
    login: string;
    avatar_url?: string;
  }>('/user', accessToken);
  return {
    id: Number(raw.id),
    login: String(raw.login),
    avatarUrl: raw.avatar_url || null,
  };
}

export async function listGitHubRepositories(
  accessToken: string,
  options?: { page?: number; query?: string }
): Promise<GitHubRepoSummary[]> {
  if (isDevSandboxMode() && accessToken.startsWith('gho_sandbox_')) {
    return [
      {
        id: 1001,
        name: 'my-nextjs-app',
        fullName: 'devhost-sandbox-user/my-nextjs-app',
        private: true,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/devhost-sandbox-user/my-nextjs-app',
        cloneUrl: 'https://github.com/devhost-sandbox-user/my-nextjs-app.git',
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  const page = Math.max(1, Number(options?.page || 1));
  const rawList = await githubApiFetch<
    Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      html_url: string;
      clone_url: string;
      updated_at: string;
    }>
  >(
    `/user/repos?sort=updated&per_page=50&page=${page}&affiliation=owner,collaborator,organization_member`,
    accessToken
  );

  const q = String(options?.query || '').trim().toLowerCase();
  const mapped: GitHubRepoSummary[] = rawList.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    fullName: String(r.full_name),
    private: Boolean(r.private),
    defaultBranch: String(r.default_branch || 'main'),
    htmlUrl: String(r.html_url),
    cloneUrl: String(r.clone_url),
    updatedAt: String(r.updated_at || new Date().toISOString()),
  }));

  return q
    ? mapped.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      )
    : mapped;
}

export async function fetchGitHubRepositoryDetails(
  accessToken: string,
  repoFullName: string
): Promise<GitHubRepoSummary> {
  const safeRepo = validateRepoFullName(repoFullName);
  if (!safeRepo) {
    throw new GitHubApiError('Invalid GitHub repository name (expected owner/repo).', 400, 'INVALID_REPO');
  }

  const raw = await githubApiFetch<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    clone_url: string;
    updated_at: string;
  }>(`/repos/${safeRepo}`, accessToken);

  return {
    id: Number(raw.id),
    name: String(raw.name),
    fullName: String(raw.full_name),
    private: Boolean(raw.private),
    defaultBranch: String(raw.default_branch || 'main'),
    htmlUrl: String(raw.html_url),
    cloneUrl: String(raw.clone_url),
    updatedAt: String(raw.updated_at || new Date().toISOString()),
  };
}

export async function listGitHubRepoBranches(
  accessToken: string,
  repoFullName: string
): Promise<GitHubBranchSummary[]> {
  const safeRepo = validateRepoFullName(repoFullName);
  if (!safeRepo) {
    throw new GitHubApiError('Invalid GitHub repository name.', 400, 'INVALID_REPO');
  }

  const raw = await githubApiFetch<
    Array<{
      name: string;
      protected?: boolean;
      commit?: { sha?: string };
    }>
  >(`/repos/${safeRepo}/branches?per_page=50`, accessToken);

  return raw.map((b) => ({
    name: String(b.name),
    commitSha: String(b.commit?.sha || '').slice(0, 12),
    protected: Boolean(b.protected),
  }));
}

export async function upsertGitHubRepoWebhook(params: {
  accessToken: string;
  repoFullName: string;
  webhookUrl: string;
  webhookSecret: string;
}): Promise<{ webhookId: number }> {
  const safeRepo = validateRepoFullName(params.repoFullName);
  if (!safeRepo) {
    throw new GitHubApiError('Invalid GitHub repository name.', 400, 'INVALID_REPO');
  }

  const existingHooks = await githubApiFetch<
    Array<{ id: number; config?: { url?: string } }>
  >(`/repos/${safeRepo}/hooks?per_page=100`, params.accessToken).catch(() => []);

  const matched = existingHooks.find(
    (h) => String(h.config?.url || '').replace(/\/+$/, '') === params.webhookUrl.replace(/\/+$/, '')
  );

  const hookBody = {
    name: 'web',
    active: true,
    events: ['push', 'pull_request'],
    config: {
      url: params.webhookUrl,
      content_type: 'json',
      secret: params.webhookSecret,
      insecure_ssl: '0',
    },
  };

  if (matched?.id) {
    const updated = await githubApiFetch<{ id: number }>(
      `/repos/${safeRepo}/hooks/${matched.id}`,
      params.accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify(hookBody),
      }
    );
    return { webhookId: Number(updated.id || matched.id) };
  }

  const created = await githubApiFetch<{ id: number }>(
    `/repos/${safeRepo}/hooks`,
    params.accessToken,
    {
      method: 'POST',
      body: JSON.stringify(hookBody),
    }
  );
  return { webhookId: Number(created.id) };
}

export async function deleteGitHubRepoWebhook(params: {
  accessToken: string;
  repoFullName: string;
  webhookId: number;
}): Promise<boolean> {
  const safeRepo = validateRepoFullName(params.repoFullName);
  if (!safeRepo || !params.webhookId) return false;
  try {
    await githubApiFetch(
      `/repos/${safeRepo}/hooks/${params.webhookId}`,
      params.accessToken,
      { method: 'DELETE' }
    );
    return true;
  } catch {
    return false;
  }
}

export async function upsertGitHubPrComment(params: {
  accessToken: string;
  repoFullName: string;
  prNumber: number;
  markerTag: string;
  bodyMarkdown: string;
}): Promise<{ commentId: number | null }> {
  const safeRepo = validateRepoFullName(params.repoFullName);
  if (!safeRepo || !params.prNumber) return { commentId: null };

  const markedBody = `<!-- ${params.markerTag} -->\n${params.bodyMarkdown}`;
  try {
    const comments = await githubApiFetch<Array<{ id: number; body?: string }>>(
      `/repos/${safeRepo}/issues/${params.prNumber}/comments?per_page=50`,
      params.accessToken
    );
    const existing = comments.find((c) => (c.body || '').includes(`<!-- ${params.markerTag} -->`));

    if (existing?.id) {
      const updated = await githubApiFetch<{ id: number }>(
        `/repos/${safeRepo}/issues/comments/${existing.id}`,
        params.accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ body: markedBody }),
        }
      );
      return { commentId: Number(updated.id || existing.id) };
    }

    const created = await githubApiFetch<{ id: number }>(
      `/repos/${safeRepo}/issues/${params.prNumber}/comments`,
      params.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ body: markedBody }),
      }
    );
    return { commentId: Number(created.id) };
  } catch {
    return { commentId: null };
  }
}

export async function downloadGitHubZipball(params: {
  accessToken?: string | null;
  repoFullName: string;
  ref: string;
}): Promise<Uint8Array | null> {
  const safeRepo = validateRepoFullName(params.repoFullName);
  if (!safeRepo) return null;
  const safeRef = String(params.ref || 'main').replace(/[^a-zA-Z0-9._/-]/g, '');
  if (!safeRef) return null;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DevHost-Cloud-ControlPlane/1.0',
  };
  if (params.accessToken) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  }

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${safeRepo}/zipball/${encodeURIComponent(safeRef)}`, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return ab.byteLength > 0 ? new Uint8Array(ab) : null;
  } catch {
    return null;
  }
}

export async function saveUserGitHubAccount(params: {
  userId: string;
  githubUserId: number;
  githubLogin: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  scopes: string | null;
  expiresAt: string | null;
}): Promise<StoredGitHubAccount> {
  const now = new Date().toISOString();
  const accessTokenEncrypted = await encryptEnvValue(params.accessToken);
  const refreshTokenEncrypted = params.refreshToken
    ? await encryptEnvValue(params.refreshToken)
    : null;

  let accountId = `ghacc_${params.githubUserId}`;
  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('github_oauth_accounts')
      .upsert(
        {
          user_id: params.userId,
          github_user_id: params.githubUserId,
          github_login: params.githubLogin,
          avatar_url: params.avatarUrl,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: params.expiresAt,
          scopes: params.scopes,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();

    if (error && !isDevSandboxMode()) {
      throw new Error(`Failed to persist GitHub OAuth account: ${error.message}`);
    }
    if (data?.id) {
      accountId = String(data.id);
    }
  }

  const stored: StoredGitHubAccount = {
    id: accountId,
    userId: params.userId,
    githubUserId: params.githubUserId,
    githubLogin: params.githubLogin,
    avatarUrl: params.avatarUrl,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    scopes: params.scopes,
    updatedAt: now,
  };
  sandboxGitHubAccounts.set(params.userId, stored);
  return stored;
}

export async function getUserGitHubAccount(userId: string): Promise<StoredGitHubAccount | null> {
  if (!userId) return null;

  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('github_oauth_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      const row = data as Record<string, unknown>;
      let decrypted = '';
      try {
        decrypted = await decryptEnvValue(String(row.access_token_encrypted || ''));
      } catch {
        return null;
      }
      if (!decrypted || decrypted === '••••••••••••') {
        return null;
      }
      let decryptedRefresh: string | null = null;
      if (row.refresh_token_encrypted) {
        try {
          decryptedRefresh = await decryptEnvValue(String(row.refresh_token_encrypted));
        } catch {
          decryptedRefresh = null;
        }
      }
      return {
        id: String(row.id),
        userId: String(row.user_id),
        githubUserId: Number(row.github_user_id),
        githubLogin: String(row.github_login),
        avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
        accessToken: decrypted,
        refreshToken:
          decryptedRefresh && decryptedRefresh !== '••••••••••••' ? decryptedRefresh : null,
        scopes: row.scopes ? String(row.scopes) : null,
        updatedAt: String(row.updated_at || new Date().toISOString()),
      };
    }
  }

  if (isDevSandboxMode()) {
    return sandboxGitHubAccounts.get(userId) || null;
  }
  return null;
}

export async function getServiceGitConnection(
  serviceId: string
): Promise<ServiceGitConnectionRecord | null> {
  if (!serviceId) return null;

  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('project_git_connections')
      .select('*')
      .eq('service_id', serviceId)
      .maybeSingle();
    if (!error && data) {
      return data as ServiceGitConnectionRecord;
    }
  }

  if (isDevSandboxMode()) {
    return sandboxGitConnections.get(serviceId) || null;
  }
  return null;
}

export async function resolveServiceWebhookSecret(serviceId: string): Promise<string | null> {
  const conn = await getServiceGitConnection(serviceId);
  if (conn?.webhook_secret_encrypted) {
    try {
      const decrypted = await decryptEnvValue(conn.webhook_secret_encrypted);
      if (decrypted && decrypted !== '••••••••••••') {
        return decrypted;
      }
    } catch {
      // Ignore unreadable ciphertext and fall through
    }
  }

  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    const { data } = await db
      .from('hosting_project_settings')
      .select('webhook_secret_token')
      .eq('service_id', serviceId)
      .maybeSingle();
    const legacy = (data as { webhook_secret_token?: string | null } | null)?.webhook_secret_token;
    if (legacy && typeof legacy === 'string' && !legacy.includes('••••')) {
      return legacy;
    }
  }

  return null;
}

export async function upsertServiceGitConnection(params: {
  serviceId: string;
  userId: string;
  githubAccountId: string | null;
  repoId: number | null;
  repoFullName: string;
  repoHtmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  selectedBranch: string;
  isPrivate: boolean;
  autoDeployOnPush: boolean;
  prPreviewsEnabled: boolean;
  webhookId: number | null;
  webhookUrl: string;
  webhookSecret: string;
}): Promise<{ connection: ServiceGitConnectionRecord; webhookSecretPreview: string }> {
  const now = new Date().toISOString();
  const webhookSecretEncrypted = await encryptEnvValue(params.webhookSecret);
  const maskedSecret = getMaskedPreview(params.webhookSecret);

  let recId = `gitconn_${params.serviceId}`;
  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('project_git_connections')
      .upsert(
        {
          service_id: params.serviceId,
          user_id: params.userId,
          github_account_id: params.githubAccountId,
          provider: 'github',
          repo_id: params.repoId,
          repo_full_name: params.repoFullName,
          repo_html_url: params.repoHtmlUrl,
          clone_url: params.cloneUrl,
          default_branch: params.defaultBranch,
          selected_branch: params.selectedBranch,
          is_private: params.isPrivate,
          auto_deploy_on_push: params.autoDeployOnPush,
          pr_previews_enabled: params.prPreviewsEnabled,
          webhook_id: params.webhookId,
          webhook_url: params.webhookUrl,
          webhook_secret_encrypted: webhookSecretEncrypted,
          last_synced_at: now,
          updated_at: now,
        },
        { onConflict: 'service_id' }
      )
      .select('*')
      .single();

    if (error && !isDevSandboxMode()) {
      throw new Error(`Failed to persist repository binding: ${error.message}`);
    }
    if (data?.id) {
      recId = String(data.id);
    }

    await db
      .from('hosting_project_settings')
      .upsert(
        {
          service_id: params.serviceId,
          user_id: params.userId,
          git_repo_url: params.repoHtmlUrl,
          production_branch: params.selectedBranch,
          auto_deploy_on_push: params.autoDeployOnPush,
          webhook_secret_token: maskedSecret,
          updated_at: now,
        },
        { onConflict: 'service_id' }
      );
  }

  const connection: ServiceGitConnectionRecord = {
    id: recId,
    service_id: params.serviceId,
    user_id: params.userId,
    github_account_id: params.githubAccountId,
    provider: 'github',
    repo_id: params.repoId,
    repo_full_name: params.repoFullName,
    repo_html_url: params.repoHtmlUrl,
    clone_url: params.cloneUrl,
    default_branch: params.defaultBranch,
    selected_branch: params.selectedBranch,
    is_private: params.isPrivate,
    auto_deploy_on_push: params.autoDeployOnPush,
    pr_previews_enabled: params.prPreviewsEnabled,
    webhook_id: params.webhookId,
    webhook_url: params.webhookUrl,
    webhook_secret_encrypted: webhookSecretEncrypted,
    last_synced_at: now,
    created_at: now,
    updated_at: now,
  };
  sandboxGitConnections.set(params.serviceId, connection);

  return { connection, webhookSecretPreview: maskedSecret };
}

export async function removeServiceGitConnection(serviceId: string): Promise<void> {
  sandboxGitConnections.delete(serviceId);
  if (isSupabaseConfigured()) {
    const db = getServiceSupabase();
    await db.from('project_git_connections').delete().eq('service_id', serviceId);
    await db
      .from('hosting_project_settings')
      .update({
        git_repo_url: '',
        updated_at: new Date().toISOString(),
      })
      .eq('service_id', serviceId);
  }
}

export function sanitizeGitConnectionForClient(
  conn: ServiceGitConnectionRecord | null
): Record<string, unknown> | null {
  if (!conn) return null;
  return {
    id: conn.id,
    serviceId: conn.service_id,
    provider: conn.provider,
    repoId: conn.repo_id,
    repoFullName: conn.repo_full_name,
    repoHtmlUrl: conn.repo_html_url,
    cloneUrl: conn.clone_url,
    defaultBranch: conn.default_branch,
    selectedBranch: conn.selected_branch,
    isPrivate: conn.is_private,
    autoDeployOnPush: conn.auto_deploy_on_push,
    prPreviewsEnabled: conn.pr_previews_enabled,
    webhookId: conn.webhook_id,
    webhookUrl: conn.webhook_url,
    webhookConfigured: Boolean(conn.webhook_secret_encrypted || conn.webhook_id),
    lastCommitSha: conn.last_commit_sha || null,
    lastSyncedAt: conn.last_synced_at || null,
    updatedAt: conn.updated_at,
  };
}

export function clearSandboxGitHubStateForTest(): void {
  sandboxGitHubAccounts.clear();
  sandboxGitConnections.clear();
}
