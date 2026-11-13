// ==============================================================================
// DEVHOST CLOUD - EDGE-COMPATIBLE WHM / cPANEL JSON API INTEGRATION CLIENT
// Compatible with Cloudflare Workers / OpenNext Edge Runtime (Fetch API only)
// ==============================================================================

import { isDevSandboxMode } from '@/lib/supabase';

interface WhmApiPayload {
  metadata?: { result?: number; reason?: string };
  status?: number;
  result?: {
    status?: number;
    errors?: unknown[];
    data?: unknown;
  };
  data?: {
    ip?: string;
    nameserver?: string;
    url?: string;
    expires?: number;
    acct?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WhmAccountParams {
  username: string;
  domain: string;
  plan: string;
  contactEmail: string;
  pkg?: string;
}

export interface WhmAccountResult {
  success: boolean;
  message: string;
  username?: string;
  domain?: string;
  ip?: string;
  nameservers?: string[];
  raw?: unknown;
}

export interface WhmPackageParams {
  name: string;
  storage_gb: number;
  bandwidth_mb?: number;
  max_addon_domains: number;
  ssh_enabled?: boolean;
  cpu_cores: number;
  ram_mb: number;
  io_speed_mbps: number;
  entry_processes: number;
  inode_limit: number;
}

export interface WhmPackageResult {
  success: boolean;
  action: 'created' | 'updated' | 'simulated' | 'error';
  packageName: string;
  message: string;
  raw?: unknown;
}

export interface WhmAutoSslResult {
  success: boolean;
  username: string;
  message: string;
  raw?: unknown;
}

export interface WhmSsoResult {
  success: boolean;
  url: string;
  service: 'cpaneld' | 'webmaild';
  expiresInSeconds?: number;
  error?: string;
}

export interface WhmUapiActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface WhmNodeCredentials {
  host: string;
  username?: string;
  apiToken: string;
}

export interface WhmPackageInfo {
  success: boolean;
  packageName: string;
  diskLimitMb: number;
  diskLimitGb: number;
  bandwidthLimitMb: number;
  bandwidthLimitGb: number;
  ramLimitMb: number;
  cpuCores: number;
  inodeLimit: number;
  maxAddons: number;
  error?: string;
}

export interface WhmAccountSummary {
  success: boolean;
  username: string;
  domain: string;
  plan: string;
  ip: string;
  suspended: boolean;
  diskUsedMb: number;
  diskUsedGb: number;
  diskLimitMb: number;
  diskLimitGb: number;
  inodesUsed: number;
  inodeLimit: number;
  bandwidthUsedGb: number;
  bandwidthLimitGb: number;
  error?: string;
}

function parseWhmCapacityMb(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  const str = String(raw ?? '').trim().toLowerCase();
  if (!str || str === 'unlimited' || str === 'null') return 0;
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([kmgt]?b?)$/i.exec(str);
  if (!match) return 0;
  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('t')) return num * 1024 * 1024;
  if (unit.startsWith('g')) return num * 1024;
  if (unit.startsWith('k')) return Number((num / 1024).toFixed(4));
  return num;
}

function parseWhmPositiveInt(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const str = String(raw ?? '').trim().toLowerCase();
  if (!str || str === 'unlimited' || str === 'null') return fallback;
  const cleaned = Number(str.replace(/[^0-9.]/g, ''));
  return Number.isFinite(cleaned) && cleaned >= 0 ? Math.round(cleaned) : fallback;
}

export interface WhmListedAccount {
  user: string;
  domain: string;
  email: string;
  plan: string;
  diskused: string;
  disklimit: string;
  suspended: boolean;
  ip: string;
  startdate: string;
}

export class WhmClient {
  private readonly overrideCreds?: WhmNodeCredentials;

  constructor(overrideCreds?: WhmNodeCredentials) {
    this.overrideCreds = overrideCreds;
  }

  public static forNode(creds: WhmNodeCredentials): WhmClient {
    return new WhmClient(creds);
  }

  private get host(): string {
    return (this.overrideCreds?.host ?? process.env.WHM_HOST ?? '').trim();
  }

  private get username(): string {
    return (this.overrideCreds?.username ?? process.env.WHM_USERNAME ?? 'root').trim();
  }

  private get apiToken(): string {
    return (this.overrideCreds?.apiToken ?? process.env.WHM_API_TOKEN ?? '').trim();
  }

  private get isConfigured(): boolean {
    return Boolean(
      this.host &&
        this.host !== 'undefined' &&
        this.username &&
        this.username !== 'undefined' &&
        this.apiToken &&
        this.apiToken !== 'undefined' &&
        !this.apiToken.includes('your-whm-') &&
        !this.apiToken.startsWith('your-')
    );
  }

  public getStatus() {
    return {
      configured: this.isConfigured,
      host: this.isConfigured
        ? `${this.host}:2087`
        : isDevSandboxMode()
          ? 'Simulated (Sandbox Mode)'
          : 'Unconfigured',
      resellerUser: this.username || (isDevSandboxMode() ? 'devreseller' : ''),
    };
  }

  /**
   * Internal WHM Request Dispatcher using Fetch & Authorization: whm user:token
   */
  private async executeWhmApi(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<WhmApiPayload | null> {
    if (!this.isConfigured) {
      return null;
    }

    const cleanHost = this.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = new URL(`https://${cleanHost}:2087/json-api/${endpoint}`);
    url.searchParams.set('api.version', '1');

    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for Edge

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `whm ${this.username}:${this.apiToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`WHM API responded with HTTP status ${response.status}`);
      }

      return (await response.json()) as WhmApiPayload;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      console.warn(
        `[WHM API Warning] Call to ${endpoint} failed:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * 1. CREATE CPANEL ACCOUNT (WHM createacct)
   */
  public async createCpanelAccount(params: WhmAccountParams): Promise<WhmAccountResult> {
    const cleanUser = params.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);

    // If WHM credentials are not configured, fail closed unless DEV_SANDBOX_MODE is explicitly enabled
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          message: 'WHM reseller server is not configured (missing WHM_HOST, WHM_USERNAME, or WHM_API_TOKEN).',
        };
      }
      return {
        success: true,
        message: 'Account successfully provisioned in Sandbox Simulation mode.',
        username: cleanUser,
        domain: params.domain,
        ip: '103.151.102.45',
        nameservers: ['ns1.devhost.net', 'ns2.devhost.net'],
        raw: { simulated: true },
      };
    }

    try {
      const data = await this.executeWhmApi('createacct', {
        username: cleanUser,
        domain: params.domain,
        plan: params.plan || 'Developer_Cloud_Starter',
        contactemail: params.contactEmail,
        customip: '',
        hasuseregistration: '0',
      });

      const result = data?.metadata?.result === 1;
      return {
        success: result,
        message: data?.metadata?.reason || (result ? 'cPanel created successfully' : 'Failed to create cPanel'),
        username: cleanUser,
        domain: params.domain,
        ip: data?.data?.ip || '103.151.102.45',
        nameservers: data?.data?.nameserver ? [data.data.nameserver] : ['ns1.devhost.net', 'ns2.devhost.net'],
        raw: data,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection to WHM reseller server failed',
      };
    }
  }

  /**
   * 2. ONE-CLICK SSO SESSION GENERATION (WHM create_user_session)
   * Automatically opens cPanel or Webmail without requiring username/password entry
   */
  public async createSsoSession(cpanelUser: string, service: 'cpaneld' | 'webmaild' = 'cpaneld'): Promise<WhmSsoResult> {
    const cleanUser = cpanelUser.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);

    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          url: '',
          service,
          error: 'WHM SSO is unavailable: WHM reseller credentials are not configured.',
        };
      }
      // Return high-fidelity realistic SSO session URL for local DEV_SANDBOX_MODE preview
      const mockSessionId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
      const mockPort = service === 'webmaild' ? 2096 : 2083;
      const targetPath = service === 'webmaild' ? 'cpsess' + mockSessionId + '/webmail/paper_lantern/index.html' : 'cpsess' + mockSessionId + '/frontend/jupiter/index.html';
      return {
        success: true,
        url: `https://cpanel.devhost.net:${mockPort}/${targetPath}?login=1&post_login=devhost_sso_gateway`,
        service,
        expiresInSeconds: 900,
      };
    }

    try {
      const data = await this.executeWhmApi('create_user_session', {
        user: cleanUser,
        service: service, // 'cpaneld' for cPanel dashboard, 'webmaild' for Webmail
      });

      if (data?.data?.url) {
        return {
          success: true,
          url: data.data.url,
          service,
          expiresInSeconds: data?.data?.expires || 900,
        };
      }

      throw new Error(data?.metadata?.reason || 'No session URL returned by WHM');
    } catch (err: unknown) {
      return {
        success: false,
        url: '',
        service,
        error: err instanceof Error ? err.message : 'WHM create_user_session request failed',
      };
    }
  }

  /**
   * 3. SUSPEND ACCOUNT (WHM suspendacct)
   */
  public async suspendAccount(cpanelUser: string, reason: string = 'Billing past due'): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return { success: false, message: 'WHM reseller server is not configured.' };
      }
      return { success: true, message: `Account ${cpanelUser} suspended (Simulated).` };
    }

    try {
      const data = await this.executeWhmApi('suspendacct', {
        user: cpanelUser,
        reason,
      });
      return {
        success: data?.metadata?.result === 1,
        message: data?.metadata?.reason || 'Suspended successfully',
      };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to suspend account' };
    }
  }

  /**
   * 4. UNSUSPEND ACCOUNT (WHM unsuspendacct)
   */
  public async unsuspendAccount(cpanelUser: string): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return { success: false, message: 'WHM reseller server is not configured.' };
      }
      return { success: true, message: `Account ${cpanelUser} unsuspended (Simulated).` };
    }

    try {
      const data = await this.executeWhmApi('unsuspendacct', {
        user: cpanelUser,
      });
      return {
        success: data?.metadata?.result === 1,
        message: data?.metadata?.reason || 'Unsuspended successfully',
      };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to unsuspend account' };
    }
  }

  /**
   * 4B. TERMINATE ACCOUNT (WHM removeacct)
   */
  public async terminateAccount(
    cpanelUser: string,
    keepDns = false
  ): Promise<{ success: boolean; message: string }> {
    const cleanUser = cpanelUser.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return { success: false, message: 'WHM reseller server is not configured.' };
      }
      return { success: true, message: `Account ${cleanUser} terminated (Simulated).` };
    }

    try {
      const data = await this.executeWhmApi('removeacct', {
        user: cleanUser,
        keepdns: keepDns ? '1' : '0',
      });
      return {
        success: data?.metadata?.result === 1,
        message: data?.metadata?.reason || `Terminated ${cleanUser} successfully`,
      };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to terminate account' };
    }
  }

  /**
   * 5. LIST ALL ACCOUNTS & DISK USAGE (WHM listaccts)
   * Powers Admin Reseller Watchdog & Account sync
   */
  public async listAccounts(): Promise<{ success: boolean; accounts: WhmListedAccount[]; totalDiskUsedMb: number }> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return { success: false, accounts: [], totalDiskUsedMb: 0 };
      }
      const mockAccounts: WhmListedAccount[] = [
        {
          user: 'devprod',
          domain: 'myreactapp.com',
          email: 'admin@myreactapp.com',
          plan: 'Developer_Git_15G',
          diskused: '1420M',
          disklimit: '15360M',
          suspended: false,
          ip: '103.151.102.45',
          startdate: '2026-01-15',
        },
        {
          user: 'wpagency',
          domain: 'dhakabazaar.com.bd',
          email: 'contact@dhakabazaar.com.bd',
          plan: 'WP_Turbo_10G',
          diskused: '2150M',
          disklimit: '10240M',
          suspended: false,
          ip: '103.151.102.45',
          startdate: '2026-02-01',
        },
      ];
      return { success: true, accounts: mockAccounts, totalDiskUsedMb: 3570 };
    }

    try {
      const data = await this.executeWhmApi('listaccts');
      const rawAccts = data?.data?.acct || [];
      let totalMb = 0;

      const accounts: WhmListedAccount[] = rawAccts.map((a: Record<string, unknown>) => {
        const diskUsedStr = String(a.diskused ?? '0');
        const mb = parseInt(diskUsedStr.replace(/[^0-9]/g, ''), 10) || 0;
        totalMb += mb;
        return {
          user: String(a.user ?? ''),
          domain: String(a.domain ?? ''),
          email: String(a.email ?? ''),
          plan: String(a.plan ?? ''),
          diskused: diskUsedStr,
          disklimit: String(a.disklimit ?? ''),
          suspended: Boolean(a.suspended),
          ip: String(a.ip ?? ''),
          startdate: String(a.startdate ?? ''),
        };
      });

      return {
        success: true,
        accounts,
        totalDiskUsedMb: totalMb,
      };
    } catch {
      return {
        success: false,
        accounts: [],
        totalDiskUsedMb: 0,
      };
    }
  }

  /**
   * 6. AUTOMATED WHM PACKAGE CREATION & SYNC (WHM addpkg / editpkg)
   * Splits hosting packages on the server with exact CloudLinux RAM, CPU, Inode, and Disk Quota limits
   */
  public async syncPackageToWhmServer(pkg: WhmPackageParams): Promise<WhmPackageResult> {
    const pkgName = pkg.name.trim();

    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          action: 'error',
          packageName: pkgName,
          message: 'WHM reseller server is not configured.',
        };
      }
      return {
        success: true,
        action: 'simulated',
        packageName: pkgName,
        message: `Package ${pkgName} successfully registered in Sandbox Simulation mode (${pkg.storage_gb}GB NVMe, ${pkg.ram_mb}MB RAM, ${pkg.cpu_cores} Core CPU, ${pkg.inode_limit} Inodes).`,
        raw: { simulated: true, pkg },
      };
    }

    const params: Record<string, string> = {
      name: pkgName,
      quota: String(Math.round(pkg.storage_gb * 1024)),
      bwlimit: String(pkg.bandwidth_mb || 500000),
      maxaddon: String(pkg.max_addon_domains),
      hasshell: pkg.ssh_enabled ? '1' : '0',
      lve_cpu: String(pkg.cpu_cores * 100),
      lve_pmem: String(pkg.ram_mb),
      lve_io: String(Math.round(pkg.io_speed_mbps * 1024)),
      lve_ep: String(pkg.entry_processes),
      lve_inodes: String(pkg.inode_limit),
      featurelist: 'default',
    };

    try {
      // First attempt addpkg
      const addData = await this.executeWhmApi('addpkg', params);
      if (addData?.metadata?.result === 1) {
        return {
          success: true,
          action: 'created',
          packageName: pkgName,
          message: addData?.metadata?.reason || `Package ${pkgName} created on WHM server.`,
          raw: addData,
        };
      }

      // If addpkg fails because package exists, edit/update it
      const editData = await this.executeWhmApi('editpkg', params);
      const isUpdated = editData?.metadata?.result === 1;
      return {
        success: isUpdated,
        action: 'updated',
        packageName: pkgName,
        message: editData?.metadata?.reason || (isUpdated ? `Package ${pkgName} updated on WHM server.` : 'Failed to sync package to WHM'),
        raw: editData,
      };
    } catch (err: unknown) {
      return {
        success: false,
        action: 'created',
        packageName: pkgName,
        message: err instanceof Error ? err.message : `Failed to sync package ${pkgName} to WHM`,
      };
    }
  }

  /**
   * 7. BATCH SYNC ALL CATALOG PACKAGES TO WHM
   */
  public async syncAllPackages(plans: WhmPackageParams[]): Promise<{ success: boolean; results: WhmPackageResult[]; summary: string }> {
    const results: WhmPackageResult[] = [];
    for (const plan of plans) {
      const res = await this.syncPackageToWhmServer(plan);
      results.push(res);
    }
    const successCount = results.filter((r) => r.success).length;
    return {
      success: successCount === plans.length,
      results,
      summary: `Synchronized ${successCount}/${plans.length} packages to WHM server (${this.host ? this.host : 'Simulation Mode'}).`,
    };
  }

  /**
   * 8. INSTANT FREE AUTOSSL ENGINE (WHM start_autossl_check_for_one_user)
   * Automatically starts AutoSSL check immediately upon cPanel provisioning or addon domain attachment
   */
  public async triggerInstantAutoSsl(cpanelUsername: string): Promise<WhmAutoSslResult> {
    const cleanUser = cpanelUsername.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);

    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          username: cleanUser,
          message: 'WHM reseller server is not configured (AutoSSL unavailable).',
        };
      }
      return {
        success: true,
        username: cleanUser,
        message: `AutoSSL Let's Encrypt / Sectigo verification cycle initialized for user ${cleanUser} (Simulated).`,
        raw: { simulated: true, ssl_status: 'active_tls13' },
      };
    }

    try {
      const data = await this.executeWhmApi('start_autossl_check_for_one_user', {
        username: cleanUser,
        user: cleanUser,
      });

      const isStarted = data?.metadata?.result === 1 || data?.status === 1;
      return {
        success: isStarted,
        username: cleanUser,
        message: data?.metadata?.reason || (isStarted ? `Instant AutoSSL check started for ${cleanUser}` : 'AutoSSL queue triggered'),
        raw: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'WHM server timeout';
      console.warn(`[AutoSSL Error] WHM AutoSSL trigger for ${cleanUser}:`, msg);
      return {
        success: false,
        username: cleanUser,
        message: `AutoSSL failed: ${msg}`,
      };
    }
  }

  /**
   * 9. CPANEL UAPI PROXY CALL (via WHM /json-api/cpanel v3)
   */
  public async executeCpanelUapi(
    cpanelUser: string,
    moduleName: string,
    funcName: string,
    args: Record<string, string | number> = {}
  ): Promise<WhmUapiActionResult> {
    const cleanUser = cpanelUser.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          message: 'WHM reseller server is not configured (cPanel UAPI unavailable).',
        };
      }
      return {
        success: true,
        message: `Simulated UAPI ${moduleName}::${funcName} for ${cleanUser}.`,
        data: { simulated: true, module: moduleName, func: funcName },
      };
    }

    try {
      const stringArgs: Record<string, string> = {
        cpanel_jsonapi_user: cleanUser,
        cpanel_jsonapi_apiversion: '3',
        cpanel_jsonapi_module: moduleName,
        cpanel_jsonapi_func: funcName,
      };
      for (const [k, v] of Object.entries(args)) {
        stringArgs[k] = String(v);
      }

      const data = await this.executeWhmApi('cpanel', stringArgs);
      const uapiResult = data?.result;
      const ok = uapiResult?.status === 1 || data?.metadata?.result === 1;
      const errorMsg = Array.isArray(uapiResult?.errors) && uapiResult.errors.length > 0
        ? String(uapiResult.errors[0])
        : data?.metadata?.reason || 'cPanel UAPI call completed';

      return {
        success: Boolean(ok),
        message: ok ? `UAPI ${moduleName}::${funcName} succeeded.` : errorMsg,
        data: uapiResult?.data ?? data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'WHM UAPI request failed';
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * 10. CREATE MYSQL DATABASE & GRANT USER VIA CPANEL UAPI (Mysql::create_database / set_privileges_on_database)
   */
  public async createDatabase(params: {
    cpanelUser: string;
    dbName: string;
    dbUsername: string;
    dbPassword: string;
  }): Promise<WhmUapiActionResult> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          message: 'WHM server not configured for live MySQL UAPI provisioning.',
        };
      }
      return {
        success: true,
        message: `MySQL database ${params.dbName} simulated via cPanel UAPI.`,
        data: { simulated: true, dbName: params.dbName },
      };
    }

    const dbRes = await this.executeCpanelUapi(params.cpanelUser, 'Mysql', 'create_database', {
      name: params.dbName,
    });
    if (!dbRes.success) return dbRes;

    const userRes = await this.executeCpanelUapi(params.cpanelUser, 'Mysql', 'create_user', {
      name: params.dbUsername,
      password: params.dbPassword,
    });
    if (!userRes.success) return userRes;

    return this.executeCpanelUapi(params.cpanelUser, 'Mysql', 'set_privileges_on_database', {
      user: params.dbUsername,
      database: params.dbName,
      privileges: 'ALL PRIVILEGES',
    });
  }

  /**
   * 11. CREATE MAILBOX VIA CPANEL UAPI (Email::add_pop)
   */
  public async createEmailAccount(params: {
    cpanelUser: string;
    domain: string;
    localPart: string;
    password: string;
    quotaMb?: number;
  }): Promise<WhmUapiActionResult> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          message: 'WHM server not configured for live cPanel mailbox provisioning.',
        };
      }
      return {
        success: true,
        message: `Mailbox ${params.localPart}@${params.domain} simulated via cPanel UAPI.`,
        data: { simulated: true },
      };
    }

    return this.executeCpanelUapi(params.cpanelUser, 'Email', 'add_pop', {
      email: params.localPart,
      domain: params.domain,
      password: params.password,
      quota: params.quotaMb ?? 1024,
    });
  }

  /**
   * 12. DELETE MAILBOX VIA CPANEL UAPI (Email::delete_pop)
   */
  public async deleteEmailAccount(params: {
    cpanelUser: string;
    domain: string;
    localPart: string;
  }): Promise<WhmUapiActionResult> {
    if (!this.isConfigured) {
      if (!isDevSandboxMode()) {
        return {
          success: false,
          message: 'WHM server not configured for live cPanel mailbox deletion.',
        };
      }
      return {
        success: true,
        message: `Mailbox deletion simulated for ${params.localPart}@${params.domain}.`,
      };
    }

    return this.executeCpanelUapi(params.cpanelUser, 'Email', 'delete_pop', {
      email: `${params.localPart}@${params.domain}`,
      domain: params.domain,
    });
  }

  /**
   * Query WHM getpkginfo to fetch live server package limits (disk/bandwidth/LVE/inodes).
   */
  public async getPackageInfo(packageName: string): Promise<WhmPackageInfo> {
    const cleanPkg = String(packageName || '').trim();
    if (!cleanPkg) {
      return {
        success: false,
        packageName: '',
        diskLimitMb: 0,
        diskLimitGb: 0,
        bandwidthLimitMb: 0,
        bandwidthLimitGb: 0,
        ramLimitMb: 0,
        cpuCores: 0,
        inodeLimit: 0,
        maxAddons: 0,
        error: 'Package name is required.',
      };
    }

    if (!this.isConfigured) {
      return {
        success: false,
        packageName: cleanPkg,
        diskLimitMb: 0,
        diskLimitGb: 0,
        bandwidthLimitMb: 0,
        bandwidthLimitGb: 0,
        ramLimitMb: 0,
        cpuCores: 0,
        inodeLimit: 0,
        maxAddons: 0,
        error: 'WHM server is not configured.',
      };
    }

    const res = await this.executeWhmApi('getpkginfo', { pkg: cleanPkg });
    const rawPkg = (res?.data?.pkg ?? res?.data) as Record<string, unknown> | undefined;
    if (!res || res.metadata?.result !== 1 || !rawPkg) {
      return {
        success: false,
        packageName: cleanPkg,
        diskLimitMb: 0,
        diskLimitGb: 0,
        bandwidthLimitMb: 0,
        bandwidthLimitGb: 0,
        ramLimitMb: 0,
        cpuCores: 0,
        inodeLimit: 0,
        maxAddons: 0,
        error: res?.metadata?.reason || `Package "${cleanPkg}" lookup failed in WHM.`,
      };
    }

    const diskLimitMb = parseWhmCapacityMb(rawPkg.QUOTA ?? rawPkg.quota);
    const bandwidthLimitMb = parseWhmCapacityMb(rawPkg.BWLIMIT ?? rawPkg.bwlimit);
    const ramLimitMb = parseWhmCapacityMb(rawPkg.lve_pmem ?? rawPkg.LVE_PMEM ?? rawPkg.ram_mb);
    const cpuRaw = Number(rawPkg.lve_cpu ?? rawPkg.LVE_CPU ?? 0);
    const cpuCores = cpuRaw >= 100 ? Math.max(1, Math.round(cpuRaw / 100)) : Math.max(0, cpuRaw);
    const inodeLimit = parseWhmPositiveInt(rawPkg.lve_inodes ?? rawPkg.LVE_INODES ?? rawPkg.INODE_LIMIT, 0);
    const maxAddons = parseWhmPositiveInt(rawPkg.MAXADDON ?? rawPkg.maxaddon, 0);

    return {
      success: true,
      packageName: cleanPkg,
      diskLimitMb,
      diskLimitGb: diskLimitMb > 0 ? Number((diskLimitMb / 1024).toFixed(2)) : 0,
      bandwidthLimitMb,
      bandwidthLimitGb: bandwidthLimitMb > 0 ? Number((bandwidthLimitMb / 1024).toFixed(2)) : 0,
      ramLimitMb,
      cpuCores,
      inodeLimit,
      maxAddons,
    };
  }

  /**
   * Query WHM accountsummary for real-time tenant disk, inode, bandwidth & status metrics.
   */
  public async getAccountSummary(cpanelUsername: string): Promise<WhmAccountSummary> {
    const cleanUser = String(cpanelUsername || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!cleanUser) {
      return {
        success: false,
        username: '',
        domain: '',
        plan: '',
        ip: '',
        suspended: false,
        diskUsedMb: 0,
        diskUsedGb: 0,
        diskLimitMb: 0,
        diskLimitGb: 0,
        inodesUsed: 0,
        inodeLimit: 0,
        bandwidthUsedGb: 0,
        bandwidthLimitGb: 0,
        error: 'cPanel username is required.',
      };
    }

    if (!this.isConfigured) {
      return {
        success: false,
        username: cleanUser,
        domain: '',
        plan: '',
        ip: '',
        suspended: false,
        diskUsedMb: 0,
        diskUsedGb: 0,
        diskLimitMb: 0,
        diskLimitGb: 0,
        inodesUsed: 0,
        inodeLimit: 0,
        bandwidthUsedGb: 0,
        bandwidthLimitGb: 0,
        error: 'WHM reseller server is not configured.',
      };
    }

    const res = await this.executeWhmApi('accountsummary', { user: cleanUser });
    const acct = res?.data?.acct?.[0];
    if (!res || res.metadata?.result !== 1 || !acct) {
      return {
        success: false,
        username: cleanUser,
        domain: '',
        plan: '',
        ip: '',
        suspended: false,
        diskUsedMb: 0,
        diskUsedGb: 0,
        diskLimitMb: 0,
        diskLimitGb: 0,
        inodesUsed: 0,
        inodeLimit: 0,
        bandwidthUsedGb: 0,
        bandwidthLimitGb: 0,
        error: res?.metadata?.reason || `Account summary not found for "${cleanUser}".`,
      };
    }

    const diskUsedMb = parseWhmCapacityMb(acct.diskused);
    const diskLimitMb = parseWhmCapacityMb(acct.disklimit);
    const inodesUsed = parseWhmPositiveInt(acct.inodesused, 0);
    const inodeLimit = parseWhmPositiveInt(acct.inodeslimit, 0);
    const bwUsedMb = parseWhmCapacityMb(acct.bwused ?? acct.bandwidth);
    const bwLimitMb = parseWhmCapacityMb(acct.bwlimit ?? acct.bandwidthlimit);

    return {
      success: true,
      username: String(acct.user || cleanUser),
      domain: String(acct.domain || ''),
      plan: String(acct.plan || ''),
      ip: String(acct.ip || ''),
      suspended: Number(acct.suspended) === 1 || acct.suspended === true,
      diskUsedMb,
      diskUsedGb: Number((diskUsedMb / 1024).toFixed(2)),
      diskLimitMb,
      diskLimitGb: diskLimitMb > 0 ? Number((diskLimitMb / 1024).toFixed(2)) : 0,
      inodesUsed,
      inodeLimit,
      bandwidthUsedGb: Number((bwUsedMb / 1024).toFixed(2)),
      bandwidthLimitGb: bwLimitMb > 0 ? Number((bwLimitMb / 1024).toFixed(2)) : 0,
    };
  }
}

// Export singleton instance
export const whmClient = new WhmClient();
