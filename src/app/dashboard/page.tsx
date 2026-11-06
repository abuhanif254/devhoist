'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  Globe,
  CreditCard,
  LifeBuoy,
  Users,
  User,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  ChevronDown,
  Trash2,
  Key,
  Database,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Bell,
  Menu,
  X,
  FileText,
  Printer,
  Sparkles,
  TrendingUp,
  Sliders,
  DollarSign,
  Share2,
  HardDrive,
  Cpu,
  Zap,
  Activity,
  Send,
  GitBranch,
  RotateCcw,
  Download,
  FolderGit2,
  Play,
  Pause,
  UploadCloud,
  CheckSquare,
  Square,
  Search,
  Filter,
  History,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  Wallet,
  Loader2,
} from 'lucide-react';
import {
  usePortal,
  CloudService,
  DomainItem,
  Invoice,
  SupportTicket,
  DnsRecord,
  DatabaseItem,
  SubdomainItem,
  BackupSnapshot,
  CronJobItem,
  ServerLogItem,
  ChildNameserver,
  DomainRedirect,
  SystemNotification,
} from '@/context/PortalContext';
import { useBilling } from '@/context/BillingContext';
import { useLanguage } from '@/context/LanguageContext';
import CustomerProfileView from '@/components/profiles/CustomerProfileView';
import AffiliateProfileView from '@/components/profiles/AffiliateProfileView';
import { useSudoGate } from '@/components/security/SudoGateModal';
import DnsZoneManager from '@/components/domains/DnsZoneManager';
import DomainTransferTracker from '@/components/domains/DomainTransferTracker';
import HostingAddonManager from '@/components/domains/HostingAddonManager';
import HostingProjectControlStudio from '@/components/hosting/HostingProjectControlStudio';

type DashboardTab =
  | 'overview'
  | 'services'
  | 'domains'
  | 'billing'
  | 'support'
  | 'affiliate'
  | 'security'
  | 'profile';

type ServiceSubTab =
  | 'overview'
  | 'git'
  | 'databases'
  | 'domains_staging'
  | 'backups'
  | 'cron_logs';

type DomainDrawerSubTab =
  | 'nameservers'
  | 'dns'
  | 'child_ns'
  | 'whois_lock'
  | 'redirects';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { requireSudo } = useSudoGate();
  const {
    currentUser,
    authLoading,
    logout,
    activeRole,
    switchRole,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    systemBroadcast,
    dismissBroadcast,

    services,
    activeService,
    setActiveServiceId,
    cleanServiceCache,
    restartPassengerWorkers,
    flushLiteSpeedCache,
    resetCpanelPassword,
    triggerManualDeploy,
    rollbackRelease,
    updateServiceRuntime,
    addEnvVariable,
    deleteEnvVariable,
    upgradeServicePlan,
    updateServiceSshKey,

    databases,
    createDatabase,
    deleteDatabase,

    subdomains,
    createSubdomain,
    deleteSubdomain,
    cloneToStaging,
    pushStagingToLive,
    toggleSubdomainForceHttps,
    renewAutoSsl,

    backups,
    restoreBackup,
    generateManualSnapshot,

    cronJobs,
    createCronJob,
    deleteCronJob,
    toggleCronJobStatus,
    serverLogs,
    clearServerLogs,

    domains,
    toggleDomainLock,
    toggleDomainWhoisPrivacy,
    toggleDomainAutoRenew,
    bulkToggleAutoRenew,
    bulkUpdateNameservers,
    updateDomainNameservers,
    addDnsRecord,
    deleteDnsRecord,
    applyDnsPreset,

    childNameservers,
    createChildNameserver,
    deleteChildNameserver,
    domainRedirects,
    createDomainRedirect,
    deleteDomainRedirect,
    initiateDomainTransfer,

    walletBalanceBDT,
    walletTransactions,
    invoices,
    topUpWallet,
    payInvoice,

    tickets,
    createSupportTicket,
    replyToTicket,
    resolveTicket,

    affiliate,
    requestAffiliatePayout,

    teamMembers,
    inviteTeamMember,
    removeTeamMember,
    apiTokens,
    generateApiToken,
    revokeApiToken,
    loginSessions,
    revokeSession,
    revokeAllOtherSessions,
  } = usePortal();

  const { theme, toggleTheme } = useBilling();
  const { language } = useLanguage();

  // Navigation State
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<{ id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    try {
      const imp = sessionStorage.getItem('devhost_impersonate');
      if (imp) setImpersonatedUser(JSON.parse(imp));
    } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login?redirect=/dashboard');
    }
  }, [authLoading, currentUser, router]);

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const triggerCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Service Deep Workspace Sub-Tabs
  const [serviceSubTab, setServiceSubTab] = useState<ServiceSubTab>('overview');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newCpanelPass, setNewCpanelPass] = useState('DhcSecure_2026!#' + Math.random().toString(36).substring(2, 6));
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [envKeyInput, setEnvKeyInput] = useState('');
  const [envValInput, setEnvValInput] = useState('');
  const [sshKeyInput, setSshKeyInput] = useState(activeService?.sshPublicKey || '');
  const [revealedEnvKeys, setRevealedEnvKeys] = useState<{ [key: string]: boolean }>({});
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);

  const handleLaunchSso = async (cpanelUser: string, service: 'cpaneld' | 'webmaild' = 'cpaneld') => {
    setSsoLoading(service);
    try {
      const res = await fetch('/api/whm/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cpanelUser, service }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        alert(data?.message || 'Could not initialize SSO session');
      }
    } catch {
      alert('Failed to connect to SSO gateway');
    } finally {
      setSsoLoading(null);
    }
  };

  // Database Tab State
  const [newDbName, setNewDbName] = useState('');
  const [newDbUser, setNewDbUser] = useState('');
  const [newDbPass, setNewDbPass] = useState('Pass_' + Math.random().toString(36).substring(2, 8));
  const [phpMyAdminModalDb, setPhpMyAdminModalDb] = useState<string | null>(null);

  // Subdomain & Staging State
  const [newSubdomainName, setNewSubdomainName] = useState('');
  const [newSubdomainDocRoot, setNewSubdomainDocRoot] = useState('/public_html/');
  const [isCloningStaging, setIsCloningStaging] = useState(false);
  const [isPushingLive, setIsPushingLive] = useState(false);

  // Backups State
  const [restoreModalData, setRestoreModalData] = useState<{ backup: BackupSnapshot; type: 'files' | 'db' | 'full' } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressStep, setRestoreProgressStep] = useState(0);

  // Cron & Logs State
  const [cronPreset, setCronPreset] = useState('daily');
  const [cronScheduleInput, setCronScheduleInput] = useState('0 0 * * *');
  const [cronCommandInput, setCronCommandInput] = useState('node /home/dev_hanif/scripts/worker.js');
  const [cronDescInput, setCronDescInput] = useState('Daily sync script');
  const [logFilter, setLogFilter] = useState<'all' | '200' | '404' | 'error'>('all');

  // Domains & Registrar State
  const [selectedDomainForDrawer, setSelectedDomainForDrawer] = useState<DomainItem | null>(null);
  const [domainDrawerTab, setDomainDrawerTab] = useState<DomainDrawerSubTab>('nameservers');
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [isBulkNsModalOpen, setIsBulkNsModalOpen] = useState(false);
  const [bulkNs1, setBulkNs1] = useState('ns1.devhost.cloud');
  const [bulkNs2, setBulkNs2] = useState('ns2.devhost.cloud');
  const [isTransferInModalOpen, setIsTransferInModalOpen] = useState(false);
  const [transferDomainInput, setTransferDomainInput] = useState('');
  const [transferEppInput, setTransferEppInput] = useState('');
  const [revealedEpp, setRevealedEpp] = useState(false);

  // Child NS State
  const [newChildNsHost, setNewChildNsHost] = useState('');
  const [newChildNsIp, setNewChildNsIp] = useState('103.145.22.40');

  // Redirects State
  const [newRedirectSource, setNewRedirectSource] = useState('/');
  const [newRedirectTarget, setNewRedirectTarget] = useState('https://');
  const [newRedirectType, setNewRedirectType] = useState<'301' | '302'>('301');

  // New DNS Record State
  const [newDnsType, setNewDnsType] = useState<DnsRecord['type']>('A');
  const [newDnsName, setNewDnsName] = useState('@');
  const [newDnsContent, setNewDnsContent] = useState('103.145.22.40');
  const [newDnsTtl, setNewDnsTtl] = useState(300);

  // Top Up Wallet State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [topUpMethod, setTopUpMethod] = useState<'bKash' | 'Nagad'>('bKash');
  const [topUpPhone, setTopUpPhone] = useState('01712345678');

  // Support Ticket Form State
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDept, setTicketDept] = useState('Technical & DevOps Support');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('Normal');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketReplyInput, setTicketReplyInput] = useState<{ [key: string]: string }>({});

  // Payout Request State
  const [payoutAmount, setPayoutAmount] = useState(1000);
  const [payoutMethod, setPayoutMethod] = useState('bKash');
  const [payoutAccount, setPayoutAccount] = useState('01712345678');
  const [affiliateLanding, setAffiliateLanding] = useState('/');
  const [affiliateSubId, setAffiliateSubId] = useState('youtube_bio');
  const [isAffiliatePayoutModalOpen, setIsAffiliatePayoutModalOpen] = useState(false);
  const [affiliatePayoutMethod, setAffiliatePayoutMethod] = useState<'bKash' | 'Nagad' | 'Bank'>('bKash');
  const [affiliatePayoutAccount, setAffiliatePayoutAccount] = useState('01712345678');
  const [affiliatePayoutAmount, setAffiliatePayoutAmount] = useState(1000);
  const [bannerTab, setBannerTab] = useState<'728x90' | '300x250' | '1200x630'>('728x90');

  // Handlers
  const handleDeployNow = async () => {
    setIsDeploying(true);
    const logs = await triggerManualDeploy(activeService.id);
    setDeployLogs(logs);
    setIsDeploying(false);
  };

  const handleCreateDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim() || !newDbUser.trim()) return;
    await createDatabase(activeService.id, `devhanif_${newDbName.trim()}`, `devhanif_${newDbUser.trim()}`, newDbPass);
    setNewDbName('');
    setNewDbUser('');
  };

  const handleCreateSubdomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubdomainName.trim()) return;
    const fullSub = `${newSubdomainName.trim()}.${activeService.domain}`;
    await createSubdomain(activeService.id, fullSub, newSubdomainDocRoot);
    setNewSubdomainName('');
  };

  const handleCloneStagingTrigger = async () => {
    setIsCloningStaging(true);
    await cloneToStaging(activeService.id);
    setIsCloningStaging(false);
  };

  const handlePushStagingLiveTrigger = async () => {
    if (confirm('Are you sure you want to push staging to production? This will overwrite live files.')) {
      setIsPushingLive(true);
      await pushStagingToLive(activeService.id);
      setIsPushingLive(false);
      alert('Staging changes successfully merged into Production live container!');
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreModalData) return;
    setIsRestoring(true);
    setRestoreProgressStep(1);
    await new Promise((res) => setTimeout(res, 800));
    setRestoreProgressStep(2);
    await new Promise((res) => setTimeout(res, 800));
    setRestoreProgressStep(3);
    await new Promise((res) => setTimeout(res, 800));
    setRestoreProgressStep(4);
    await restoreBackup(restoreModalData.backup.id, restoreModalData.type);
    setIsRestoring(false);
    setRestoreModalData(null);
    setRestoreProgressStep(0);
    alert('Backup point restored successfully without data loss!');
  };

  const handleAddCronSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronCommandInput.trim()) return;
    createCronJob(activeService.id, cronScheduleInput, cronCommandInput.trim(), cronDescInput.trim());
    setCronCommandInput('');
    setCronDescInput('');
  };

  const handleBulkAutoRenew = (enable: boolean) => {
    bulkToggleAutoRenew(selectedDomainIds, enable);
    setSelectedDomainIds([]);
  };

  const handleBulkNsSave = () => {
    bulkUpdateNameservers(selectedDomainIds, [bulkNs1, bulkNs2]);
    setIsBulkNsModalOpen(false);
    setSelectedDomainIds([]);
  };

  const handleTransferInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferDomainInput.trim() || !transferEppInput.trim()) return;
    await initiateDomainTransfer(transferDomainInput.trim(), transferEppInput.trim());
    setIsTransferInModalOpen(false);
    setTransferDomainInput('');
    setTransferEppInput('');
  };

  const filteredLogs = serverLogs.filter((log) => {
    if (log.serviceId !== activeService.id) return false;
    if (logFilter === '200') return log.statusCode === 200;
    if (logFilter === '404') return log.statusCode === 404;
    if (logFilter === 'error') return log.statusCode >= 500 || log.type === 'error';
    return true;
  });

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm text-slate-400">Authenticating secure cloud session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {impersonatedUser && (
        <div className="w-full bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 text-white px-4 py-2 text-xs font-mono font-bold flex items-center justify-between shadow-lg sticky top-0 z-50 animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>GOD-MODE IMPERSONATION: Viewing as Client <u>{impersonatedUser.name}</u> ({impersonatedUser.email})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('devhost_impersonate');
              window.location.href = '/admin';
            }}
            className="px-3 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white font-bold cursor-pointer transition-all border border-white/20"
          >
            Return to Admin God-Mode ↗
          </button>
        </div>
      )}
      {/* GLOBAL SYSTEM ANNOUNCEMENT BROADCASTER (Controlled from /admin) */}
      {systemBroadcast.active && (
        <aside
          aria-label="System Announcement"
          className={`w-full px-4 py-2 text-xs font-mono flex items-center justify-between border-b ${
            systemBroadcast.type === 'urgent'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
              : systemBroadcast.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold uppercase tracking-wider">SYSTEM BROADCAST:</span>
              <span>{systemBroadcast.message}</span>
            </div>
            {systemBroadcast.dismissible && (
              <button
                type="button"
                onClick={dismissBroadcast}
                className="hover:opacity-75 p-1 cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </aside>
      )}

      {/* TOP COMMAND HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Portal Brand */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
                DH
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-base">
                  DevHost<span className="text-blue-600">.cloud</span>
                </span>
                <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold">
                  Client Area
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Actions & Header Tools */}
          <div className="flex items-center gap-3">
            {/* Real-time Notification Bell Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                title="Notifications"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Notification Center</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono">
                        {unreadNotificationCount} unread
                      </span>
                    </div>
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-mono text-blue-600 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          !n.read
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                            : 'bg-slate-50/50 dark:bg-zinc-900/40 border-slate-100 dark:border-white/5 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-zinc-100">
                          <span>{n.title}</span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 leading-snug">
                          {n.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cloud Wallet Pill */}
            <button
              type="button"
              onClick={() => setIsTopUpModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Wallet: ৳{walletBalanceBDT.toLocaleString()}</span>
              <Plus className="w-3 h-3 ml-0.5" />
            </button>

            {/* Role Switcher (Admin / Client quick switcher for founder) */}
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold shadow-xs transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Console</span>
            </Link>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
              title="Toggle Day/Dark Theme"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {currentUser.avatar}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-tight">{currentUser.company}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN PORTAL BODY WITH LEFT NAVIGATION */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col lg:flex-row gap-8">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="p-3 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4" />
                <span>My Services &amp; Git</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${activeTab === 'services' ? 'bg-white/20' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                {services.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('domains')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'domains'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4" />
                <span>Domains &amp; DNS</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${activeTab === 'domains' ? 'bg-white/20' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                {domains.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4" />
                <span>Billing &amp; Invoices</span>
              </div>
              {invoices.some((i) => i.status === 'Unpaid') && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'support'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <LifeBuoy className="w-4 h-4" />
                <span>Support Tickets</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${activeTab === 'support' ? 'bg-white/20' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                {tickets.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('affiliate')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'affiliate'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Affiliate Program</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Security &amp; API Keys</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Developer Profile &amp; BIN</span>
            </button>
          </div>

          {/* Quick Node Telemetry Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                Network Status
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 100% Uptime
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>SG1 Equinix:</span>
                <strong className="text-slate-900 dark:text-zinc-200">~35ms (BDIX)</strong>
              </div>
              <div className="flex justify-between">
                <span>US Ashburn:</span>
                <strong className="text-slate-900 dark:text-zinc-200">~182ms</strong>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN DYNAMIC CONTENT AREA */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* =========================================================================
              MODULE 1: DASHBOARD OVERVIEW & RESUME METRICS
             ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Welcome Banner */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-600/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-mono font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Active Production Workspace</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Welcome back, {currentUser.name}!
                  </h1>
                  <p className="text-sm text-blue-100 max-w-xl">
                    Your {activeService.planName} is operational on {activeService.datacenter} with zero dropped requests.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('services')}
                    className="px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Manage Servers
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTopUpModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Top Up Wallet
                  </button>
                </div>
              </div>

              {/* Quick Service Telemetry Card or Empty State */}
              {services.length === 0 ? (
                <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Server className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      No Active Cloud Services Yet
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                      Your portfolio is clean and ready. Pick an ultra-fast NVMe cloud container to deploy your Next.js apps, WordPress sites, or databases.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/#pricing"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-600/25 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Deploy New Cloud Service</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {activeService.domain}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {activeService.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-1">
                        {activeService.planName} • Node IP: {activeService.ipAddress} • {activeService.datacenter}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <span>Manage Service &amp; Git Pipelines</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 4 Telemetry Boxes with strict vertical layout & zero wrapping */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Disk Quota */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 flex flex-col gap-1.5">
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                        NVMe Disk Quota:
                      </span>
                      <strong className="text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums text-base font-bold">
                        {activeService.diskUsedGB} GB / {activeService.diskLimitGB} GB
                      </strong>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden mt-1">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${(activeService.diskUsedGB / Math.max(1, activeService.diskLimitGB)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 text-right">
                        {Math.round((activeService.diskUsedGB / Math.max(1, activeService.diskLimitGB)) * 100)}% Used
                      </span>
                    </div>

                    {/* Inodes Count */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 flex flex-col gap-1.5">
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                        Inodes Count:
                      </span>
                      <strong className="text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums text-base font-bold">
                        {activeService.inodesUsed.toLocaleString()} / {activeService.inodeLimit.toLocaleString()}
                      </strong>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden mt-1">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(activeService.inodesUsed / Math.max(1, activeService.inodeLimit)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 text-right">
                        {Math.round((activeService.inodesUsed / Math.max(1, activeService.inodeLimit)) * 100)}% Used
                      </span>
                    </div>

                    {/* RAM Allocation */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 flex flex-col gap-1.5">
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                        Isolated LVE RAM:
                      </span>
                      <strong className="text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums text-base font-bold">
                        {activeService.ramUsedMB} MB / {activeService.ramLimitMB} MB
                      </strong>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden mt-1">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${(activeService.ramUsedMB / Math.max(1, activeService.ramLimitMB)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 text-right">
                        {Math.round((activeService.ramUsedMB / Math.max(1, activeService.ramLimitMB)) * 100)}% Dedicated
                      </span>
                    </div>

                    {/* Runtime Engine */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 flex flex-col gap-1.5">
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                        Runtime Engine:
                      </span>
                      <strong className="text-blue-600 dark:text-blue-400 whitespace-nowrap font-mono text-base font-bold">
                        {activeService.nodeVersion}
                      </strong>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
                        Passenger Rolling Reload
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                        Active: 2.8s reload time
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Invoices Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>Recent Invoices</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('billing')}
                      className="text-xs font-mono text-blue-600 hover:underline cursor-pointer"
                    >
                      View all ({invoices.length})
                    </button>
                  </div>
                  <div className="space-y-2">
                    {invoices.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{inv.id}</div>
                          <div className="text-[11px] text-slate-400">{inv.date} • {inv.plan}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">৳{inv.amount}</div>
                          <span className={`text-[10px] font-bold ${inv.status === 'Paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Support Tickets Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LifeBuoy className="w-4 h-4 text-blue-600" />
                      <span>Support &amp; Engineering Tickets</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsNewTicketModalOpen(true)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
                    >
                      + Open Ticket
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tickets.slice(0, 3).map((tkt) => (
                      <div
                        key={tkt.id}
                        onClick={() => setActiveTab('support')}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 cursor-pointer hover:border-slate-300 dark:hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-zinc-100">
                          <span className="font-mono text-blue-600">{tkt.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-mono">
                            {tkt.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 truncate">
                          {tkt.subject}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 2: MY SERVICES & GIT DEPLOYMENTS (6 COMPREHENSIVE TABS)
             ========================================================================= */}
          {activeTab === 'services' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {services.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <Layers className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      No Hosting Services Active
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                      You do not have any provisioned instances right now. Deploy your first developer container with 1-click Git auto-deploy.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/#pricing"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-600/25"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Explore Cloud Hosting Plans</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* Service Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {services.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setActiveServiceId(srv.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                      activeService.id === srv.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-blue-400'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>{srv.domain}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>
                ))}
              </div>

              {/* Service Control Workspace Card */}
              <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden">
                {/* 6 Engineering Workspace Tabs */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-950/50 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setServiceSubTab('overview')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'overview'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Overview &amp; Power</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubTab('git')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'git'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Git CI/CD &amp; Runtime (.env)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubTab('databases')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'databases'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Databases &amp; Users</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubTab('domains_staging')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'domains_staging'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Subdomains &amp; Staging Cloner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubTab('backups')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'backups'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>JetBackup Snapshots (14-Day)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubTab('cron_logs')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      serviceSubTab === 'cron_logs'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Cron Jobs &amp; Real-Time Logs</span>
                  </button>
                </div>

                {/* Workspace Body */}
                <div className="p-6">
                  {/* ==========================================
                      SUBTAB 1: OVERVIEW & POWER CONTROLS
                     ========================================== */}
                  {serviceSubTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Server Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 text-xs font-mono">
                        <div>
                          <span className="text-slate-400">Server Node IP:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <strong className="text-slate-900 dark:text-white text-sm">{activeService.ipAddress}</strong>
                            <button
                              type="button"
                              onClick={() => triggerCopy(activeService.ipAddress, 'ip')}
                              className="text-slate-400 hover:text-blue-600 cursor-pointer"
                            >
                              {copiedKey === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400">Datacenter:</span>
                          <div className="text-slate-900 dark:text-white font-bold mt-1">
                            {activeService.datacenter}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400">cPanel Username:</span>
                          <div className="text-slate-900 dark:text-white font-bold mt-1">
                            {activeService.cpanelUser}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400">cPanel Security:</span>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setIsPasswordModalOpen(true)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold hover:bg-blue-100 cursor-pointer"
                            >
                              Reset Password
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400">1-Click Direct Access:</span>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={ssoLoading === 'cpaneld'}
                              onClick={() => handleLaunchSso(activeService.cpanelUser, 'cpaneld')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Instant 1-Click passwordless login to cPanel via WHM SSO API"
                            >
                              {ssoLoading === 'cpaneld' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ExternalLink className="w-3 h-3" />
                              )}
                              <span>1-Click cPanel SSO ↗</span>
                            </button>

                            <button
                              type="button"
                              disabled={ssoLoading === 'webmaild'}
                              onClick={() => handleLaunchSso(activeService.cpanelUser, 'webmaild')}
                              className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold hover:bg-indigo-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Instant 1-Click webmail session"
                            >
                              {ssoLoading === 'webmaild' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ExternalLink className="w-3 h-3" />
                              )}
                              <span>Webmail ↗</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Power Controls Bar */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                          Server Engine Power &amp; Cache Actions
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await restartPassengerWorkers(activeService.id);
                              alert('Passenger workers gracefully reloaded in 2.8s!');
                            }}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 hover:border-blue-500 transition-all text-left cursor-pointer group"
                          >
                            <RotateCcw className="w-4 h-4 text-blue-600 group-hover:rotate-180 transition-transform" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                              Restart Node / Passenger
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              Graceful rolling reload (zero dropped TCP)
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await flushLiteSpeedCache(activeService.id);
                              alert('LiteSpeed Edge Cache purged successfully!');
                            }}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 hover:border-emerald-500 transition-all text-left cursor-pointer group"
                          >
                            <Zap className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                              Flush LiteSpeed Cache
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              Purge Edge &amp; Redis object cache
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await cleanServiceCache(activeService.id);
                              alert('Temp files & node_modules/.cache flushed! Freed 250 MB.');
                            }}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 hover:border-amber-500 transition-all text-left cursor-pointer group"
                          >
                            <Trash2 className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                              Clean Temp &amp; npm Cache
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              Free up isolated NVMe storage
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              upgradeServicePlan(activeService.id, 'Business Max Cloud', 900);
                              alert('Service upgraded to Business Max (15 GB NVMe / 4 GB RAM)!');
                            }}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 hover:border-indigo-500 transition-all text-left cursor-pointer group"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                              Upgrade to Business Max
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              Instant double RAM &amp; CPU cores
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==========================================
                      SUBTAB 4: SUBDOMAINS, STAGING & AUTOSSL
                     ========================================== */}
                  {serviceSubTab === 'domains_staging' && (
                    <div className="space-y-6">
                      {/* Quota-Enforced Multi-Tenant Addon Domain & Subdomain Manager */}
                      <HostingAddonManager
                        serviceId={activeService.id}
                        serviceDomain={activeService.domain}
                        cpanelUsername={activeService.cpanelUser}
                      />
                      {/* 1-Click Staging Cloner Bar */}
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-mono font-semibold">
                              <Sparkles className="w-3 h-3" />
                              <span>Isolated Staging Sandbox</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                              1-Click Clone to staging.{activeService.domain}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-zinc-400">
                              Duplicate your live database, files, and Passenger container to safely test code.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCloneStagingTrigger}
                              disabled={isCloningStaging}
                              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {isCloningStaging ? 'Cloning Staging...' : 'Clone Production to Staging'}
                            </button>
                            <button
                              type="button"
                              onClick={handlePushStagingLiveTrigger}
                              disabled={isPushingLive}
                              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {isPushingLive ? 'Merging...' : 'Push Staging to Live'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Add Subdomain Form */}
                      <form
                        onSubmit={handleCreateSubdomainSubmit}
                        className="p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-950/40 space-y-4"
                      >
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Plus className="w-4 h-4 text-blue-600" />
                          <span>Create New Subdomain or Addon VHost</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-mono text-slate-500">Subdomain Prefix:</label>
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="text"
                                value={newSubdomainName}
                                onChange={(e) => setNewSubdomainName(e.target.value)}
                                placeholder="api"
                                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                                required
                              />
                              <span className="text-xs font-mono text-slate-500">.{activeService.domain}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-mono text-slate-500">Document Root Directory:</label>
                            <div className="mt-1">
                              <input
                                type="text"
                                value={newSubdomainDocRoot}
                                onChange={(e) => setNewSubdomainDocRoot(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            Create Subdomain &amp; Issue AutoSSL
                          </button>
                        </div>
                      </form>

                      {/* Subdomains & AutoSSL Shield Table */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                          Subdomains &amp; TLS 1.3 AutoSSL Status
                        </h4>
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                          {subdomains
                            .filter((s) => s.serviceId === activeService.id)
                            .map((sub) => (
                              <div
                                key={sub.id}
                                className="p-4 bg-white dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-600" />
                                    <strong className="text-slate-900 dark:text-white">{sub.subdomain}</strong>
                                    {sub.isStaging && (
                                      <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 text-[10px] font-bold">
                                        STAGING
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    Root: {sub.documentRoot}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                                    <Shield className="w-3 h-3" />
                                    <span>TLS 1.3 Active</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => toggleSubdomainForceHttps(sub.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                      sub.forceHttps
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300'
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-transparent'
                                    }`}
                                  >
                                    Force HTTPS: {sub.forceHttps ? 'ON' : 'OFF'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await renewAutoSsl(sub.id);
                                      alert(`AutoSSL certificate successfully re-issued for ${sub.subdomain}!`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Renew AutoSSL Now
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteSubdomain(sub.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==========================================
                      SUBTABS 2, 3, 5, 6: VERCEL & CPANEL PROJECT CONTROLS STUDIO
                     ========================================== */}
                  {serviceSubTab !== 'overview' && serviceSubTab !== 'domains_staging' && (
                    <HostingProjectControlStudio
                      serviceId={activeService.id}
                      serviceDomain={activeService.domain}
                      cpanelUser={activeService.cpanelUser}
                      serverIp={activeService.ipAddress}
                      activeTab={serviceSubTab}
                      onTabChange={(t) => setServiceSubTab(t)}
                    />
                  )}
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* =========================================================================
              MODULE 3: DOMAINS & DNS REGISTRAR SUITE (5-TAB DRAWER & BULK ACTIONS)
             ========================================================================= */}
          {activeTab === 'domains' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Domain Portfolio &amp; Registrar Suite
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Cloudflare-grade DNS zones, Glue Records, WHOIS shield &amp; EPP code management
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransferInModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Transfer In Existing Domain</span>
                </button>
              </div>

              {domains.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      No Domains Registered
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                      Search and register your ideal domain with instant DNS activation, free WHOIS privacy, and DNSSEC protection.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/domains"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-600/25"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register New Domain</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsTransferInModalOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-200 font-semibold text-sm transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Transfer In Domain</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>

              {/* Floating Bulk Action Bar (when domains selected) */}
              {selectedDomainIds.length > 0 && (
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    <span>{selectedDomainIds.length} Domain(s) Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkAutoRenew(true)}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 font-semibold cursor-pointer"
                    >
                      Bulk Auto-Renew ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBulkNsModalOpen(true)}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                    >
                      Bulk Change Nameservers
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDomainIds([])}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Domain Master Table */}
              <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                {domains.map((dom) => {
                  const isChecked = selectedDomainIds.includes(dom.id);
                  return (
                    <div
                      key={dom.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (isChecked) setSelectedDomainIds((prev) => prev.filter((id) => id !== dom.id));
                            else setSelectedDomainIds((prev) => [...prev, dom.id]);
                          }}
                          className="text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-slate-900 dark:text-white">{dom.domain}</strong>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dom.status === 'Active'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-950 text-amber-600'
                            }`}>
                              {dom.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Expires: {dom.expiryDate} ({dom.daysRemaining} days left) • Nameservers: {dom.nameservers[0]}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Auto-Renew: <strong className={dom.autoRenew ? 'text-emerald-600' : 'text-slate-400'}>{dom.autoRenew ? 'ON' : 'OFF'}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDomainForDrawer(dom);
                            setDomainDrawerTab('nameservers');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          Manage DNS &amp; Zone →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          )}

          {/* =========================================================================
              MODULE 4: BILLING & PREPAID CLOUD WALLET
             ========================================================================= */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Wallet Summary Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-600/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-100 font-semibold">
                    Prepaid Cloud Balance
                  </span>
                  <div className="text-3xl font-extrabold font-mono mt-1">৳{walletBalanceBDT.toLocaleString()}</div>
                  <p className="text-xs text-emerald-100 mt-1">
                    Funds auto-deduct for instant renewals, domain transfers &amp; VPS expansion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs shadow-sm cursor-pointer"
                >
                  + Add Funds via bKash / Nagad
                </button>
              </div>

              {/* Invoices List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Itemized Invoice History</h3>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                  {invoices.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-mono bg-white dark:bg-zinc-950/40">
                      No invoices found. When you purchase hosting or domains, your itemized tax invoices will be listed here.
                    </div>
                  ) : (
                    invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 bg-white dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-900 dark:text-white">{inv.id}</strong>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-500'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Date: {inv.date} • Due: {inv.dueDate} • Gateway: {inv.paymentMethod} (Trx: {inv.trxID})
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <strong className="text-base text-slate-900 dark:text-white">৳{inv.amount}</strong>
                        {inv.status === 'Unpaid' && (
                          <button
                            type="button"
                            onClick={() => payInvoice(inv.id)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                          >
                            Pay from Wallet
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="Print / Save PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 5: SUPPORT TICKETS & ENGINEERING HELP
             ========================================================================= */}
          {activeTab === 'support' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Support &amp; Engineering Desk</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Direct communication with senior DevOps engineers on Singapore &amp; USA nodes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  + Open New Ticket
                </button>
              </div>

              {/* Tickets Accordion */}
              <div className="space-y-3">
                {tickets.map((tkt) => (
                  <div
                    key={tkt.id}
                    className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 text-xs">#{tkt.id}</span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{tkt.subject}</h4>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                          Dept: {tkt.department} • Priority: {tkt.priority} • Last update: {tkt.lastUpdated}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold w-fit ${
                        tkt.status === 'Resolved'
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-600'
                      }`}>
                        {tkt.status}
                      </span>
                    </div>

                    {/* Thread Messages */}
                    <div className="space-y-3">
                      {tkt.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded-xl text-xs ${
                            msg.sender === 'client'
                              ? 'bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-zinc-200'
                              : 'bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-950 dark:text-blue-100'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                            <span>{msg.senderName}</span>
                            <span className="text-slate-400 font-mono font-normal">{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Input */}
                    {tkt.status !== 'Resolved' && (
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          value={ticketReplyInput[tkt.id] || ''}
                          onChange={(e) => setTicketReplyInput((prev) => ({ ...prev, [tkt.id]: e.target.value }))}
                          placeholder="Type your response to the engineer..."
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-sans text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = ticketReplyInput[tkt.id];
                            if (val && val.trim()) {
                              replyToTicket(tkt.id, val.trim(), 'client');
                              setTicketReplyInput((prev) => ({ ...prev, [tkt.id]: '' }));
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Send Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 6: AFFILIATE PROGRAM & PAYOUTS
             ========================================================================= */}
          {activeTab === 'affiliate' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* 1. Header Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-400">Available for Payout:</span>
                    <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      ৳{affiliate.availableBalanceBDT.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAffiliatePayoutModalOpen(true)}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Withdraw via bKash / Nagad</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pending 35-Day Hold:</span>
                    </span>
                    <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                      ৳{(affiliate.pendingClearanceBDT || 1575).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2">
                    Matures automatically after 30-day moneyback guarantee period.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <span className="text-xs font-mono text-slate-400">Total Lifetime Earned:</span>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    ৳{affiliate.totalEarnedBDT.toLocaleString()}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 font-mono">
                    Total Withdrawn: ৳6,000 BDT
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <span className="text-xs font-mono text-slate-400">Commission Tier:</span>
                  <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                    {affiliate.commissionRate || 25}% Recurring
                  </div>
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tier 2 (Pro Partner)</span>
                  </div>
                </div>
              </div>

              {/* 2. Auto-Scaling Tier Progress Bar */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span>Auto-Scaling Tier Progress</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Earned {affiliate.signups} active signups. 17 more referrals to unlock Tier 3 (30% Agency Commission).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Tier 2: 25% Active
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((affiliate.signups / 31) * 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Tier 1: 20% (1-10 Signups)</span>
                  <span className="text-blue-600 font-bold">Tier 2: 25% (11-30 Signups) ✓</span>
                  <span>Tier 3: 30% (31+ Signups)</span>
                </div>
              </div>

              {/* 3. Custom Campaign & Deep-Link Generator */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-blue-600" />
                    <span>Custom Campaign &amp; Deep-Link Generator</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate customized tracking URLs for specific landing pages and marketing channels with 90-day cookie retention.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Destination Landing Page:
                    </label>
                    <select
                      value={affiliateLanding}
                      onChange={(e) => setAffiliateLanding(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="/">Home Page (General Cloud Hosting)</option>
                      <option value="/nodejs-hosting">Node.js &amp; Next.js Git Hosting</option>
                      <option value="/wordpress-hosting-bangladesh">LiteSpeed WordPress Hosting</option>
                      <option value="/cloud-vps">Managed Cloud VPS Configurator</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Campaign Channel Sub-ID (subid):
                    </label>
                    <input
                      type="text"
                      value={affiliateSubId}
                      onChange={(e) => setAffiliateSubId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="e.g. youtube_bio, fb_group, blog_post"
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    >
                    </input>
                  </div>
                </div>

                {/* Generated Tracking Link Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Generated Partner Tracking URL:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">90-Day Cookie + Sub-ID Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://devhost.cloud${affiliateLanding}?ref=${affiliate.referralCode || 'hanif2026'}&subid=${affiliateSubId || 'general'}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        triggerCopy(
                          `https://devhost.cloud${affiliateLanding}?ref=${affiliate.referralCode || 'hanif2026'}&subid=${affiliateSubId || 'general'}`,
                          'gen_ref'
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      {copiedKey === 'gen_ref' ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Sub-ID Analytics & Funnel Breakdown Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Campaign Sub-ID Performance &amp; Conversion Funnel</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Live Attribution</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-mono">
                        <th className="pb-2">Channel Sub-ID</th>
                        <th className="pb-2">Target Channel</th>
                        <th className="pb-2">Total Clicks</th>
                        <th className="pb-2">Signups</th>
                        <th className="pb-2">Conversion Rate</th>
                        <th className="pb-2 text-right">Total Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                      {(affiliate.subIdStats || []).map((s) => (
                        <tr key={s.subId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 font-bold text-blue-600">{s.subId}</td>
                          <td className="py-2.5 text-slate-700 dark:text-zinc-300 font-sans">{s.channelName}</td>
                          <td className="py-2.5">{s.clicks}</td>
                          <td className="py-2.5 text-emerald-600 font-bold">{s.signups}</td>
                          <td className="py-2.5">{s.conversionRate}%</td>
                          <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                            ৳{s.totalEarningsBDT.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. 35-Day Hold Commissions Lifecycle Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Commissions Lifecycle &amp; 35-Day Anti-Refund Maturity</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Commissions automatically clear to your available balance after 35 days without refund clawback.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-mono">
                        <th className="pb-2">Order Date</th>
                        <th className="pb-2">Invoice / Domain</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Commission (25%)</th>
                        <th className="pb-2">Maturity Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                      {(affiliate.commissions || []).map((comm) => (
                        <tr key={comm.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 text-slate-500">{comm.date}</td>
                          <td className="py-3">
                            <span className="font-bold text-slate-900 dark:text-white">{comm.domain}</span>
                            <div className="text-[10px] text-slate-400">{comm.invoiceId} • {comm.subId}</div>
                          </td>
                          <td className="py-3 text-slate-500">{comm.customerMasked}</td>
                          <td className="py-3">৳{comm.orderAmountBDT}</td>
                          <td className="py-3 font-bold text-emerald-600 dark:text-emerald-400">
                            ৳{comm.commissionBDT}
                          </td>
                          <td className="py-3">
                            {comm.status === 'pending_35d_hold' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 w-fit">
                                <Clock className="w-3 h-3" />
                                <span>{comm.daysLeftToMature} days left to mature</span>
                              </span>
                            )}
                            {comm.status === 'cleared_available' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Cleared &amp; Available</span>
                              </span>
                            )}
                            {comm.status === 'clawed_back_refunded' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Refunded / Clawed Back</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. Ready-to-Use Promotional Banners & Social Copy Kit */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Ready-to-Use Promotional Banners &amp; Social Copy Kit</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-Click copy high-converting ad copy and embed standard promotional banners on your blog or website.
                  </p>
                </div>

                {/* Social Ad Copy Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">বাংলা সোশ্যাল পোস্ট কপি (Facebook/LinkedIn)</span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCopy(
                            `🚀 বাংলাদেশে সবচেয়ে ফাস্ট ও সাশ্রয়ী Next.js/Node.js এবং WordPress হোস্টিং খুঁজছেন? DevHost Cloud-এ পাচ্ছেন 1-Click cPanel SSO, লাইটস্পিড ক্যাশ এবং ফ্রি SSL! এখনই চেক করুন: https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}`,
                            'copy_bn'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        {copiedKey === 'copy_bn' ? 'Copied!' : 'Copy Bangla Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed font-sans">
                      🚀 বাংলাদেশে সবচেয়ে ফাস্ট ও সাশ্রয়ী Next.js/Node.js এবং WordPress হোস্টিং খুঁজছেন? DevHost Cloud-এ পাচ্ছেন 1-Click cPanel SSO, লাইটস্পিড ক্যাশ এবং ফ্রি SSL! এখনই চেক করুন: https://devhost.cloud/?ref={affiliate.referralCode || 'hanif2026'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">English Ad Copy (YouTube/X/Blog)</span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCopy(
                            `⚡ Deploy your Next.js and WordPress apps in seconds with automated GitHub Actions, LiteSpeed NVMe Turbo, and instant bKash activation: https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}`,
                            'copy_en'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        {copiedKey === 'copy_en' ? 'Copied!' : 'Copy English Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed font-sans">
                      ⚡ Deploy your Next.js and WordPress apps in seconds with automated GitHub Actions, LiteSpeed NVMe Turbo, and instant bKash activation: https://devhost.cloud/?ref={affiliate.referralCode || 'hanif2026'}
                    </p>
                  </div>
                </div>

                {/* Banner Embed Codes */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-2">
                    <button
                      type="button"
                      onClick={() => setBannerTab('728x90')}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg cursor-pointer ${
                        bannerTab === '728x90' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      728x90 Leaderboard Banner
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerTab('300x250')}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg cursor-pointer ${
                        bannerTab === '300x250' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      300x250 Medium Rectangle
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerTab('1200x630')}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg cursor-pointer ${
                        bannerTab === '1200x630' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      1200x630 Social Card
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 font-mono text-[11px] text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                    <code className="truncate max-w-xl">
                      {bannerTab === '728x90' &&
                        `<a href="https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}"><img src="https://devhost.cloud/banners/devhost-728x90.png" alt="DevHost Cloud" width="728" height="90"/></a>`}
                      {bannerTab === '300x250' &&
                        `<a href="https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}"><img src="https://devhost.cloud/banners/devhost-300x250.png" alt="DevHost Cloud" width="300" height="250"/></a>`}
                      {bannerTab === '1200x630' &&
                        `<a href="https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}"><img src="https://devhost.cloud/banners/devhost-1200x630.png" alt="DevHost Cloud" width="1200" height="630"/></a>`}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        triggerCopy(
                          `<a href="https://devhost.cloud/?ref=${affiliate.referralCode || 'hanif2026'}"><img src="https://devhost.cloud/banners/devhost-${bannerTab}.png" alt="DevHost Cloud"/></a>`,
                          'embed'
                        )
                      }
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-xs font-semibold cursor-pointer shrink-0 ml-2"
                    >
                      {copiedKey === 'embed' ? 'Copied!' : 'Copy Embed Code'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Affiliate Profile & S2S Postback Settings */}
              <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                <AffiliateProfileView />
              </div>
            </div>
          )}

          {/* =========================================================================
              MODAL: AFFILIATE PAYOUT REQUEST
             ========================================================================= */}
          {isAffiliatePayoutModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <span>Request Affiliate Payout</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAffiliatePayoutModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">Available Balance for Withdrawal:</span>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ৳{affiliate.availableBalanceBDT.toLocaleString()} BDT
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Minimum payout threshold: ৳1,000 BDT</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Payout Method:
                    </label>
                    <select
                      value={affiliatePayoutMethod}
                      onChange={(e) => setAffiliatePayoutMethod(e.target.value as any)}
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
                    >
                      <option value="bKash">bKash (Personal or Merchant)</option>
                      <option value="Nagad">Nagad Personal</option>
                      <option value="Bank">Bank Wire Transfer (City Bank / Dutch-Bangla)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Account / Mobile Number:
                    </label>
                    <input
                      type="text"
                      value={affiliatePayoutAccount}
                      onChange={(e) => setAffiliatePayoutAccount(e.target.value)}
                      placeholder="e.g. 01712-345678 or Account No"
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Withdrawal Amount (BDT):
                    </label>
                    <input
                      type="number"
                      min={1000}
                      max={affiliate.availableBalanceBDT}
                      value={affiliatePayoutAmount}
                      onChange={(e) => setAffiliatePayoutAmount(Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAffiliatePayoutModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={affiliatePayoutAmount > affiliate.availableBalanceBDT || affiliatePayoutAmount < 1000}
                    onClick={() => {
                      const success = requestAffiliatePayout(affiliatePayoutAmount, affiliatePayoutMethod, affiliatePayoutAccount);
                      if (success) {
                        setIsAffiliatePayoutModalOpen(false);
                        alert(`Payout request of ৳${affiliatePayoutAmount} submitted! Funds will be disbursed within 24 hours.`);
                      } else {
                        alert('Insufficient available balance');
                      }
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Confirm Withdrawal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 7: SECURITY & SSH KEYS
             ========================================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* SSH Keys */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>Jailed SSH Public Keys (ED25519 &amp; RSA)</span>
                </h3>
                <textarea
                  value={sshKeyInput}
                  onChange={(e) => setSshKeyInput(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
                />
                <button
                  type="button"
                  onClick={() => {
                    updateServiceSshKey(activeService.id, sshKeyInput);
                    alert('SSH public key successfully updated for this container!');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save SSH Key
                </button>
              </div>

              {/* API Tokens */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Deployment API Tokens</h3>
                <div className="space-y-2">
                  {apiTokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{tok.name}</div>
                        <div className="text-[11px] text-slate-400">{tok.prefix} • {tok.permissions}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => revokeApiToken(tok.id)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 8: DEDICATED CUSTOMER / DEVELOPER PROFILE & CORPORATE VAT / BIN
             ========================================================================= */}
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-150">
              <CustomerProfileView />
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          5-TAB ADVANCED DOMAIN MANAGEMENT DRAWER
         ========================================================================= */}
      {selectedDomainForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDomainForDrawer(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedDomainForDrawer.domain}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Cloudflare-grade DNS zones, Glue Records &amp; URL Forwarding
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDomainForDrawer(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-Tabs Nav */}
              <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-zinc-900/40 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setDomainDrawerTab('nameservers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainDrawerTab === 'nameservers' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Nameservers
                </button>
                <button
                  type="button"
                  onClick={() => setDomainDrawerTab('dns')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainDrawerTab === 'dns' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  DNS Zone Editor
                </button>
                <button
                  type="button"
                  onClick={() => setDomainDrawerTab('child_ns')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainDrawerTab === 'child_ns' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Glue / Child NS
                </button>
                <button
                  type="button"
                  onClick={() => setDomainDrawerTab('whois_lock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainDrawerTab === 'whois_lock' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  WHOIS &amp; EPP Lock
                </button>
                <button
                  type="button"
                  onClick={() => setDomainDrawerTab('redirects')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainDrawerTab === 'redirects' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  301/302 Redirects
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Nameservers */}
                {domainDrawerTab === 'nameservers' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                        Global Anycast Nameservers
                      </h4>
                      <div className="space-y-2">
                        <input
                          type="text"
                          defaultValue={selectedDomainForDrawer.nameservers[0] || 'ns1.devhost.cloud'}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                        <input
                          type="text"
                          defaultValue={selectedDomainForDrawer.nameservers[1] || 'ns2.devhost.cloud'}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => alert('Nameservers saved! Propagation will complete in 2-4 hours.')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Save Nameservers
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. DNS Zone Editor */}
                {domainDrawerTab === 'dns' && (
                  <div className="space-y-4">
                    <DnsZoneManager
                      domainId={selectedDomainForDrawer.id}
                      domainName={selectedDomainForDrawer.domain}
                      serverIp={activeService?.ipAddress || '103.151.102.45'}
                      initialRecords={selectedDomainForDrawer.dnsRecords}
                    />
                  </div>
                )}

                {/* 3. Glue Records / Child Nameservers */}
                {domainDrawerTab === 'child_ns' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                        Register Child Nameserver (Glue Record)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Create custom agency nameservers like ns1.{selectedDomainForDrawer.domain} pointing to your server IP.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newChildNsHost}
                          onChange={(e) => setNewChildNsHost(e.target.value)}
                          placeholder={`ns1.${selectedDomainForDrawer.domain}`}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={newChildNsIp}
                          onChange={(e) => setNewChildNsIp(e.target.value)}
                          placeholder="103.145.22.40"
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newChildNsHost.trim()) {
                            createChildNameserver(selectedDomainForDrawer.id, newChildNsHost.trim(), newChildNsIp.trim());
                            setNewChildNsHost('');
                            alert('Child Nameserver successfully registered with registry!');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Register Glue Record
                      </button>
                    </div>

                    {/* Active Glue Records */}
                    <div className="space-y-2">
                      {childNameservers
                        .filter((c) => c.domainId === selectedDomainForDrawer.id)
                        .map((cns) => (
                          <div
                            key={cns.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-950/40 flex items-center justify-between text-xs font-mono"
                          >
                            <div>
                              <strong className="text-slate-900 dark:text-white">{cns.hostname}</strong>
                              <span className="text-slate-500 ml-2">→ {cns.ipAddress}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteChildNameserver(cns.id)}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 4. WHOIS Privacy & EPP */}
                {domainDrawerTab === 'whois_lock' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">WHOIS ID Protection Shield</div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Mask your name, email and phone from public ICANN lookup</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDomainWhoisPrivacy(selectedDomainForDrawer.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          selectedDomainForDrawer.whoisPrivacy ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selectedDomainForDrawer.whoisPrivacy ? 'Protected' : 'Disabled'}
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Registrar Theft Lock</div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Prevent unauthorized domain transfers to other registrars</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDomainForDrawer.registrarLock) {
                            requireSudo(
                              () => toggleDomainLock(selectedDomainForDrawer.id),
                              'Unlock Domain Registrar Protection'
                            );
                          } else {
                            toggleDomainLock(selectedDomainForDrawer.id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          selectedDomainForDrawer.registrarLock ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selectedDomainForDrawer.registrarLock ? 'Locked' : 'Unlocked'}
                      </button>
                    </div>

                    {/* EPP Code Box */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">EPP / Auth Transfer Code</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={revealedEpp ? selectedDomainForDrawer.eppCode : '••••••••••••••••'}
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!revealedEpp) {
                              requireSudo(() => setRevealedEpp(true), 'Reveal Domain EPP / Auth Transfer Code');
                            } else {
                              setRevealedEpp(false);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 text-xs font-semibold cursor-pointer"
                        >
                          {revealedEpp ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. URL Redirects */}
                {domainDrawerTab === 'redirects' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                        Create 301 / 302 URL Forwarding Rule
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={newRedirectSource}
                          onChange={(e) => setNewRedirectSource(e.target.value)}
                          placeholder="/path"
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={newRedirectTarget}
                          onChange={(e) => setNewRedirectTarget(e.target.value)}
                          placeholder="https://destination.com"
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        />
                        <select
                          value={newRedirectType}
                          onChange={(e) => setNewRedirectType(e.target.value as any)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                        >
                          <option value="301">301 Permanent</option>
                          <option value="302">302 Temporary</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newRedirectTarget.trim()) {
                            createDomainRedirect(selectedDomainForDrawer.id, newRedirectSource, newRedirectTarget, newRedirectType);
                            alert('URL redirect rule created!');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Add Forwarding Rule
                      </button>
                    </div>

                    <div className="space-y-2">
                      {domainRedirects
                        .filter((r) => r.domainId === selectedDomainForDrawer.id)
                        .map((red) => (
                          <div
                            key={red.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-950/40 flex items-center justify-between text-xs font-mono"
                          >
                            <div>
                              <span className="text-blue-600 font-bold mr-2">{red.type}</span>
                              <span className="text-slate-900 dark:text-white">{red.sourcePath}</span>
                              <span className="text-slate-400 mx-2">→</span>
                              <span className="text-slate-600 dark:text-zinc-400">{red.targetUrl}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteDomainRedirect(red.id)}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DOMAIN TRANSFER-IN WORKFLOW
         ========================================================================= */}
      {isTransferInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleTransferInSubmit}
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Transfer Domain to DevHost</h3>
              <button
                type="button"
                onClick={() => setIsTransferInModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Includes 1-Year Free Domain Extension + Anycast DNS + WHOIS Privacy Protection
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-500">Domain to Transfer:</label>
                <input
                  type="text"
                  value={transferDomainInput}
                  onChange={(e) => setTransferDomainInput(e.target.value)}
                  placeholder="e.g. my-app.com"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-500">EPP / Auth Code from current registrar:</label>
                <input
                  type="text"
                  value={transferEppInput}
                  onChange={(e) => setTransferEppInput(e.target.value)}
                  placeholder="EPP-xxxx-xxxx"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Initiate Transfer &amp; Verify EPP
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: JETBACKUP RESTORE PROGRESS SIMULATION
         ========================================================================= */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm {restoreModalData.type.toUpperCase()} Restore
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Restoring snapshot from <strong className="text-slate-900 dark:text-white">{restoreModalData.backup.date}</strong> to {activeService.domain}.
            </p>

            {isRestoring ? (
              <div className="space-y-3 py-3">
                <div className="flex items-center gap-2 text-xs font-mono text-blue-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {restoreProgressStep === 1 && '1. Fetching snapshot from AWS S3 SG Vault...'}
                    {restoreProgressStep === 2 && '2. Uncompressing tarball and verifying hashes...'}
                    {restoreProgressStep === 3 && '3. Restoring files / MySQL tables...'}
                    {restoreProgressStep === 4 && '4. Reloading passenger workers...'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${restoreProgressStep * 25}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreModalData(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Start Restore
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PHPMYADMIN SSO SIMULATION
         ========================================================================= */}
      {phpMyAdminModalDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  phpMyAdmin SSO — {phpMyAdminModalDb}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPhpMyAdminModalDb(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs space-y-2">
              <div>-- Connecting via secure single sign-on token...</div>
              <div>-- Host: 127.0.0.1:3306 (MySQL 8.0 InnoDB)</div>
              <div>-- Database: {phpMyAdminModalDb}</div>
              <div>-- Tables: 14 loaded (InnoDB Engine, utf8mb4_unicode_ci)</div>
              <div>-- Ready for SQL queries and schema inspection.</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPhpMyAdminModalDb(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close SSO Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TOP UP WALLET
         ========================================================================= */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Up Prepaid Cloud Wallet</h3>
              <button
                type="button"
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-500">Amount (BDT):</label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-slate-500">Gateway:</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setTopUpMethod('bKash')}
                    className={`p-2 rounded-xl border text-center font-bold cursor-pointer ${
                      topUpMethod === 'bKash' ? 'bg-pink-500 text-white border-pink-500' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    bKash Instant
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopUpMethod('Nagad')}
                    className={`p-2 rounded-xl border text-center font-bold cursor-pointer ${
                      topUpMethod === 'Nagad' ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Nagad Merchant
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-500">Mobile Number:</label>
                <input
                  type="text"
                  value={topUpPhone}
                  onChange={(e) => setTopUpPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                topUpWallet(topUpAmount, topUpMethod);
                setIsTopUpModalOpen(false);
                alert(`৳${topUpAmount} added to your Prepaid Cloud Wallet via ${topUpMethod}!`);
              }}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Confirm ৳{topUpAmount} Top-Up
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NEW SUPPORT TICKET
         ========================================================================= */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ticketSubject.trim() && ticketMessage.trim()) {
                createSupportTicket({
                  subject: ticketSubject.trim(),
                  department: ticketDept,
                  priority: ticketPriority,
                  relatedService: `${activeService.domain} (${activeService.planName})`,
                  message: ticketMessage.trim(),
                });
                setIsNewTicketModalOpen(false);
                setTicketSubject('');
                setTicketMessage('');
              }
            }}
            className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Open New Engineering Ticket</h3>
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-500">Subject:</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Issue configuring Custom Wildcard SSL"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-mono text-slate-500">Department:</label>
                  <select
                    value={ticketDept}
                    onChange={(e) => setTicketDept(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  >
                    <option value="Technical & DevOps Support">Technical &amp; DevOps</option>
                    <option value="Billing & Finance">Billing &amp; Finance</option>
                    <option value="Domain Registrar & DNS">Domain Registrar</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-500">Priority:</label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical — Production Site Down">Critical (Site Down)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-500">Message &amp; Error Details:</label>
                <textarea
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={4}
                  placeholder="Provide step-by-step details..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Submit Ticket to Engineering Desk
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET CPANEL PASSWORD
         ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset cPanel Password</h3>
            <p className="text-xs text-slate-500">
              User: <strong className="text-slate-900 dark:text-white font-mono">{activeService.cpanelUser}</strong>
            </p>
            <div>
              <label className="text-xs font-mono text-slate-500">Generated Strong Password:</label>
              <input
                type="text"
                value={newCpanelPass}
                onChange={(e) => setNewCpanelPass(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetCpanelPassword(activeService.id, newCpanelPass);
                  setIsPasswordModalOpen(false);
                  alert(`cPanel password for ${activeService.cpanelUser} reset to: ${newCpanelPass}`);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
