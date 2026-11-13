import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const DEFAULT_PORT = Number(process.env.AGENT_PORT || process.env.PORT || 8787);
const DEFAULT_BIND_HOST = process.env.AGENT_BIND_HOST || '0.0.0.0';
const DEFAULT_WORK_ROOT =
  process.env.WORKSPACES_ROOT || process.env.DEVHOST_WORK_ROOT || '/var/devhost/apps';
const BACKUP_ROOT = process.env.DEVHOST_BACKUP_ROOT || '/var/devhost/backups';
const CADDY_SITES_DIR = process.env.CADDY_SITES_DIR || '/etc/caddy/conf.d';
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const CONTAINER_NON_ROOT_USER = '10001:10001';

const SHELL_METACHAR_REGEX = /[;|&$`<>(){}'"`\\\r\n\0]/;
const SAFE_SQL_IDENTIFIER_REGEX = /^[a-z][a-z0-9_]{1,62}$/;
const SAFE_RELEASE_ID_REGEX = /^[a-zA-Z0-9._-]{1,64}$/;
const SAFE_OCTAL_MODE_REGEX = /^[0-7]{3,4}$/;
const SAFE_IP_OR_CIDR_REGEX =
  /^(?:%|localhost|(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(?:\/(?:[0-9]|[12]\d|3[0-2]))?|(?:[0-9a-fA-F:]+)(?:\/(?:[0-9]|[1-9]\d|1[0-1]\d|12[0-8]))?)$/;

const ALLOWED_COMMAND_BINARIES = new Set([
  'ls',
  'pwd',
  'whoami',
  'id',
  'cat',
  'head',
  'tail',
  'grep',
  'find',
  'stat',
  'du',
  'df',
  'env',
  'printenv',
  'uname',
  'ps',
  'free',
  'node',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'php',
  'composer',
  'python3',
  'pip',
  'pip3',
  'git',
  'next',
  'vite',
  'tsc',
  'prisma',
]);

const ALLOWED_BUILD_BINARIES = new Set([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'composer',
  'pip',
  'pip3',
  'python3',
  'next',
  'vite',
  'tsc',
  'prisma',
  'npx',
]);

const DISALLOWED_COMMAND_FLAGS = new Set([
  '-e',
  '--eval',
  '-c',
  '--exec',
  '-p',
  '--print',
  '-r',
  '--require',
  '--upload-pack',
]);

export class AgentValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AgentValidationError';
    this.statusCode = statusCode;
  }
}

export function safeIdentifier(input, fallback = 'app') {
  const clean = String(input || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return clean || fallback;
}

export function containerNameFor(cpanelUser, serviceId) {
  const userPart = safeIdentifier(cpanelUser, 'tenant').slice(0, 20);
  const servicePart = safeIdentifier(serviceId, 'svc').slice(0, 8);
  return `dh_${userPart}_${servicePart}`;
}

export function validateSqlIdentifier(raw, label = 'identifier') {
  const val = String(raw || '').trim().toLowerCase();
  if (!SAFE_SQL_IDENTIFIER_REGEX.test(val)) {
    throw new AgentValidationError(
      `Invalid ${label}: must match ^[a-z][a-z0-9_]{1,62}$`
    );
  }
  return val;
}

export function validateSubpath(rawPath, fallback = '/public') {
  const val = String(rawPath ?? fallback).trim() || fallback;
  if (
    SHELL_METACHAR_REGEX.test(val) ||
    val.includes('..') ||
    /\s/.test(val) ||
    !/^\/?[a-zA-Z0-9._/-]*$/.test(val)
  ) {
    throw new AgentValidationError(
      `Unsafe or invalid documentRoot path rejected: "${val}"`
    );
  }
  const normalized = val.startsWith('/') ? val : `/${val}`;
  return normalized === '/' ? '' : normalized.replace(/\/+$/, '');
}

export function validateStartupEntry(rawStartup, runtimeFamily) {
  const fallback =
    runtimeFamily === 'python'
      ? 'main:app'
      : runtimeFamily === 'php_litespeed'
        ? 'index.php'
        : 'server.js';
  const val = String(rawStartup ?? fallback).trim() || fallback;
  if (SHELL_METACHAR_REGEX.test(val) || val.includes('..')) {
    throw new AgentValidationError(`Unsafe startupFile rejected: "${val}"`);
  }

  if (runtimeFamily === 'nodejs') {
    if (val === 'npm run start' || val === 'npm start') {
      return ['npm', 'run', 'start'];
    }
    if (!/^[a-zA-Z0-9._/-]+\.(?:js|mjs|cjs)$/.test(val)) {
      throw new AgentValidationError(
        `Invalid Node.js startupFile: must be a relative .js/.mjs/.cjs file or "npm run start"`
      );
    }
    return ['node', val.replace(/^\/+/, '')];
  }

  if (runtimeFamily === 'python') {
    if (/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_]+$/.test(val)) {
      return { mode: 'uvicorn', target: val };
    }
    if (/^[a-zA-Z0-9._/-]+\.py$/.test(val)) {
      return { mode: 'script', target: val.replace(/^\/+/, '') };
    }
    throw new AgentValidationError(
      `Invalid Python startupFile: must be module:app or a relative .py script`
    );
  }

  if (runtimeFamily === 'php_litespeed') {
    if (!/^[a-zA-Z0-9._/-]+$/.test(val)) {
      throw new AgentValidationError(`Invalid PHP startupFile`);
    }
    return ['php'];
  }

  return ['node', 'server.js'];
}

export function parseSafeBuildCommand(rawCmd, defaultTokens, mode = 'build') {
  const input = String(rawCmd ?? '').trim();
  if (!input) {
    return defaultTokens;
  }

  if (SHELL_METACHAR_REGEX.test(input)) {
    throw new AgentValidationError(
      `Command rejected: shell metacharacters are not permitted (${mode}).`
    );
  }

  const tokens = input.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 16) {
    throw new AgentValidationError(`Command rejected: invalid token count.`);
  }

  const bin = tokens[0];
  const allowSet = mode === 'runtime' ? ALLOWED_COMMAND_BINARIES : ALLOWED_BUILD_BINARIES;
  if (!allowSet.has(bin)) {
    throw new AgentValidationError(
      `Command binary "${bin}" is not in the ${mode} allowlist.`,
      403
    );
  }

  for (const arg of tokens.slice(1)) {
    if (arg.includes('..')) {
      throw new AgentValidationError(`Path traversal ".." not allowed in arguments.`, 403);
    }
    const lowerArg = arg.toLowerCase();
    if (DISALLOWED_COMMAND_FLAGS.has(lowerArg.split('=')[0])) {
      throw new AgentValidationError(`Disallowed inline code execution flag "${arg}".`, 403);
    }
  }

  return tokens;
}

export function validateTypedAgentCommand(rawCmd) {
  const tokens = parseSafeBuildCommand(rawCmd, [], 'runtime');
  if (tokens.length === 0) {
    throw new AgentValidationError('Command cannot be empty.');
  }
  return {
    binary: tokens[0],
    args: tokens.slice(1),
    tokens,
  };
}

export function validateTypedSqlQuery(rawSql) {
  const query = String(rawSql ?? '').trim();
  if (!query) {
    throw new AgentValidationError('SQL query cannot be empty.');
  }
  if (query.length > 8192) {
    throw new AgentValidationError('SQL query exceeds 8192 byte limit.');
  }

  // Strip trailing single semicolon for multi-statement guard
  const withoutTrailingSemi = query.replace(/;\s*$/, '');
  if (withoutTrailingSemi.includes(';')) {
    throw new AgentValidationError(
      'Multi-statement SQL queries with semicolons are prohibited.',
      403
    );
  }

  const normalized = withoutTrailingSemi
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .trim()
    .toUpperCase();

  const forbidden =
    /\b(DROP\s+DATABASE|DROP\s+SCHEMA|SHUTDOWN|ALTER\s+SYSTEM|CREATE\s+EXTENSION|COPY\b.*\bPROGRAM|INTO\s+(OUTFILE|DUMPFILE)|LOAD_FILE|PG_READ_FILE|PG_EXECUTE_SERVER_PROGRAM|GRANT\s+ALL)\b/i;
  if (forbidden.test(normalized)) {
    throw new AgentValidationError(
      'Security Alert: Privileged administrative or filesystem SQL statement blocked.',
      403
    );
  }

  const allowedStart = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH|INSERT|UPDATE|DELETE)\b/i;
  if (!allowedStart.test(normalized)) {
    throw new AgentValidationError(
      'Only scoped SELECT, SHOW, EXPLAIN, WITH, INSERT, UPDATE, and DELETE statements are allowed.',
      403
    );
  }

  return withoutTrailingSemi;
}

export function renderDockerfile(manifest, options = {}) {
  const port = Number(manifest?.upstreamPort ?? 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new AgentValidationError(
      `Invalid upstreamPort "${manifest?.upstreamPort}": must be integer 1024..65535`
    );
  }

  const family = String(manifest?.runtimeFamily || 'nodejs');
  const includeOptionalFiles = options.hasPackageJson !== false;

  if (family === 'php_litespeed') {
    const safeDocRoot = validateSubpath(manifest?.documentRoot, '/public');
    validateStartupEntry(manifest?.startupFile, 'php_litespeed');
    return [
      'FROM php:8.3-cli',
      'RUN groupadd -g 10001 -r devhost && useradd -u 10001 -r -g devhost -s /sbin/nologin devhost',
      'WORKDIR /var/www/html',
      'COPY . /var/www/html',
      'RUN chown -R 10001:10001 /var/www/html',
      'USER 10001:10001',
      `EXPOSE ${port}`,
      `CMD ["php", "-S", "0.0.0.0:${port}", "-t", "/var/www/html${safeDocRoot}"]`,
    ].join('\n');
  }

  if (family === 'python') {
    const entry = validateStartupEntry(manifest?.startupFile, 'python');
    const installTokens = parseSafeBuildCommand(
      manifest?.installCommand,
      ['pip', 'install', '--no-cache-dir', '-r', 'requirements.txt'],
      'build'
    );
    const cmdArray =
      entry.mode === 'uvicorn'
        ? ['python3', '-m', 'uvicorn', entry.target, '--host', '0.0.0.0', '--port', String(port)]
        : ['python3', entry.target];

    const lines = [
      'FROM python:3.12-slim',
      'RUN groupadd -g 10001 -r devhost && useradd -u 10001 -r -g devhost -s /sbin/nologin devhost',
      'WORKDIR /app',
      'COPY . /app',
    ];
    if (options.hasRequirementsTxt !== false || manifest?.installCommand) {
      lines.push(`RUN ${JSON.stringify(installTokens)}`);
    }
    lines.push(
      'RUN chown -R 10001:10001 /app',
      'USER 10001:10001',
      `EXPOSE ${port}`,
      `CMD ${JSON.stringify(cmdArray)}`
    );
    return lines.join('\n');
  }

  // Default: Node.js
  const cmdArray = validateStartupEntry(manifest?.startupFile, 'nodejs');
  const installTokens = parseSafeBuildCommand(manifest?.installCommand, ['npm', 'ci'], 'build');
  const buildTokens = parseSafeBuildCommand(
    manifest?.buildCommand,
    ['npm', 'run', 'build'],
    'build'
  );

  const lines = [
    'FROM node:20-alpine',
    'RUN addgroup -g 10001 -S devhost && adduser -u 10001 -S -G devhost devhost',
    'WORKDIR /app',
    'COPY . /app',
  ];
  if (includeOptionalFiles) {
    lines.push(`RUN ${JSON.stringify(installTokens)}`);
    lines.push(`RUN ${JSON.stringify(buildTokens)}`);
  }
  lines.push(
    'RUN chown -R 10001:10001 /app',
    'USER 10001:10001',
    `EXPOSE ${port}`,
    `CMD ${JSON.stringify(cmdArray)}`
  );
  return lines.join('\n');
}

export function buildDockerRunArgs({
  containerId,
  ramLimitMb = 512,
  cpuCores = 1,
  hostPort,
  upstreamPort = 3000,
  serviceId,
  cpanelUser,
  imageTag,
  readOnlyRoot = true,
}) {
  const safeRam = Math.max(128, Math.min(65536, Math.round(Number(ramLimitMb) || 512)));
  const safeCpu = Math.max(0.25, Math.min(32, Number(cpuCores) || 1));
  const safeUpstreamPort = Math.max(1024, Math.min(65535, Math.round(Number(upstreamPort) || 3000)));
  const safeHostPort = Math.max(1024, Math.min(65535, Math.round(Number(hostPort) || 30000)));

  const args = [
    'run',
    '-d',
    '--name',
    containerId,
    '--restart',
    'unless-stopped',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '--pids-limit=256',
    '--user',
    CONTAINER_NON_ROOT_USER,
  ];
  if (readOnlyRoot) {
    args.push('--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m');
  }
  args.push(
    '-m',
    `${safeRam}m`,
    '--cpus',
    String(safeCpu),
    '-p',
    `127.0.0.1:${safeHostPort}:${safeUpstreamPort}`,
    '--label',
    `devhost.service=${safeIdentifier(serviceId, 'svc')}`,
    '--label',
    `devhost.tenant=${safeIdentifier(cpanelUser, 'tenant')}`,
    imageTag
  );
  return args;
}

export function buildPostgresProvisionPayload({ dbName, dbUser, password, adminPass = '' }) {
  const cleanDb = validateSqlIdentifier(dbName, 'dbName');
  const cleanUser = validateSqlIdentifier(dbUser, 'dbUser');
  const rawPass = String(password || '');
  if (!rawPass || /[\0\r\n]/.test(rawPass)) {
    throw new AgentValidationError('Database password cannot be empty or contain control characters.');
  }

  // Parameterized psql variable substitution + server-side format(%I, %L) quoting:
  // Zero password characters are interpolated into the SQL command text.
  const stdinSql = [
    "SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L', :'dbuser', :'dbpass')\\gexec",
    "SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'dbuser')\\gexec",
  ].join('\n');

  const pgAdminArgs = process.env.POSTGRES_ADMIN_URL
    ? [process.env.POSTGRES_ADMIN_URL]
    : ['-U', process.env.PG_ADMIN_USER || 'postgres'];

  return {
    binary: 'psql',
    args: [
      ...pgAdminArgs,
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      `dbuser=${cleanUser}`,
      '-v',
      `dbname=${cleanDb}`,
      '-v',
      `dbpass=${rawPass}`,
      '-f',
      '-',
    ],
    env: {
      ...process.env,
      PGPASSWORD: adminPass,
    },
    stdin: stdinSql,
  };
}

export function buildMysqlProvisionPayload({ dbName, dbUser, password, host = '%', adminPass = '' }) {
  const cleanDb = validateSqlIdentifier(dbName, 'dbName');
  const cleanUser = validateSqlIdentifier(dbUser, 'dbUser');
  const cleanHost = String(host || '%').trim();
  if (!SAFE_IP_OR_CIDR_REGEX.test(cleanHost)) {
    throw new AgentValidationError(`Invalid MySQL host allowance: "${cleanHost}"`);
  }
  const rawPass = String(password || '');
  if (!rawPass || rawPass.includes('\0')) {
    throw new AgentValidationError('Database password cannot be empty or contain NUL bytes.');
  }

  // Hex-encode password so special chars (quotes, semicolons, backslashes) never touch SQL parsing.
  const passHex = Buffer.from(rawPass, 'utf8').toString('hex');
  const stdinSql = [
    "SET SESSION sql_mode='STRICT_ALL_TABLES,NO_BACKSLASH_ESCAPES';",
    `SET @pw = CAST(UNHEX('${passHex}') AS CHAR CHARACTER SET utf8mb4);`,
    `CREATE DATABASE IF NOT EXISTS \`${cleanDb}\`;`,
    `SET @u = CONCAT('CREATE USER IF NOT EXISTS \\'', '${cleanUser}', '\\'@\\'', '${cleanHost}', '\\' IDENTIFIED BY ', QUOTE(@pw));`,
    'PREPARE dh_create_user FROM @u;',
    'EXECUTE dh_create_user;',
    'DEALLOCATE PREPARE dh_create_user;',
    `GRANT ALL PRIVILEGES ON \`${cleanDb}\`.* TO '${cleanUser}'@'${cleanHost}';`,
    'FLUSH PRIVILEGES;',
  ].join('\n');

  const mysqlArgs = ['-u', process.env.MYSQL_ADMIN_USER || 'root'];
  if (process.env.MYSQL_ADMIN_HOST) {
    mysqlArgs.unshift('-h', process.env.MYSQL_ADMIN_HOST);
  }

  return {
    binary: 'mysql',
    args: mysqlArgs,
    env: {
      ...process.env,
      MYSQL_PWD: adminPass,
    },
    stdin: stdinSql,
  };
}

export function timingSafeEqualHex(a, b) {
  const cleanA = String(a || '').replace(/^sha256=/i, '').trim().toLowerCase();
  const cleanB = String(b || '').replace(/^sha256=/i, '').trim().toLowerCase();
  if (!cleanA || cleanA.length !== cleanB.length) return false;
  const bufA = Buffer.from(cleanA, 'utf8');
  const bufB = Buffer.from(cleanB, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyHmacHeaders(headers, rawBody, agentSecret, seenNonces) {
  const ts = String(headers['x-devhost-timestamp'] || '');
  const sig = String(headers['x-devhost-signature'] || '');
  const nonce = String(headers['x-devhost-nonce'] || '');

  if (!agentSecret) return { valid: false, reason: 'Agent secret not configured' };
  if (!ts || !sig) return { valid: false, reason: 'Missing X-DevHost-Timestamp or X-DevHost-Signature' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
    return { valid: false, reason: 'Timestamp expired or invalid' };
  }

  const expected = crypto.createHmac('sha256', agentSecret).update(`${ts}.${rawBody}`).digest('hex');
  if (!timingSafeEqualHex(sig, expected)) {
    return { valid: false, reason: 'HMAC signature mismatch' };
  }

  if (nonce && seenNonces) {
    const now = Date.now();
    for (const [k, exp] of seenNonces.entries()) {
      if (exp < now) seenNonces.delete(k);
    }
    if (seenNonces.has(nonce)) {
      return { valid: false, reason: 'Replay nonce already consumed' };
    }
    seenNonces.set(nonce, now + 5 * 60 * 1000);
  }

  return { valid: true };
}

export function defaultRunExecFile(cmd, args, opts = {}) {
  const { stdin, ...execOpts } = opts;
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      { timeout: opts.timeout || 120000, maxBuffer: 4 * 1024 * 1024, ...execOpts },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
          errCode: err && typeof err.code === 'string' ? err.code : undefined,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: err ? err.message : undefined,
        });
      }
    );
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

export async function measureDirectoryUsage(rootDir) {
  let totalBytes = 0;
  let inodesUsed = 0;

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      inodesUsed += 1;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const st = await fs.stat(fullPath);
          totalBytes += st.size;
        } catch {
          // Ignore ephemeral file disappears during scan
        }
      }
    }
  }

  await walk(rootDir);
  const diskUsedGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(4));
  return { totalBytes, diskUsedGb, inodesUsed };
}

function parseDockerMemToMb(memStr) {
  // Formats like "184.5MiB / 2GiB" or "512MiB" or "1.2GiB"
  const usedPart = String(memStr || '').split('/')[0].trim();
  const match = /^([0-9.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB)$/i.exec(usedPart);
  if (!match) return 0;
  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'b') return Number((num / (1024 * 1024)).toFixed(2));
  if (unit === 'kb' || unit === 'kib') return Number((num / 1024).toFixed(2));
  if (unit === 'mb' || unit === 'mib') return Math.round(num);
  if (unit === 'gb' || unit === 'gib') return Math.round(num * 1024);
  return 0;
}

function parseDockerMemLimitMb(memStr) {
  const limitPart = String(memStr || '').split('/')[1];
  if (!limitPart) return 0;
  return parseDockerMemToMb(limitPart);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new AgentValidationError('Payload too large', 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendSignedCallback(agentSecret, callbackUrl, payload, fetchImpl = fetch) {
  if (!callbackUrl || !agentSecret) return Promise.resolve();
  const ts = String(Date.now());
  const rawBody = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', agentSecret).update(`${ts}.${rawBody}`).digest('hex');
  return fetchImpl(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DevHost-Timestamp': ts,
      'X-DevHost-Signature': `sha256=${sig}`,
    },
    body: rawBody,
  }).catch((err) => console.error('[Callback error]', err.message));
}

function resolveTenantFilePath(serviceRoot, rawRelPath) {
  const publicHtmlRoot = path.resolve(serviceRoot, 'public_html');
  const cleanRel = String(rawRelPath || '/').trim().replace(/^\/+/, '');
  if (cleanRel.includes('\0') || cleanRel.includes('\\') || cleanRel.includes('..')) {
    throw new AgentValidationError('Invalid file path traversal blocked', 403);
  }
  const resolved = path.resolve(publicHtmlRoot, cleanRel);
  if (resolved !== publicHtmlRoot && !resolved.startsWith(publicHtmlRoot + path.sep)) {
    throw new AgentValidationError('Path escapes container workspace', 403);
  }
  return { publicHtmlRoot, resolved };
}

async function findServiceMetaByServiceId(workRoot, serviceId) {
  const safeId = safeIdentifier(serviceId, 'svc');
  let users = [];
  try {
    users = await fs.readdir(workRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const dirent of users) {
    if (!dirent.isDirectory()) continue;
    const candidateDir = path.join(workRoot, dirent.name, safeId);
    const metaPath = path.join(candidateDir, '.devhost-meta.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf8');
      const parsed = JSON.parse(raw);
      return { serviceDir: candidateDir, meta: parsed };
    } catch {
      try {
        await fs.access(candidateDir);
        return {
          serviceDir: candidateDir,
          meta: { cpanelUser: dirent.name, serviceId: safeId },
        };
      } catch {
        // Continue search
      }
    }
  }
  return null;
}

export function createAgentHandler(options = {}) {
  const agentSecret = (options.agentSecret ?? process.env.DEVHOST_COMPUTE_AGENT_SECRET ?? '').trim();
  const workRoot = options.workRoot || DEFAULT_WORK_ROOT;
  const backupRoot = options.backupRoot || BACKUP_ROOT;
  const runExecFile = options.runExecFile || defaultRunExecFile;
  const seenNonces = options.seenNonces || new Map();
  const allowWorkspaceOnly = options.allowWorkspaceOnly ?? process.env.AGENT_ALLOW_WORKSPACE_ONLY === 'true';
  const fetchImpl = options.fetchImpl || fetch;

  async function writeServiceMeta(serviceDir, patch) {
    const metaPath = path.join(serviceDir, '.devhost-meta.json');
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {
      existing = {};
    }
    const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await fs.writeFile(metaPath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  return async function handleRequest(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      const dockerCheck = await runExecFile('docker', ['version', '--format', '{{.Server.Version}}']);
      return sendJson(res, 200, {
        healthy: true,
        version: 'devhost-agent/1.1.0',
        dockerAvailable: dockerCheck.ok,
        dockerVersion: dockerCheck.stdout.trim() || null,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }

    let rawBody = '';
    try {
      rawBody = await readBody(req);
    } catch (err) {
      return sendJson(res, err instanceof AgentValidationError ? err.statusCode : 400, {
        ok: false,
        error: err.message,
      });
    }

    const auth = verifyHmacHeaders(req.headers, rawBody, agentSecret, seenNonces);
    if (!auth.valid) {
      return sendJson(res, 401, { ok: false, error: auth.reason });
    }

    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Malformed JSON body' });
      }
    }

    try {
      // 1. Provision container or deploy git/zip artifact build
      if (
        req.method === 'POST' &&
        (url.pathname === '/v1/containers/provision' || url.pathname === '/v1/builds/deploy')
      ) {
        const startedAt = Date.now();
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const releaseId = String(body.releaseId || `rel_${Date.now()}`);
        if (!SAFE_RELEASE_ID_REGEX.test(releaseId)) {
          throw new AgentValidationError('Invalid releaseId format');
        }
        const containerId = containerNameFor(cpanelUser, serviceId);
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        const releaseDir = path.join(serviceDir, 'releases', releaseId);
        const currentLink = path.join(serviceDir, 'current');
        const publicDir = path.join(serviceDir, 'public_html');

        await fs.mkdir(releaseDir, { recursive: true });
        await fs.mkdir(publicDir, { recursive: true });

        // Clone or extract source if provided
        if (body.artifactDownloadUrl) {
          const dlRes = await fetchImpl(body.artifactDownloadUrl);
          if (!dlRes.ok) {
            return sendJson(res, 502, { ok: false, error: 'Artifact download failed' });
          }
          const archivePath = path.join(serviceDir, `${releaseId}.tar.gz`);
          const buf = Buffer.from(await dlRes.arrayBuffer());
          await fs.writeFile(archivePath, buf);
          const untar = await runExecFile('tar', ['-xzf', archivePath, '-C', releaseDir]);
          if (!untar.ok) {
            return sendJson(res, 422, { ok: false, error: `Artifact extraction failed: ${untar.stderr}` });
          }
        } else if (body.gitRepoUrl) {
          const cleanBranch = String(body.gitBranch || 'main').replace(/[^a-zA-Z0-9._/-]/g, '');
          const cloneRes = await runExecFile('git', [
            'clone',
            '--depth',
            '1',
            '--branch',
            cleanBranch || 'main',
            String(body.gitRepoUrl),
            releaseDir,
          ]);
          if (!cloneRes.ok) {
            if (body.callbackUrl) {
              await sendSignedCallback(
                agentSecret,
                body.callbackUrl,
                {
                  serviceId: body.serviceId,
                  releaseId,
                  status: 'failed',
                  buildLogs: cloneRes.stderr || cloneRes.error,
                },
                fetchImpl
              );
            }
            return sendJson(res, 422, { ok: false, error: `git clone failed: ${cloneRes.stderr}` });
          }
        } else if (body.marketplaceStackSlug) {
          await fs.writeFile(
            path.join(releaseDir, 'server.js'),
            `const http=require('http');http.createServer((q,s)=>{s.end('DevHost ${safeIdentifier(body.marketplaceStackSlug)} Ready');}).listen(${Number(body.upstreamPort || 3000)});`,
            'utf8'
          );
        }

        const hasPackageJson = await fs
          .access(path.join(releaseDir, 'package.json'))
          .then(() => true)
          .catch(() => false);
        const hasRequirementsTxt = await fs
          .access(path.join(releaseDir, 'requirements.txt'))
          .then(() => true)
          .catch(() => false);

        // Render injection-safe Dockerfile
        const dockerfile = renderDockerfile(body, { hasPackageJson, hasRequirementsTxt });
        await fs.writeFile(path.join(releaseDir, 'Dockerfile'), dockerfile, 'utf8');

        const imageTag = `devhost/${serviceId}:${releaseId.toLowerCase()}`;
        const dockerBuild = await runExecFile('docker', ['build', '-t', imageTag, releaseDir]);

        if (!dockerBuild.ok) {
          if (!allowWorkspaceOnly || dockerBuild.errCode !== 'ENOENT') {
            if (body.callbackUrl) {
              await sendSignedCallback(
                agentSecret,
                body.callbackUrl,
                {
                  serviceId: body.serviceId,
                  releaseId,
                  status: 'failed',
                  buildLogs: (dockerBuild.stdout + '\n' + dockerBuild.stderr).slice(-4000),
                  durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
                },
                fetchImpl
              );
            }
            return sendJson(res, 502, {
              ok: false,
              error: 'Container image build failed',
              buildLogs: (dockerBuild.stdout + '\n' + dockerBuild.stderr).slice(-4000),
            });
          }
        }

        const hostPort = 30000 + (crypto.createHash('md5').update(serviceId).digest()[0] % 9000);
        const upstreamPort = Number(body.upstreamPort || 3000);

        if (dockerBuild.ok) {
          await runExecFile('docker', ['rm', '-f', containerId]);
          const runArgs = buildDockerRunArgs({
            containerId,
            ramLimitMb: body.ramLimitMb || 2048,
            cpuCores: body.cpuCores || 2,
            hostPort,
            upstreamPort,
            serviceId: body.serviceId,
            cpanelUser,
            imageTag,
            readOnlyRoot: body.runtimeFamily !== 'php_litespeed',
          });
          const runRes = await runExecFile('docker', runArgs);
          if (!runRes.ok) {
            return sendJson(res, 502, {
              ok: false,
              error: `Failed to start container: ${runRes.stderr || runRes.error}`,
            });
          }
        }

        // Atomic symlink swap after healthy build
        await fs.rm(currentLink, { force: true, recursive: true }).catch(() => {});
        await fs.symlink(releaseDir, currentLink).catch(() => {});

        const upstreamUrl = `http://127.0.0.1:${hostPort}`;
        const liveUrl = body.domain ? `https://${body.domain}` : upstreamUrl;
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

        await writeServiceMeta(serviceDir, {
          serviceId: body.serviceId || serviceId,
          cpanelUser,
          containerId,
          domain: body.domain || '',
          runtimeFamily: body.runtimeFamily || 'nodejs',
          upstreamPort,
          hostPort,
          upstreamUrl,
          releaseId,
          ramLimitMb: Number(body.ramLimitMb || 2048),
          cpuCores: Number(body.cpuCores || 2),
        });

        const cleanDomain = String(body.domain || '').trim().toLowerCase();
        if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
          try {
            await fs.mkdir(CADDY_SITES_DIR, { recursive: true });
            const caddyConf = `${cleanDomain} {\n  reverse_proxy 127.0.0.1:${hostPort}\n  encode gzip zstd\n}\n`;
            await fs.writeFile(path.join(CADDY_SITES_DIR, `${serviceId}.caddy`), caddyConf, 'utf8');
            await runExecFile('docker', ['exec', 'devhost-caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile']);
          } catch {
            // Best-effort when Caddy volume is absent
          }
        }

        const buildLogs =
          (dockerBuild.stdout || '') +
          '\n' +
          (dockerBuild.stderr || '') +
          `\n[devhost-agent] Deployed hardened non-root release ${releaseId} in ${containerId}.`;

        if (body.callbackUrl) {
          await sendSignedCallback(
            agentSecret,
            body.callbackUrl,
            {
              serviceId: body.serviceId,
              deploymentId: body.deploymentId,
              buildJobId: body.buildJobId,
              releaseId,
              status: 'live',
              containerId,
              upstreamUrl,
              liveUrl,
              buildLogs: buildLogs.slice(-4000),
              durationSeconds,
            },
            fetchImpl
          );
        }

        return sendJson(res, 200, {
          ok: true,
          containerId,
          upstreamPort,
          upstreamUrl,
          liveUrl,
          healthStatus: 'healthy',
          buildLogs: buildLogs.slice(-4000),
          durationSeconds,
        });
      }

      // 2. Rollback to existing release + recreate container
      if (req.method === 'POST' && url.pathname === '/v1/builds/rollback') {
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const releaseId = String(body.releaseId || '');
        if (!SAFE_RELEASE_ID_REGEX.test(releaseId)) {
          throw new AgentValidationError('Invalid releaseId');
        }
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        const target = path.join(serviceDir, 'releases', releaseId);
        await fs.access(target);

        const currentLink = path.join(serviceDir, 'current');
        await fs.rm(currentLink, { force: true, recursive: true }).catch(() => {});
        await fs.symlink(target, currentLink).catch(() => {});

        const containerId = containerNameFor(cpanelUser, serviceId);
        const imageTag = `devhost/${serviceId}:${releaseId.toLowerCase()}`;
        const existingMeta =
          (await findServiceMetaByServiceId(workRoot, serviceId))?.meta || {};
        const hostPort = Number(
          existingMeta.hostPort ||
            30000 + (crypto.createHash('md5').update(serviceId).digest()[0] % 9000)
        );
        const upstreamPort = Number(existingMeta.upstreamPort || 3000);

        await runExecFile('docker', ['rm', '-f', containerId]);
        const runRes = await runExecFile(
          'docker',
          buildDockerRunArgs({
            containerId,
            ramLimitMb: existingMeta.ramLimitMb || 2048,
            cpuCores: existingMeta.cpuCores || 2,
            hostPort,
            upstreamPort,
            serviceId: body.serviceId || serviceId,
            cpanelUser,
            imageTag,
          })
        );
        if (!runRes.ok && (!allowWorkspaceOnly || runRes.errCode !== 'ENOENT')) {
          return sendJson(res, 502, {
            ok: false,
            error: `Rollback container start failed: ${runRes.stderr || runRes.error}`,
          });
        }

        await writeServiceMeta(serviceDir, { releaseId, containerId });
        return sendJson(res, 200, {
          ok: true,
          rolledBackTo: releaseId,
          containerId,
        });
      }

      // 3. Jailed container exec (allowlisted binaries only, never sh -c)
      if (req.method === 'POST' && url.pathname === '/v1/console/ssh') {
        const parsed = validateTypedAgentCommand(body.command);
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const containerId = containerNameFor(cpanelUser, serviceId);
        const t0 = Date.now();
        const r = await runExecFile('docker', [
          'exec',
          '--user',
          CONTAINER_NON_ROOT_USER,
          '-w',
          '/app',
          containerId,
          parsed.binary,
          ...parsed.args,
        ]);
        if (!r.ok && r.errCode !== 'ENOENT') {
          return sendJson(res, 500, {
            ok: false,
            error: (r.stderr || r.error || 'Command execution failed').slice(0, 2000),
          });
        }
        return sendJson(res, 200, {
          ok: true,
          output: (r.stdout || r.stderr || '').slice(0, 8000),
          executionTimeMs: Date.now() - t0,
        });
      }

      // 4. Tenant Database Provisioning (parameterized PG / UNHEX MySQL)
      if (req.method === 'POST' && url.pathname === '/v1/databases/provision') {
        const engine = String(body.engine || '').toLowerCase();
        if (engine.includes('postgres')) {
          const pgPayload = buildPostgresProvisionPayload({
            dbName: body.dbName,
            dbUser: body.dbUser,
            password: body.password,
            adminPass: process.env.PG_ADMIN_PASS || '',
          });
          const r = await runExecFile(pgPayload.binary, pgPayload.args, {
            env: pgPayload.env,
            stdin: pgPayload.stdin,
          });
          if (!r.ok && r.errCode !== 'ENOENT') {
            return sendJson(res, 500, { ok: false, error: r.stderr || r.error });
          }
          return sendJson(res, 200, { ok: true, provisioned: true, engine: 'postgresql' });
        }

        const myPayload = buildMysqlProvisionPayload({
          dbName: body.dbName,
          dbUser: body.dbUser,
          password: body.password,
          host: body.remoteIp || '%',
          adminPass: process.env.MYSQL_ADMIN_PASS || '',
        });
        const r = await runExecFile(myPayload.binary, myPayload.args, {
          env: myPayload.env,
          stdin: myPayload.stdin,
        });
        if (!r.ok && r.errCode !== 'ENOENT') {
          return sendJson(res, 500, { ok: false, error: r.stderr || r.error });
        }
        return sendJson(res, 200, { ok: true, provisioned: true, engine: 'mysql' });
      }

      // 5. Tenant Database Drop
      if (req.method === 'POST' && url.pathname === '/v1/databases/drop') {
        const cleanDb = validateSqlIdentifier(body.dbName, 'dbName');
        const cleanUser = body.dbUser ? validateSqlIdentifier(body.dbUser, 'dbUser') : null;
        const engine = String(body.engine || 'postgresql').toLowerCase();

        if (engine.includes('postgres')) {
          const stdinSql = [
            `SELECT format('DROP DATABASE IF EXISTS %I', :'dbname')\\gexec`,
            ...(cleanUser ? [`SELECT format('DROP ROLE IF EXISTS %I', :'dbuser')\\gexec`] : []),
          ].join('\n');
          const args = [
            '-U',
            process.env.PG_ADMIN_USER || 'postgres',
            '-v',
            'ON_ERROR_STOP=1',
            '-v',
            `dbname=${cleanDb}`,
            ...(cleanUser ? ['-v', `dbuser=${cleanUser}`] : []),
            '-f',
            '-',
          ];
          const r = await runExecFile('psql', args, {
            env: { ...process.env, PGPASSWORD: process.env.PG_ADMIN_PASS || '' },
            stdin: stdinSql,
          });
          if (!r.ok && r.errCode !== 'ENOENT') {
            return sendJson(res, 500, { ok: false, error: r.stderr || r.error });
          }
        } else {
          const stdinSql = [
            `DROP DATABASE IF EXISTS \`${cleanDb}\`;`,
            ...(cleanUser ? [`DROP USER IF EXISTS '${cleanUser}'@'%';`] : []),
            'FLUSH PRIVILEGES;',
          ].join('\n');
          const r = await runExecFile(
            'mysql',
            ['-u', process.env.MYSQL_ADMIN_USER || 'root'],
            {
              env: { ...process.env, MYSQL_PWD: process.env.MYSQL_ADMIN_PASS || '' },
              stdin: stdinSql,
            }
          );
          if (!r.ok && r.errCode !== 'ENOENT') {
            return sendJson(res, 500, { ok: false, error: r.stderr || r.error });
          }
        }

        return sendJson(res, 200, { ok: true, dropped: cleanDb });
      }

      // 6. Database Remote IP Whitelist
      if (req.method === 'POST' && url.pathname === '/v1/databases/whitelist') {
        const cleanDb = validateSqlIdentifier(body.dbName, 'dbName');
        const cleanUser = validateSqlIdentifier(body.dbUsername || body.dbUser, 'dbUsername');
        const ips = Array.isArray(body.remoteIps) ? body.remoteIps : [];
        for (const ip of ips) {
          if (!SAFE_IP_OR_CIDR_REGEX.test(String(ip).trim())) {
            throw new AgentValidationError(`Invalid whitelist IP/CIDR: "${ip}"`);
          }
        }

        const found = await findServiceMetaByServiceId(workRoot, body.serviceId || 'svc');
        if (found) {
          await writeServiceMeta(found.serviceDir, {
            dbWhitelists: {
              ...(found.meta.dbWhitelists || {}),
              [cleanDb]: { dbUser: cleanUser, remoteIps: ips },
            },
          });
        }
        return sendJson(res, 200, { ok: true, dbName: cleanDb, whitelistedIps: ips });
      }

      // 7. Scoped SQL Query Execution
      if (req.method === 'POST' && url.pathname === '/v1/console/sql') {
        const safeSql = validateTypedSqlQuery(body.query);
        const cleanDb = validateSqlIdentifier(body.dbName || 'postgres', 'dbName');
        const t0 = Date.now();
        const r = await runExecFile(
          'psql',
          [
            '-U',
            process.env.PG_ADMIN_USER || 'postgres',
            '-d',
            cleanDb,
            '--csv',
            '-v',
            'ON_ERROR_STOP=1',
            '-f',
            '-',
          ],
          {
            env: { ...process.env, PGPASSWORD: process.env.PG_ADMIN_PASS || '' },
            stdin: `${safeSql};\n`,
          }
        );

        if (!r.ok && r.errCode !== 'ENOENT') {
          return sendJson(res, 400, { ok: false, error: (r.stderr || r.error).slice(0, 1000) });
        }

        const lines = r.stdout.trim().split(/\r?\n/).filter(Boolean);
        const columns = lines[0] ? lines[0].split(',') : [];
        const rows = lines.slice(1, 101).map((line) => {
          const vals = line.split(',');
          const obj = {};
          columns.forEach((col, i) => {
            obj[col] = vals[i] ?? null;
          });
          return obj;
        });

        return sendJson(res, 200, {
          ok: true,
          executionTimeMs: Date.now() - t0,
          columns,
          rowCount: rows.length,
          rows,
        });
      }

      // 8. Scoped Container File Manager (/v1/files)
      if (req.method === 'POST' && url.pathname === '/v1/files') {
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        const { resolved } = resolveTenantFilePath(serviceDir, body.path || body.filePath || '/');
        const action = String(body.action || 'list');

        if (action === 'list') {
          await fs.mkdir(resolved, { recursive: true });
          const entries = await fs.readdir(resolved, { withFileTypes: true });
          const items = await Promise.all(
            entries.map(async (e) => {
              const st = await fs.stat(path.join(resolved, e.name)).catch(() => null);
              return {
                name: e.name,
                type: e.isDirectory() ? 'directory' : 'file',
                sizeBytes: st ? st.size : 0,
                modifiedAt: st ? st.mtime.toISOString() : null,
              };
            })
          );
          return sendJson(res, 200, { ok: true, items });
        }

        if (action === 'read') {
          const content = await fs.readFile(resolved, 'utf8');
          return sendJson(res, 200, { ok: true, content });
        }

        if (action === 'save' || action === 'write') {
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, String(body.content ?? ''), 'utf8');
          return sendJson(res, 200, { ok: true, saved: true });
        }

        if (action === 'chmod') {
          const modeStr = String(body.permissions || '644').trim();
          if (!SAFE_OCTAL_MODE_REGEX.test(modeStr)) {
            throw new AgentValidationError('Invalid octal permission mode');
          }
          await fs.chmod(resolved, parseInt(modeStr, 8));
          return sendJson(res, 200, { ok: true, permissions: modeStr });
        }

        if (action === 'delete') {
          await fs.rm(resolved, { recursive: true, force: true });
          return sendJson(res, 200, { ok: true, deleted: true });
        }

        throw new AgentValidationError(`Unsupported file action: "${action}"`);
      }

      // 9. Mailbox operations (/v1/email/mailbox)
      if (req.method === 'POST' && url.pathname === '/v1/email/mailbox') {
        const localPart = String(body.localPart || '').trim().toLowerCase();
        const domain = String(body.domain || '').trim().toLowerCase();
        if (!/^[a-z0-9._+-]{1,64}$/.test(localPart) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
          throw new AgentValidationError('Invalid mailbox localPart or domain');
        }
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        await fs.mkdir(serviceDir, { recursive: true });
        const emailAddress = `${localPart}@${domain}`;
        return sendJson(res, 200, {
          ok: true,
          action: body.action || 'create',
          emailAddress,
        });
      }

      // 10. Real Tar+Gzip Backup Snapshots (/v1/backups/snapshot)
      if (req.method === 'POST' && url.pathname === '/v1/backups/snapshot') {
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const snapshotId = safeIdentifier(body.snapshotId || `snap_${Date.now()}`, 'snap');
        const action = String(body.action || 'create');
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        const snapDir = path.join(backupRoot, cpanelUser, serviceId);
        const archivePath = path.join(snapDir, `${snapshotId}.tar.gz`);

        await fs.mkdir(serviceDir, { recursive: true });
        await fs.mkdir(snapDir, { recursive: true });

        if (action === 'create') {
          const tarRes = await runExecFile('tar', ['-czf', archivePath, '-C', serviceDir, '.']);
          if (!tarRes.ok && (!allowWorkspaceOnly || tarRes.errCode !== 'ENOENT')) {
            return sendJson(res, 500, { ok: false, error: tarRes.stderr || tarRes.error });
          }
          let sizeBytes = 0;
          let checksumSha256 = '';
          try {
            const fileBuf = await fs.readFile(archivePath);
            sizeBytes = fileBuf.length;
            checksumSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
          } catch {
            const usage = await measureDirectoryUsage(serviceDir);
            sizeBytes = usage.totalBytes;
            checksumSha256 = crypto
              .createHash('sha256')
              .update(`${serviceId}:${snapshotId}:${sizeBytes}`)
              .digest('hex');
          }
          return sendJson(res, 200, {
            ok: true,
            snapshotId,
            sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
            sizeBytes,
            checksumSha256,
            r2ObjectKey: `backups/${cpanelUser}/${serviceId}/${snapshotId}.tar.gz`,
          });
        }

        if (action === 'restore') {
          const untar = await runExecFile('tar', ['-xzf', archivePath, '-C', serviceDir]);
          if (!untar.ok && (!allowWorkspaceOnly || untar.errCode !== 'ENOENT')) {
            return sendJson(res, 500, { ok: false, error: untar.stderr || untar.error });
          }
          return sendJson(res, 200, { ok: true, restoredSnapshotId: snapshotId });
        }

        if (action === 'delete') {
          await fs.rm(archivePath, { force: true });
          return sendJson(res, 200, { ok: true, deletedSnapshotId: snapshotId });
        }

        throw new AgentValidationError(`Unsupported backup action: "${action}"`);
      }

      // 11. Cron Job Scheduling & Immediate Trigger (/v1/cron)
      if (req.method === 'POST' && url.pathname === '/v1/cron') {
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const action = String(body.action || 'upsert');
        const cronId = safeIdentifier(body.cronId || 'job', 'job');
        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        await fs.mkdir(serviceDir, { recursive: true });
        const cronFile = path.join(serviceDir, '.devhost-crons.json');
        let jobs = {};
        try {
          jobs = JSON.parse(await fs.readFile(cronFile, 'utf8'));
        } catch {
          jobs = {};
        }

        if (action === 'upsert') {
          const expr = String(body.cronExpression || '').trim();
          if (expr.split(/\s+/).length !== 5) {
            throw new AgentValidationError('Cron expression must contain 5 fields');
          }
          const cmdParsed = validateTypedAgentCommand(body.command);
          jobs[cronId] = {
            cronId,
            cronExpression: expr,
            tokens: cmdParsed.tokens,
            isActive: body.isActive !== false,
            updatedAt: new Date().toISOString(),
          };
          await fs.writeFile(cronFile, JSON.stringify(jobs, null, 2), 'utf8');
          return sendJson(res, 200, { ok: true, cronId, registered: true });
        }

        if (action === 'run_now') {
          const cmdParsed = validateTypedAgentCommand(body.command);
          const containerId = containerNameFor(cpanelUser, serviceId);
          const r = await runExecFile('docker', [
            'exec',
            '--user',
            CONTAINER_NON_ROOT_USER,
            '-w',
            '/app',
            containerId,
            cmdParsed.binary,
            ...cmdParsed.args,
          ]);
          return sendJson(res, 200, {
            ok: true,
            exitCode: r.ok ? 0 : r.code || 1,
            outputLog: (r.stdout || r.stderr || `Executed ${cmdParsed.binary}`).slice(0, 4000),
          });
        }

        if (action === 'toggle') {
          if (jobs[cronId]) {
            jobs[cronId].isActive = Boolean(body.isActive);
            await fs.writeFile(cronFile, JSON.stringify(jobs, null, 2), 'utf8');
          }
          return sendJson(res, 200, { ok: true, cronId, isActive: Boolean(body.isActive) });
        }

        if (action === 'delete') {
          delete jobs[cronId];
          await fs.writeFile(cronFile, JSON.stringify(jobs, null, 2), 'utf8');
          return sendJson(res, 200, { ok: true, cronId, deleted: true });
        }

        throw new AgentValidationError(`Unsupported cron action: "${action}"`);
      }

      // 12. Real Container Telemetry + Real Disk/Inode Usage (/v1/telemetry/:serviceId)
      if (req.method === 'GET' && url.pathname.startsWith('/v1/telemetry/')) {
        const rawServiceId = decodeURIComponent(url.pathname.slice('/v1/telemetry/'.length));
        const serviceId = safeIdentifier(rawServiceId, 'svc');
        const queryUser = url.searchParams.get('cpanelUser');
        const found = await findServiceMetaByServiceId(workRoot, serviceId);
        const cpanelUser = safeIdentifier(
          queryUser || found?.meta?.cpanelUser || 'tenant',
          'tenant'
        );
        const serviceDir = found?.serviceDir || path.join(workRoot, cpanelUser, serviceId);
        const containerId = found?.meta?.containerId || containerNameFor(cpanelUser, serviceId);
        const domain = url.searchParams.get('domain') || found?.meta?.domain || '';

        const [statsRes, inspectRes, logsRes, diskUsage] = await Promise.all([
          runExecFile('docker', ['stats', '--no-stream', '--format', '{{json .}}', containerId]),
          runExecFile('docker', ['inspect', '--format', '{{.State.Status}}|{{.State.StartedAt}}', containerId]),
          runExecFile('docker', ['logs', '--tail', '50', containerId]),
          measureDirectoryUsage(serviceDir),
        ]);

        let cpuPercent = 0;
        let ramUsedMb = 0;
        let ramLimitMb = Number(found?.meta?.ramLimitMb || 2048);

        if (statsRes.ok && statsRes.stdout.trim()) {
          try {
            const parsedStats = JSON.parse(statsRes.stdout.trim().split('\n')[0]);
            cpuPercent = Number(String(parsedStats.CPUPerc || '0').replace('%', '')) || 0;
            ramUsedMb = parseDockerMemToMb(parsedStats.MemUsage);
            const parsedLimit = parseDockerMemLimitMb(parsedStats.MemUsage);
            if (parsedLimit > 0) ramLimitMb = parsedLimit;
          } catch {
            // Leave at 0 if container stopped
          }
        }

        let containerStatus = 'stopped';
        let uptimeSeconds = 0;
        if (inspectRes.ok && inspectRes.stdout.trim()) {
          const [rawState, startedAtIso] = inspectRes.stdout.trim().split('|');
          if (rawState === 'running') containerStatus = 'running';
          else if (rawState === 'restarting') containerStatus = 'restarting';
          else if (rawState === 'paused') containerStatus = 'suspended';
          if (startedAtIso && rawState === 'running') {
            const diffSec = Math.round((Date.now() - Date.parse(startedAtIso)) / 1000);
            if (Number.isFinite(diffSec) && diffSec > 0) uptimeSeconds = diffSec;
          }
        }

        return sendJson(res, 200, {
          serviceId: rawServiceId,
          domain,
          containerId,
          status: containerStatus,
          cpuPercent,
          ramUsedMb,
          ramLimitMb,
          diskUsedGb: diskUsage.diskUsedGb,
          inodesUsed: diskUsage.inodesUsed,
          httpStatus: containerStatus === 'running' ? 200 : 503,
          uptimeSeconds,
          logs: (logsRes.stdout || logsRes.stderr || '').slice(-4000),
          checkedAt: new Date().toISOString(),
        });
      }

      // 13. Container Resource Scaling (/v1/containers/scale)
      if (req.method === 'POST' && url.pathname === '/v1/containers/scale') {
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const containerId = containerNameFor(cpanelUser, serviceId);
        const ramLimitMb = Math.max(128, Math.min(65536, Math.round(Number(body.ramLimitMb || 2048))));
        const cpuCores = Math.max(0.25, Math.min(32, Number(body.cpuCores || 2)));

        const upd = await runExecFile('docker', [
          'update',
          '--memory',
          `${ramLimitMb}m`,
          '--memory-swap',
          `${ramLimitMb}m`,
          '--cpus',
          String(cpuCores),
          containerId,
        ]);
        if (!upd.ok && (!allowWorkspaceOnly || upd.errCode !== 'ENOENT')) {
          return sendJson(res, 502, { ok: false, error: upd.stderr || upd.error });
        }

        const serviceDir = path.join(workRoot, cpanelUser, serviceId);
        await fs.mkdir(serviceDir, { recursive: true });
        await writeServiceMeta(serviceDir, { ramLimitMb, cpuCores, containerId });

        return sendJson(res, 200, {
          ok: true,
          containerId,
          ramLimitMb,
          cpuCores,
        });
      }

      // 14. Container Lifecycle Actions (/v1/containers/lifecycle)
      if (req.method === 'POST' && url.pathname === '/v1/containers/lifecycle') {
        const action = String(body.action || '');
        const cpanelUser = safeIdentifier(body.cpanelUser || 'tenant', 'tenant');
        const serviceId = safeIdentifier(body.serviceId || 'svc', 'svc');
        const containerId = containerNameFor(cpanelUser, serviceId);
        const dockerVerb =
          action === 'stop' || action === 'suspend'
            ? 'stop'
            : action === 'start' || action === 'unsuspend'
              ? 'start'
              : action === 'restart'
                ? 'restart'
                : null;
        if (!dockerVerb) {
          throw new AgentValidationError(`Unsupported lifecycle action: "${action}"`);
        }
        const r = await runExecFile('docker', [dockerVerb, containerId]);
        if (!r.ok && (!allowWorkspaceOnly || r.errCode !== 'ENOENT')) {
          return sendJson(res, 502, { ok: false, error: r.stderr || r.error });
        }
        return sendJson(res, 200, { ok: true, action, containerId });
      }

      // Reject unknown / unimplemented routes explicitly instead of faking 200 OK
      if (url.pathname.startsWith('/v1/')) {
        return sendJson(res, 501, {
          ok: false,
          error: `Compute agent operation "${url.pathname}" is not implemented.`,
        });
      }
      return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
    } catch (err) {
      if (err instanceof AgentValidationError) {
        return sendJson(res, err.statusCode, { ok: false, error: err.message });
      }
      return sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Internal agent error',
      });
    }
  };
}

export function createAgentServer(options = {}) {
  return http.createServer(createAgentHandler(options));
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution && process.env.VITEST !== 'true') {
  const secret = (process.env.DEVHOST_COMPUTE_AGENT_SECRET || '').trim();
  if (!secret || secret.length < 16) {
    console.error('FATAL: DEVHOST_COMPUTE_AGENT_SECRET (>=16 chars) is required.');
    process.exit(1);
  }
  const server = createAgentServer({ agentSecret: secret });
  server.listen(DEFAULT_PORT, DEFAULT_BIND_HOST, () => {
    console.log(
      `DevHost Compute Agent listening on ${DEFAULT_BIND_HOST}:${DEFAULT_PORT} (work=${DEFAULT_WORK_ROOT}, caddy=${CADDY_SITES_DIR}, os=${os.platform()})`
    );
  });
}
