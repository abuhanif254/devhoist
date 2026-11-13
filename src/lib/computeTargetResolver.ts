// ==============================================================================
// DEVHOST CLOUD - SHARED COMPUTE TARGET & RUNTIME CONTEXT RESOLVER
// Resolves service metadata, linked node agent_endpoint, stack settings & .env vault
// ==============================================================================

import { getServiceSupabase } from '@/lib/supabase';
import { decryptEnvValue } from '@/lib/projectEngine';
import { getStackBlueprintBySlug, resolveStackSlug } from '@/lib/stackProvisioner';
import { WhmClient, whmClient } from '@/lib/whmClient';

type ServiceSupabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

export interface ResolvedComputeTarget {
  serviceId: string;
  userId: string;
  domain: string;
  cpanelUser: string;
  serverNode: string;
  agentEndpoint: string | null;
  nodeDriver: string;
  stackSlug: string;
  runtimeFamily: string;
  runtimeVersion: string;
  installCommand: string;
  buildCommand: string;
  startupFile: string;
  outputDirectory: string;
  gitRepoUrl: string;
  gitBranch: string;
  containerId: string | null;
  deploymentMode: string | null;
  livePreviewUrl: string | null;
  status: string;
  ramLimitMb: number;
  cpuCores: number;
  diskLimitGb: number;
  whmHost: string | null;
  whmUsername: string | null;
  whmApiToken: string | null;
}

export async function resolveServiceComputeTarget(
  supabaseAdmin: ServiceSupabase | null,
  serviceId: string,
  fallbackUserId = ''
): Promise<ResolvedComputeTarget> {
  if (!supabaseAdmin) {
    const bp = getStackBlueprintBySlug('nextjs-15-standalone');
    return {
      serviceId,
      userId: fallbackUserId,
      domain: 'sandbox-app.devhost.cloud',
      cpanelUser: 'dvhst01',
      serverNode: 'sg1',
      agentEndpoint: null,
      nodeDriver: 'devhost_docker',
      stackSlug: bp?.slug || 'nextjs-15-standalone',
      runtimeFamily: bp?.runtime_family || 'nodejs_passenger',
      runtimeVersion: bp?.default_runtime_version || '22.x LTS',
      installCommand: bp?.install_command || 'npm ci',
      buildCommand: bp?.build_command || 'npm run build',
      startupFile: bp?.startup_entry_file || 'server.js',
      outputDirectory: bp?.document_root_subpath || '.next/standalone',
      gitRepoUrl: 'https://github.com/devhost-templates/nextjs-15-standalone.git',
      gitBranch: 'main',
      containerId: null,
      deploymentMode: 'sandbox',
      livePreviewUrl: 'https://sandbox-app.devhost.cloud',
      status: 'active',
      ramLimitMb: 2048,
      cpuCores: 2,
      diskLimitGb: 5,
      whmHost: null,
      whmUsername: null,
      whmApiToken: null,
    };
  }

  const { data: srv } = await supabaseAdmin
    .from('hosting_services')
    .select('*')
    .eq('id', serviceId)
    .maybeSingle();

  const serverNode = String(srv?.server_node || 'sg1');
  const { data: nodeRow } = await supabaseAdmin
    .from('whm_server_nodes')
    .select('node_code, agent_endpoint, node_driver, whm_hostname, whm_username, whm_api_token_encrypted')
    .eq('node_code', serverNode)
    .maybeSingle();

  let decryptedWhmToken: string | null = null;
  if (nodeRow?.whm_api_token_encrypted && typeof nodeRow.whm_api_token_encrypted === 'string') {
    try {
      decryptedWhmToken = await decryptEnvValue(nodeRow.whm_api_token_encrypted);
    } catch {
      decryptedWhmToken = null;
    }
  }

  const { data: settingsRow } = await supabaseAdmin
    .from('hosting_project_settings')
    .select('*')
    .eq('service_id', serviceId)
    .maybeSingle();

  const resolvedSlug = resolveStackSlug(
    String(settingsRow?.stack_slug || srv?.stack_slug || 'nextjs-15-standalone')
  );
  const blueprint = getStackBlueprintBySlug(resolvedSlug);

  return {
    serviceId,
    userId: String(srv?.user_id || fallbackUserId),
    domain: String(srv?.domain || 'app.devhost.cloud'),
    cpanelUser: String(srv?.cpanel_username || 'dvhst'),
    serverNode,
    agentEndpoint: (nodeRow?.agent_endpoint as string | null | undefined) || null,
    nodeDriver: String(nodeRow?.node_driver || 'whm_cpanel'),
    stackSlug: resolvedSlug,
    runtimeFamily: String(srv?.runtime_family || blueprint?.runtime_family || 'nodejs_passenger'),
    runtimeVersion: String(settingsRow?.runtime_version || blueprint?.default_runtime_version || '22.x LTS'),
    installCommand: String(settingsRow?.install_command || blueprint?.install_command || 'npm ci'),
    buildCommand: String(settingsRow?.build_command || blueprint?.build_command || 'npm run build'),
    startupFile: String(settingsRow?.startup_file || blueprint?.startup_entry_file || 'server.js'),
    outputDirectory: String(settingsRow?.output_directory || blueprint?.document_root_subpath || '.next/standalone'),
    gitRepoUrl: String(settingsRow?.git_repo_url || `https://github.com/devhost-templates/${resolvedSlug}.git`),
    gitBranch: String(settingsRow?.production_branch || 'main'),
    containerId: (srv?.container_id as string | null | undefined) || null,
    deploymentMode: (srv?.deployment_mode as string | null | undefined) || null,
    livePreviewUrl: (srv?.live_preview_url as string | null | undefined) || null,
    status: String(srv?.status || 'active'),
    ramLimitMb: Number(srv?.ram_limit_mb ?? srv?.ram_mb ?? 2048),
    cpuCores: Number(srv?.cpu_cores ?? 2),
    diskLimitGb: Number(srv?.disk_limit_gb ?? 5),
    whmHost: (nodeRow?.whm_hostname as string | null | undefined) || null,
    whmUsername: (nodeRow?.whm_username as string | null | undefined) || null,
    whmApiToken: decryptedWhmToken,
  };
}

/**
 * Instantiate a WHM client using decrypted per-node credentials when present,
 * falling back cleanly to the singleton WHM_HOST/WHM_API_TOKEN env client.
 */
export function resolveWhmClientForTarget(target: ResolvedComputeTarget): WhmClient {
  if (target.whmHost && target.whmApiToken) {
    return WhmClient.forNode({
      host: target.whmHost,
      username: target.whmUsername || 'root',
      apiToken: target.whmApiToken,
    });
  }
  return whmClient;
}

export async function loadDecryptedEnvMap(
  supabaseAdmin: ServiceSupabase | null,
  serviceId: string,
  targetEnvironment = 'production'
): Promise<Record<string, string>> {
  if (!supabaseAdmin) return {};

  const { data: rows } = await supabaseAdmin
    .from('project_env_variables')
    .select('env_key, encrypted_value, target_environment')
    .eq('service_id', serviceId)
    .eq('target_environment', targetEnvironment);

  const envMap: Record<string, string> = {};
  if (!Array.isArray(rows)) return envMap;

  for (const row of rows) {
    if (!row?.env_key || !row?.encrypted_value) continue;
    try {
      envMap[String(row.env_key)] = await decryptEnvValue(String(row.encrypted_value));
    } catch {
      // Skip unreadable entries gracefully
    }
  }

  return envMap;
}
