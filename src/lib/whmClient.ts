// ==============================================================================
// DEVHOST CLOUD - EDGE-COMPATIBLE WHM / cPANEL JSON API INTEGRATION CLIENT
// Compatible with Cloudflare Workers / OpenNext Edge Runtime (Fetch API only)
// ==============================================================================

import { isDevSandboxMode } from '@/lib/supabase';

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
  private host: string;
  private username: string;
  private apiToken: string;
  private isConfigured: boolean;

  constructor() {
    this.host = process.env.WHM_HOST || '';
    this.username = process.env.WHM_USERNAME || '';
    this.apiToken = process.env.WHM_API_TOKEN || '';
    this.isConfigured = Boolean(
      this.host &&
      this.username &&
      this.apiToken &&
      !this.apiToken.includes('your-whm-token')
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
  private async executeWhmApi(endpoint: string, params: Record<string, string> = {}): Promise<any> {
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

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn(`[WHM API Warning] Call to ${endpoint} failed:`, error?.message || error);
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
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Connection to WHM reseller server failed',
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
    } catch (err: any) {
      return {
        success: false,
        url: '',
        service,
        error: err?.message || 'WHM create_user_session request failed',
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
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to suspend account' };
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
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to unsuspend account' };
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

      const accounts: WhmListedAccount[] = rawAccts.map((a: any) => {
        const mb = parseInt(String(a.diskused).replace(/[^0-9]/g, '')) || 0;
        totalMb += mb;
        return {
          user: a.user,
          domain: a.domain,
          email: a.email,
          plan: a.plan,
          diskused: a.diskused,
          disklimit: a.disklimit,
          suspended: Boolean(a.suspended),
          ip: a.ip,
          startdate: a.startdate,
        };
      });

      return {
        success: true,
        accounts,
        totalDiskUsedMb: totalMb,
      };
    } catch (err: any) {
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
    } catch (err: any) {
      return {
        success: false,
        action: 'created',
        packageName: pkgName,
        message: err?.message || `Failed to sync package ${pkgName} to WHM`,
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
    } catch (err: any) {
      console.warn(`[AutoSSL Error] WHM AutoSSL trigger for ${cleanUser}:`, err?.message);
      return {
        success: false,
        username: cleanUser,
        message: `AutoSSL failed: ${err?.message || 'WHM server timeout'}`,
      };
    }
  }
}

// Export singleton instance
export const whmClient = new WhmClient();
