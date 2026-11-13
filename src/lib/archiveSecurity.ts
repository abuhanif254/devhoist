/**
 * Archive Security Scanner, Pre-Inflation Bomb Guard & Stack Auto-Detector
 * Protects edge/compute deployments against Zip-Slip path traversal,
 * UNIX symlink escapes, decompression bombs (Zip bombs), encrypted payloads,
 * compiled executables, SSH/git hook leaks, and webshell/cryptominer code.
 */

import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { inferContentType } from '@/lib/cloudflareStorageQueue';
import type { StackRuntimeFamily } from '@/lib/stackProvisioner';

export const MAX_COMPRESSED_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024; // 250 MB hard ceiling
export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_ARCHIVE_ENTRIES = 10000;
export const MAX_EXPANSION_RATIO = 100;
export const BOMB_RATIO_MIN_UNCOMPRESSED_BYTES = 5 * 1024 * 1024; // Check ratio > 5 MB

export type ArchiveSecurityErrorCode =
  | 'INVALID_ARCHIVE'
  | 'EMPTY_ARCHIVE'
  | 'ZIP_SLIP'
  | 'SYMLINK_REJECTED'
  | 'ENCRYPTED_ARCHIVE'
  | 'DECOMPRESSION_BOMB'
  | 'EXECUTABLE_BINARY'
  | 'MALICIOUS_PAYLOAD'
  | 'SENSITIVE_DOTFILE'
  | 'QUOTA_EXCEEDED';

export class ArchiveSecurityError extends Error {
  readonly code: ArchiveSecurityErrorCode;
  readonly status: 400 | 403 | 413;
  readonly reasonCode: string;
  readonly offendingEntry?: string;

  constructor(params: {
    code: ArchiveSecurityErrorCode;
    status: 400 | 403 | 413;
    message: string;
    reasonCode?: string;
    offendingEntry?: string;
  }) {
    super(params.message);
    this.name = 'ArchiveSecurityError';
    this.code = params.code;
    this.status = params.status;
    this.reasonCode = params.reasonCode || params.code;
    this.offendingEntry = params.offendingEntry;
  }
}

export type DeployTargetPreference = 'auto' | 'static_edge' | 'container';

export interface ArchiveInspectionOptions {
  /** Remaining plan disk budget in bytes (if exceeded => QUOTA_EXCEEDED 413). */
  remainingDiskBytes?: number;
  /** Remaining plan inode budget (if exceeded => QUOTA_EXCEEDED 413). */
  remainingInodes?: number;
  /** Override max compressed bytes (capped at MAX_COMPRESSED_UPLOAD_BYTES). */
  maxCompressedBytes?: number;
  /** Override max uncompressed bytes (capped at MAX_UNCOMPRESSED_BYTES). */
  maxUncompressedBytes?: number;
  /** Override max entry count (capped at MAX_ARCHIVE_ENTRIES). */
  maxEntries?: number;
  /** Deploy target preference ('auto' | 'static_edge' | 'container'). */
  deployTarget?: DeployTargetPreference;
}

export interface DetectedProjectStack {
  detectedStack: string;
  runtimeFamily: StackRuntimeFamily;
  stackSlug: string;
  deploymentTarget: 'static_edge' | 'container';
  publishSubdir: string;
  entryFile?: string;
  buildCommand?: string;
  startCommand?: string;
}

export interface ExtractedArchiveFile {
  path: string;
  data: Uint8Array;
  sizeBytes: number;
  contentType: string;
}

export interface SafeArchiveResult {
  files: ExtractedArchiveFile[];
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
  entryCount: number;
  unwrappedRootPrefix: string | null;
  detectedStack: DetectedProjectStack;
}

const IGNORED_FILE_BASENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.scr',
  '.pif',
  '.com',
  '.msi',
  '.bat',
  '.cmd',
  '.sys',
  '.so',
  '.dylib',
  '.elf',
  '.bin',
  '.drv',
  '.ocx',
  '.cpl',
]);

const TEXT_SCAN_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.phar',
  '.php5',
  '.php7',
  '.php8',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
  '.asp',
  '.aspx',
  '.jsp',
  '.html',
  '.htm',
  '.svg',
]);

const MALICIOUS_CONTENT_RULES: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  {
    pattern:
      /\b(eval|assert|create_function)\s*\(\s*(?:@?(?:base64_decode|gzinflate|gzuncompress|str_rot13|hex2bin)\s*\(|\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\b)/i,
    label: 'PHP obfuscated code execution webshell',
  },
  {
    pattern:
      /\b(system|exec|shell_exec|passthru|proc_open|popen|pcntl_exec)\s*\(\s*@?\$_(?:GET|POST|REQUEST|COOKIE|FILES)\b/i,
    label: 'PHP remote command execution webshell',
  },
  {
    pattern: /`\$_(?:GET|POST|REQUEST|COOKIE)\[[^\]]+\]`/i,
    label: 'PHP backtick shell execution webshell',
  },
  {
    pattern: /(?:stratum\+(?:tcp|ssl):\/\/|\bxmrig\b|coinhive\.min\.js)/i,
    label: 'Cryptominer binary/stratum signature',
  },
  {
    pattern: /(?:bash\s+-i\s+>&\s+\/dev\/tcp\/|\bnc\s+-e\s+\/bin\/(?:sh|bash)\b)/i,
    label: 'Reverse shell payload signature',
  },
];

export function hasZipMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false;
  // Standard local file header (PK\x03\x04) or empty archive EOCD (PK\x05\x06)
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

/**
 * Validate and normalize an archive path entry against Zip-Slip, null bytes,
 * Windows separators, absolute paths, drive prefixes, and sensitive directories.
 */
export function sanitizeArchivePath(rawPath: string): {
  safe: boolean;
  normalized: string;
  isDirectory: boolean;
  ignore: boolean;
  reason?: string;
  code?: ArchiveSecurityErrorCode;
} {
  if (!rawPath || typeof rawPath !== 'string') {
    return {
      safe: false,
      normalized: '',
      isDirectory: false,
      ignore: false,
      code: 'ZIP_SLIP',
      reason: 'Empty archive entry path.',
    };
  }

  if (rawPath.includes('\0')) {
    return {
      safe: false,
      normalized: '',
      isDirectory: false,
      ignore: false,
      code: 'ZIP_SLIP',
      reason: 'Null byte detected in archive entry path.',
    };
  }

  if (rawPath.includes('\\')) {
    return {
      safe: false,
      normalized: '',
      isDirectory: false,
      ignore: false,
      code: 'ZIP_SLIP',
      reason: 'Backslash path separator rejected (potential Zip-Slip traversal).',
    };
  }

  if (rawPath.length > 512) {
    return {
      safe: false,
      normalized: '',
      isDirectory: false,
      ignore: false,
      code: 'ZIP_SLIP',
      reason: 'Archive entry path exceeds 512 characters.',
    };
  }

  if (rawPath.startsWith('/') || /^[a-zA-Z]:/.test(rawPath)) {
    return {
      safe: false,
      normalized: '',
      isDirectory: false,
      ignore: false,
      code: 'ZIP_SLIP',
      reason: 'Absolute paths and Windows drive letters are forbidden in archives.',
    };
  }

  const isDirectory = rawPath.endsWith('/');
  const trimmed = rawPath.replace(/\/+$/, '');
  if (!trimmed) {
    return {
      safe: true,
      normalized: '',
      isDirectory: true,
      ignore: true,
    };
  }

  const segments = trimmed.split('/');
  const cleanSegments: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg || seg === '') {
      return {
        safe: false,
        normalized: '',
        isDirectory,
        ignore: false,
        code: 'ZIP_SLIP',
        reason: 'Empty path segment in archive entry.',
      };
    }
    if (seg === '..') {
      return {
        safe: false,
        normalized: '',
        isDirectory,
        ignore: false,
        code: 'ZIP_SLIP',
        reason: 'Parent directory traversal ("..") detected in archive entry.',
      };
    }
    if (seg === '.') {
      if (i === 0 && cleanSegments.length === 0) {
        continue;
      }
      return {
        safe: false,
        normalized: '',
        isDirectory,
        ignore: false,
        code: 'ZIP_SLIP',
        reason: 'Current-directory segment (".") in nested path rejected.',
      };
    }
    cleanSegments.push(seg);
  }

  if (cleanSegments.length === 0) {
    return { safe: true, normalized: '', isDirectory: true, ignore: true };
  }

  const normalized = cleanSegments.join('/');
  const lowerSegments = cleanSegments.map((s) => s.toLowerCase());
  const basenameLower = lowerSegments[lowerSegments.length - 1];

  // Sensitive git hook RCE vectors & SSH key leaks -> strict 403 block
  for (let i = 0; i < lowerSegments.length - 1; i += 1) {
    if (lowerSegments[i] === '.git' && lowerSegments[i + 1] === 'hooks') {
      return {
        safe: false,
        normalized,
        isDirectory,
        ignore: false,
        code: 'SENSITIVE_DOTFILE',
        reason: 'Git hooks (.git/hooks/*) are forbidden in project uploads.',
      };
    }
    if (lowerSegments[i] === '.ssh') {
      return {
        safe: false,
        normalized,
        isDirectory,
        ignore: false,
        code: 'SENSITIVE_DOTFILE',
        reason: 'SSH private configuration/keys (.ssh/*) are forbidden.',
      };
    }
  }

  if (
    basenameLower === 'id_rsa' ||
    basenameLower === 'id_ed25519' ||
    basenameLower === 'id_ecdsa' ||
    basenameLower === 'authorized_keys'
  ) {
    return {
      safe: false,
      normalized,
      isDirectory,
      ignore: false,
      code: 'SENSITIVE_DOTFILE',
      reason: `Private SSH key material (${basenameLower}) is forbidden in project uploads.`,
    };
  }

  // Harmless macOS/OS archive noise and remaining .git metadata
  const ignore =
    lowerSegments.includes('__macosx') ||
    lowerSegments.includes('.git') ||
    IGNORED_FILE_BASENAMES.has(basenameLower);

  return {
    safe: true,
    normalized,
    isDirectory,
    ignore,
  };
}

function readUInt16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUInt32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function isSymlinkOrSpecialUnixMode(externalAttrs: number): string | null {
  const fileTypeBits = (externalAttrs >>> 16) & 0o170000;
  if (fileTypeBits === 0o120000) return 'UNIX symbolic link (S_IFLNK)';
  if (fileTypeBits === 0o010000) return 'UNIX named pipe / FIFO (S_IFIFO)';
  if (fileTypeBits === 0o020000) return 'UNIX character device (S_IFCHR)';
  if (fileTypeBits === 0o060000) return 'UNIX block device (S_IFBLK)';
  if (fileTypeBits === 0o140000) return 'UNIX socket (S_IFSOCK)';
  return null;
}

interface EffectiveLimits {
  hardMaxCompressed: number;
  hardMaxUncompressed: number;
  hardMaxEntries: number;
  planRemainingBytes: number;
  planRemainingInodes: number;
}

function resolveLimits(options?: ArchiveInspectionOptions): EffectiveLimits {
  const hardMaxCompressed = Math.min(
    options?.maxCompressedBytes ?? MAX_COMPRESSED_UPLOAD_BYTES,
    MAX_COMPRESSED_UPLOAD_BYTES
  );
  const hardMaxUncompressed = Math.min(
    options?.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES,
    MAX_UNCOMPRESSED_BYTES
  );
  const hardMaxEntries = Math.min(
    options?.maxEntries ?? MAX_ARCHIVE_ENTRIES,
    MAX_ARCHIVE_ENTRIES
  );
  const planRemainingBytes =
    typeof options?.remainingDiskBytes === 'number' && Number.isFinite(options.remainingDiskBytes)
      ? Math.max(0, options.remainingDiskBytes)
      : Number.POSITIVE_INFINITY;
  const planRemainingInodes =
    typeof options?.remainingInodes === 'number' && Number.isFinite(options.remainingInodes)
      ? Math.max(0, Math.floor(options.remainingInodes))
      : Number.POSITIVE_INFINITY;

  return {
    hardMaxCompressed,
    hardMaxUncompressed,
    hardMaxEntries,
    planRemainingBytes,
    planRemainingInodes,
  };
}

function assertByteAndCountBudgets(params: {
  totalBytes: number;
  singleEntryBytes: number;
  entryCount: number;
  compressedBytes: number;
  entryName: string;
  limits: EffectiveLimits;
}): void {
  const { totalBytes, singleEntryBytes, entryCount, compressedBytes, entryName, limits } = params;

  if (entryCount > limits.hardMaxEntries) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: `Archive entry count exceeds maximum security limit of ${limits.hardMaxEntries}.`,
      offendingEntry: entryName,
    });
  }

  if (entryCount > limits.planRemainingInodes) {
    throw new ArchiveSecurityError({
      code: 'QUOTA_EXCEEDED',
      status: 413,
      message: `Archive contains ${entryCount} files/directories, exceeding remaining plan inode quota (${limits.planRemainingInodes}).`,
      offendingEntry: entryName,
    });
  }

  if (singleEntryBytes > MAX_SINGLE_FILE_BYTES) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: `File "${entryName}" exceeds 50 MB single-file security limit.`,
      offendingEntry: entryName,
    });
  }

  if (totalBytes > limits.hardMaxUncompressed) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: `Decompressed archive size exceeds platform security ceiling (${Math.round(
        limits.hardMaxUncompressed / (1024 * 1024)
      )} MB).`,
      offendingEntry: entryName,
    });
  }

  if (
    totalBytes > BOMB_RATIO_MIN_UNCOMPRESSED_BYTES &&
    totalBytes / Math.max(compressedBytes, 1) > MAX_EXPANSION_RATIO
  ) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: `Suspicious compression expansion ratio (> ${MAX_EXPANSION_RATIO}x) rejected as potential zip bomb.`,
      offendingEntry: entryName,
    });
  }

  if (totalBytes > limits.planRemainingBytes) {
    throw new ArchiveSecurityError({
      code: 'QUOTA_EXCEEDED',
      status: 413,
      message: `Uncompressed project size exceeds your remaining hosting plan disk quota (${(
        limits.planRemainingBytes /
        (1024 * 1024)
      ).toFixed(2)} MB available).`,
      offendingEntry: entryName,
    });
  }
}

/**
 * Inspect ZIP End-of-Central-Directory, Central Directory headers, and Local
 * File Headers BEFORE inflating any deflate stream.
 */
export function inspectZipCentralDirectory(
  zipBytes: Uint8Array,
  options?: ArchiveInspectionOptions
): { declaredEntryCount: number; declaredTotalUncompressed: number } {
  const limits = resolveLimits(options);

  if (zipBytes.byteLength === 0) {
    throw new ArchiveSecurityError({
      code: 'EMPTY_ARCHIVE',
      status: 400,
      message: 'Uploaded ZIP archive is empty.',
    });
  }

  if (zipBytes.byteLength > limits.hardMaxCompressed) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: `Compressed ZIP archive exceeds ${Math.round(
        limits.hardMaxCompressed / (1024 * 1024)
      )} MB limit.`,
    });
  }

  if (!hasZipMagic(zipBytes)) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: 'Uploaded payload does not have a valid ZIP file header.',
    });
  }

  const len = zipBytes.byteLength;
  if (len < 22) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: 'Corrupted ZIP archive: truncated End-of-Central-Directory record.',
    });
  }

  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // Locate EOCD (0x06054b50) backwards within last 65,557 bytes
  const minSearchOffset = Math.max(0, len - 22 - 65535);
  let eocdOffset = -1;
  for (let i = len - 22; i >= minSearchOffset; i -= 1) {
    if (
      zipBytes[i] === 0x50 &&
      zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 &&
      zipBytes[i + 3] === 0x06
    ) {
      const commentLen = readUInt16LE(view, i + 20);
      if (i + 22 + commentLen <= len) {
        eocdOffset = i;
        break;
      }
    }
  }

  if (eocdOffset < 0) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: 'Malformed ZIP archive: End-of-Central-Directory signature missing.',
    });
  }

  const diskNumber = readUInt16LE(view, eocdOffset + 4);
  const cdStartDisk = readUInt16LE(view, eocdOffset + 6);
  const diskEntries = readUInt16LE(view, eocdOffset + 8);
  const totalEntries = readUInt16LE(view, eocdOffset + 10);
  const cdSize = readUInt32LE(view, eocdOffset + 12);
  const cdOffset = readUInt32LE(view, eocdOffset + 16);

  if (diskNumber !== 0 || cdStartDisk !== 0 || diskEntries !== totalEntries) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: 'Multi-disk split ZIP archives are not supported.',
    });
  }

  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ArchiveSecurityError({
      code: 'DECOMPRESSION_BOMB',
      status: 413,
      message: 'ZIP64 archives exceed supported upload limits.',
    });
  }

  if (cdOffset + cdSize > eocdOffset) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: 'Corrupted ZIP Central Directory offset or size.',
    });
  }

  let cursor = cdOffset;
  let declaredTotalUncompressed = 0;
  let parsedEntries = 0;

  while (cursor < cdOffset + cdSize) {
    if (cursor + 46 > cdOffset + cdSize) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: 'Truncated Central Directory entry.',
      });
    }

    const sig = readUInt32LE(view, cursor);
    if (sig !== 0x02014b50) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: 'Invalid Central Directory file header signature.',
      });
    }

    const flags = readUInt16LE(view, cursor + 8);
    const compressionMethod = readUInt16LE(view, cursor + 10);
    const declaredCompSize = readUInt32LE(view, cursor + 20);
    const declaredUncompSize = readUInt32LE(view, cursor + 24);
    const fileNameLen = readUInt16LE(view, cursor + 28);
    const extraLen = readUInt16LE(view, cursor + 30);
    const commentLen = readUInt16LE(view, cursor + 32);
    const externalAttrs = readUInt32LE(view, cursor + 38);
    const localHeaderOffset = readUInt32LE(view, cursor + 42);

    const nextCursor = cursor + 46 + fileNameLen + extraLen + commentLen;
    if (nextCursor > cdOffset + cdSize) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: 'Corrupted Central Directory record length.',
      });
    }

    const rawName = decoder.decode(zipBytes.subarray(cursor + 46, cursor + 46 + fileNameLen));
    parsedEntries += 1;

    if ((flags & 0x0001) !== 0) {
      throw new ArchiveSecurityError({
        code: 'ENCRYPTED_ARCHIVE',
        status: 400,
        message: `Encrypted ZIP entry "${rawName}" is not permitted.`,
        offendingEntry: rawName,
      });
    }

    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: `Unsupported ZIP compression method (${compressionMethod}) on "${rawName}". Only STORE and DEFLATE are allowed.`,
        offendingEntry: rawName,
      });
    }

    const unixViolation = isSymlinkOrSpecialUnixMode(externalAttrs);
    if (unixViolation) {
      throw new ArchiveSecurityError({
        code: 'SYMLINK_REJECTED',
        status: 403,
        message: `Rejected ${unixViolation} at "${rawName}".`,
        offendingEntry: rawName,
      });
    }

    const pathCheck = sanitizeArchivePath(rawName);
    if (!pathCheck.safe) {
      throw new ArchiveSecurityError({
        code: pathCheck.code || 'ZIP_SLIP',
        status: pathCheck.code === 'SENSITIVE_DOTFILE' ? 403 : 400,
        message: pathCheck.reason || `Unsafe archive path "${rawName}" rejected.`,
        offendingEntry: rawName,
      });
    }

    // Cross-verify corresponding Local File Header if offset within archive
    if (localHeaderOffset + 30 > len) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: `Invalid local header offset for "${rawName}".`,
        offendingEntry: rawName,
      });
    }
    const localSig = readUInt32LE(view, localHeaderOffset);
    if (localSig !== 0x04034b50) {
      throw new ArchiveSecurityError({
        code: 'INVALID_ARCHIVE',
        status: 400,
        message: `Local file header signature mismatch for "${rawName}".`,
        offendingEntry: rawName,
      });
    }
    const localFlags = readUInt16LE(view, localHeaderOffset + 6);
    if ((localFlags & 0x0001) !== 0) {
      throw new ArchiveSecurityError({
        code: 'ENCRYPTED_ARCHIVE',
        status: 400,
        message: `Encrypted local file entry "${rawName}" is not permitted.`,
        offendingEntry: rawName,
      });
    }
    const localUncompSize = readUInt32LE(view, localHeaderOffset + 22);
    const effectiveDeclaredSize = Math.max(declaredUncompSize, localUncompSize);

    if (declaredCompSize > limits.hardMaxCompressed) {
      throw new ArchiveSecurityError({
        code: 'DECOMPRESSION_BOMB',
        status: 413,
        message: `Compressed entry "${rawName}" exceeds allowed archive ceiling.`,
        offendingEntry: rawName,
      });
    }

    declaredTotalUncompressed += effectiveDeclaredSize;
    assertByteAndCountBudgets({
      totalBytes: declaredTotalUncompressed,
      singleEntryBytes: effectiveDeclaredSize,
      entryCount: parsedEntries,
      compressedBytes: zipBytes.byteLength,
      entryName: rawName,
      limits,
    });

    cursor = nextCursor;
  }

  return {
    declaredEntryCount: parsedEntries,
    declaredTotalUncompressed,
  };
}

function isCompiledBinaryMagic(bytes: Uint8Array, ext: string): string | null {
  if (BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return `Forbidden executable/native binary extension "${ext}"`;
  }
  if (bytes.byteLength >= 4) {
    // ELF: 0x7F E L F
    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
      return 'ELF native Linux binary magic bytes detected';
    }
    // Mach-O 32/64 big & little endian
    const m =
      ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    if (
      m === 0xfeedface ||
      m === 0xfeedfacf ||
      m === 0xcefaedfe ||
      m === 0xcffaedfe
    ) {
      return 'Mach-O native macOS binary magic bytes detected';
    }
  }
  // Windows PE ("MZ" + PE\0\0 header at e_lfanew)
  if (bytes.byteLength >= 64 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    const peOffset =
      bytes[60] | (bytes[61] << 8) | (bytes[62] << 16) | (bytes[63] << 24);
    if (
      peOffset > 0 &&
      peOffset + 4 <= bytes.byteLength &&
      bytes[peOffset] === 0x50 &&
      bytes[peOffset + 1] === 0x45 &&
      bytes[peOffset + 2] === 0x00 &&
      bytes[peOffset + 3] === 0x00
    ) {
      return 'Windows PE/EXE executable magic bytes detected';
    }
  }
  return null;
}

function getLowerExtension(filePath: string): string {
  const slashIdx = filePath.lastIndexOf('/');
  const base = slashIdx >= 0 ? filePath.slice(slashIdx + 1) : filePath;
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0) return '';
  return base.slice(dotIdx).toLowerCase();
}

/**
 * Validate a single extracted file against executable magic bytes and
 * malicious webshell / cryptominer patterns.
 */
export function scanExtractedFileSecurity(filePath: string, bytes: Uint8Array): void {
  const ext = getLowerExtension(filePath);
  const binaryViolation = isCompiledBinaryMagic(bytes, ext);
  if (binaryViolation) {
    throw new ArchiveSecurityError({
      code: 'EXECUTABLE_BINARY',
      status: 403,
      message: `${binaryViolation} in "${filePath}".`,
      offendingEntry: filePath,
    });
  }

  // Only decode bounded text chunks (up to 512 KB) for signature scanning
  if (bytes.byteLength > 0 && (TEXT_SCAN_EXTENSIONS.has(ext) || ext === '')) {
    const sample = bytes.subarray(0, Math.min(bytes.byteLength, 512 * 1024));
    // Skip genuine non-text binary assets missing extension check
    let nullCount = 0;
    const probeLen = Math.min(sample.byteLength, 512);
    for (let i = 0; i < probeLen; i += 1) {
      if (sample[i] === 0) nullCount += 1;
    }
    if (nullCount > 2) return;

    const text = new TextDecoder('utf-8', { fatal: false }).decode(sample);
    for (const rule of MALICIOUS_CONTENT_RULES) {
      if (rule.pattern.test(text)) {
        throw new ArchiveSecurityError({
          code: 'MALICIOUS_PAYLOAD',
          status: 403,
          message: `Blocked ${rule.label} inside "${filePath}".`,
          offendingEntry: filePath,
        });
      }
    }
  }
}

function unwrapSingleTopLevelFolder(entries: Array<{ path: string; data: Uint8Array }>): {
  entries: Array<{ path: string; data: Uint8Array }>;
  unwrappedRootPrefix: string | null;
} {
  if (entries.length === 0) {
    return { entries, unwrappedRootPrefix: null };
  }

  const firstSlash = entries[0].path.indexOf('/');
  if (firstSlash <= 0) {
    return { entries, unwrappedRootPrefix: null };
  }

  const candidateRoot = entries[0].path.slice(0, firstSlash);
  const candidatePrefix = `${candidateRoot}/`;

  // Preserve well-known output folders (`dist/`, `build/`, `out/`, `public/`) if user uploaded ONLY that subdir
  // Stripping is fine for `my-site/index.html` AND `dist/index.html` alike, because root becomes `index.html`.
  for (const item of entries) {
    if (!item.path.startsWith(candidatePrefix) || item.path.length <= candidatePrefix.length) {
      return { entries, unwrappedRootPrefix: null };
    }
  }

  return {
    entries: entries.map((item) => ({
      path: item.path.slice(candidatePrefix.length),
      data: item.data,
    })),
    unwrappedRootPrefix: candidateRoot,
  };
}

function parseJsonSafe(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Inspect normalized archive files and auto-detect stack, runtime family,
 * static vs container target, and publish subdirectory.
 */
export function detectProjectStack(
  files: ReadonlyArray<{ path: string; data: Uint8Array }>,
  preference: DeployTargetPreference = 'auto'
): DetectedProjectStack {
  const byLowerPath = new Map<string, { path: string; data: Uint8Array }>();
  for (const file of files) {
    byLowerPath.set(file.path.toLowerCase(), file);
  }

  const hasFile = (lowerPath: string) => byLowerPath.has(lowerPath);
  const hasAnyWithPrefix = (prefixLower: string) => {
    for (const key of byLowerPath.keys()) {
      if (key.startsWith(prefixLower)) return true;
    }
    return false;
  };
  const hasAnyExtension = (extLower: string) => {
    for (const key of byLowerPath.keys()) {
      if (key.endsWith(extLower)) return true;
    }
    return false;
  };

  // Helper to resolve pre-built static output root if present
  const resolveStaticPublishSubdir = (): string => {
    if (hasFile('index.html')) return '';
    for (const dir of ['dist', 'out', 'build', 'public']) {
      if (hasFile(`${dir}/index.html`)) return dir;
    }
    return '';
  };

  // Explicit static override: resolve index.html subdir when available
  if (preference === 'static_edge') {
    const publishSubdir = resolveStaticPublishSubdir();
    return {
      detectedStack: publishSubdir ? `static_edge_${publishSubdir}` : 'static_html',
      runtimeFamily: 'static_edge',
      stackSlug: 'static-edge',
      deploymentTarget: 'static_edge',
      publishSubdir,
      entryFile: publishSubdir ? `${publishSubdir}/index.html` : 'index.html',
    };
  }

  const pkgEntry = byLowerPath.get('package.json');
  const pkgJson = pkgEntry ? parseJsonSafe(pkgEntry.data) : null;
  const deps: Record<string, unknown> = {
    ...((pkgJson?.dependencies as Record<string, unknown>) || {}),
    ...((pkgJson?.devDependencies as Record<string, unknown>) || {}),
  };
  const scripts = (pkgJson?.scripts as Record<string, unknown>) || {};

  // 1. Custom Dockerfile (static_edge handled early above)
  if (hasFile('dockerfile')) {
    return {
      detectedStack: 'docker_custom',
      runtimeFamily: 'docker_kvm_vps',
      stackSlug: 'docker-custom',
      deploymentTarget: 'container',
      publishSubdir: '',
      entryFile: 'Dockerfile',
    };
  }

  // 2. Node.js / Next.js / Express / React-Vite
  if (pkgJson) {
    if ('next' in deps) {
      // If user uploaded static `next export` `out/index.html` and no server routes when in auto mode
      if (
        hasFile('out/index.html') &&
        !hasAnyWithPrefix('app/api/') &&
        !hasAnyWithPrefix('src/app/api/') &&
        !hasAnyWithPrefix('pages/api/') &&
        preference === 'auto'
      ) {
        return {
          detectedStack: 'nextjs_static_export',
          runtimeFamily: 'static_edge',
          stackSlug: 'static-edge',
          deploymentTarget: 'static_edge',
          publishSubdir: 'out',
          entryFile: 'out/index.html',
        };
      }
      return {
        detectedStack: 'nextjs_standalone',
        runtimeFamily: 'nodejs_passenger',
        stackSlug: 'nextjs-15-standalone',
        deploymentTarget: 'container',
        publishSubdir: '',
        entryFile: 'package.json',
        buildCommand: typeof scripts.build === 'string' ? scripts.build : 'npm run build',
        startCommand: typeof scripts.start === 'string' ? scripts.start : 'npm run start',
      };
    }

    const isBackendFramework =
      'express' in deps ||
      'fastify' in deps ||
      'koa' in deps ||
      '@nestjs/core' in deps ||
      'hono' in deps;

    if (isBackendFramework) {
      return {
        detectedStack: 'nodejs_express',
        runtimeFamily: 'nodejs_passenger',
        stackSlug: 'nodejs-express',
        deploymentTarget: 'container',
        publishSubdir: '',
        entryFile:
          (typeof pkgJson.main === 'string' && pkgJson.main) ||
          (hasFile('server.js') ? 'server.js' : 'index.js'),
        buildCommand: typeof scripts.build === 'string' ? scripts.build : undefined,
        startCommand: typeof scripts.start === 'string' ? scripts.start : 'npm start',
      };
    }

    // SPA prebuilt dist/ or build/ uploaded alongside package.json
    const staticSubdir = resolveStaticPublishSubdir();
    if (
      preference === 'auto' &&
      (staticSubdir === 'dist' || staticSubdir === 'build' || staticSubdir === 'out')
    ) {
      return {
        detectedStack: 'react_vite_prebuilt',
        runtimeFamily: 'static_edge',
        stackSlug: 'static-edge',
        deploymentTarget: 'static_edge',
        publishSubdir: staticSubdir,
        entryFile: `${staticSubdir}/index.html`,
      };
    }

    if ('vite' in deps || 'react-scripts' in deps || 'astro' in deps) {
      return {
        detectedStack: 'react_vite',
        runtimeFamily: 'nodejs_passenger',
        stackSlug: 'react-vite-spa',
        deploymentTarget: 'container',
        publishSubdir: '',
        entryFile: 'package.json',
        buildCommand: typeof scripts.build === 'string' ? scripts.build : 'npm run build',
        startCommand: typeof scripts.preview === 'string' ? scripts.preview : 'npm run start',
      };
    }

    return {
      detectedStack: 'nodejs_app',
      runtimeFamily: 'nodejs_passenger',
      stackSlug: 'nodejs-express',
      deploymentTarget: 'container',
      publishSubdir: '',
      entryFile: (typeof pkgJson.main === 'string' && pkgJson.main) || 'package.json',
      buildCommand: typeof scripts.build === 'string' ? scripts.build : undefined,
      startCommand: typeof scripts.start === 'string' ? scripts.start : 'npm start',
    };
  }

  // 3. PHP / Laravel
  if (hasFile('composer.json') || hasFile('artisan') || hasAnyExtension('.php')) {
    const isLaravel = hasFile('artisan') || hasAnyWithPrefix('app/http/');
    return {
      detectedStack: isLaravel ? 'laravel_php' : 'php_litespeed',
      runtimeFamily: 'php_litespeed',
      stackSlug: isLaravel ? 'laravel-11-saas' : 'php-litespeed',
      deploymentTarget: 'container',
      publishSubdir: '',
      entryFile: hasFile('public/index.php') ? 'public/index.php' : 'index.php',
    };
  }

  // 4. Python WSGI / ASGI
  if (
    hasFile('requirements.txt') ||
    hasFile('pyproject.toml') ||
    hasAnyExtension('.py')
  ) {
    return {
      detectedStack: 'python_wsgi',
      runtimeFamily: 'python_wsgi_asgi',
      stackSlug: 'fastapi-python',
      deploymentTarget: 'container',
      publishSubdir: '',
      entryFile: hasFile('main.py')
        ? 'main.py'
        : hasFile('app.py')
          ? 'app.py'
          : 'requirements.txt',
    };
  }

  // 5. Static HTML / CSS / JS / SPA
  const staticSubdir = resolveStaticPublishSubdir();
  if (preference === 'container') {
    return {
      detectedStack: 'static_nginx_container',
      runtimeFamily: 'docker_kvm_vps',
      stackSlug: 'docker-custom',
      deploymentTarget: 'container',
      publishSubdir: staticSubdir,
      entryFile: staticSubdir ? `${staticSubdir}/index.html` : 'index.html',
    };
  }

  return {
    detectedStack: staticSubdir ? `static_edge_${staticSubdir}` : 'static_html',
    runtimeFamily: 'static_edge',
    stackSlug: 'static-edge',
    deploymentTarget: 'static_edge',
    publishSubdir: staticSubdir,
    entryFile: staticSubdir ? `${staticSubdir}/index.html` : 'index.html',
  };
}

/**
 * Filter & normalize files under `publishSubdir` into an R2-ready static release map.
 */
export function buildStaticReleaseFileMap(
  files: ReadonlyArray<ExtractedArchiveFile>,
  publishSubdir: string
): Record<string, { data: Uint8Array; contentType: string }> {
  const prefix = publishSubdir
    ? `${publishSubdir.replace(/^\/+|\/+$/g, '')}/`
    : '';
  const result: Record<string, { data: Uint8Array; contentType: string }> = {};

  for (const file of files) {
    let relPath = file.path;
    if (prefix) {
      if (!relPath.startsWith(prefix)) continue;
      relPath = relPath.slice(prefix.length);
    }
    if (!relPath) continue;
    result[relPath] = {
      data: file.data,
      contentType: file.contentType,
    };
  }

  return result;
}

/**
 * Full pipeline: pre-inflation Central Directory check -> streaming chunked inflate
 * with hard security + quota bounds -> wrapper unwrap -> binary/webshell scan -> stack detection.
 */
export function extractAndScanZipArchive(
  zipBytes: Uint8Array,
  options?: ArchiveInspectionOptions
): SafeArchiveResult {
  const limits = resolveLimits(options);
  inspectZipCentralDirectory(zipBytes, options);

  const collected = new Map<string, Uint8Array[]>();
  const fileLengths = new Map<string, number>();
  let streamTotalBytes = 0;
  let streamEntryCount = 0;
  const streamErrors: {
    security: ArchiveSecurityError | null;
    fatal: Error | null;
  } = { security: null, fatal: null };

  const unzip = new Unzip((file) => {
    const pathCheck = sanitizeArchivePath(file.name);
    if (!pathCheck.safe) {
      streamErrors.security = new ArchiveSecurityError({
        code: pathCheck.code || 'ZIP_SLIP',
        status: pathCheck.code === 'SENSITIVE_DOTFILE' ? 403 : 400,
        message: pathCheck.reason || `Unsafe archive path "${file.name}" rejected.`,
        offendingEntry: file.name,
      });
      file.terminate();
      return;
    }

    if (pathCheck.isDirectory || pathCheck.ignore) {
      return;
    }

    streamEntryCount += 1;
    try {
      assertByteAndCountBudgets({
        totalBytes: streamTotalBytes,
        singleEntryBytes: file.originalSize || 0,
        entryCount: streamEntryCount,
        compressedBytes: zipBytes.byteLength,
        entryName: pathCheck.normalized,
        limits,
      });
    } catch (err) {
      if (err instanceof ArchiveSecurityError) {
        streamErrors.security = err;
      } else {
        streamErrors.fatal = err as Error;
      }
      file.terminate();
      return;
    }

    const chunks: Uint8Array[] = [];
    let currentFileBytes = 0;
    collected.set(pathCheck.normalized, chunks);

    file.ondata = (err, chunk) => {
      if (err) {
        streamErrors.fatal = err;
        file.terminate();
        return;
      }
      if (chunk && chunk.byteLength > 0) {
        currentFileBytes += chunk.byteLength;
        streamTotalBytes += chunk.byteLength;
        try {
          assertByteAndCountBudgets({
            totalBytes: streamTotalBytes,
            singleEntryBytes: currentFileBytes,
            entryCount: streamEntryCount,
            compressedBytes: zipBytes.byteLength,
            entryName: pathCheck.normalized,
            limits,
          });
        } catch (budgetErr) {
          if (budgetErr instanceof ArchiveSecurityError) {
            streamErrors.security = budgetErr;
          } else {
            streamErrors.fatal = budgetErr as Error;
          }
          file.terminate();
          return;
        }
        chunks.push(chunk);
      }
      fileLengths.set(pathCheck.normalized, currentFileBytes);
    };

    file.start();
  });

  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);

  // Feed 64 KB chunks so any zip-bomb expansion aborts early mid-stream
  const CHUNK_SIZE = 64 * 1024;
  try {
    for (let offset = 0; offset < zipBytes.byteLength; offset += CHUNK_SIZE) {
      if (streamErrors.security || streamErrors.fatal) break;
      const end = Math.min(offset + CHUNK_SIZE, zipBytes.byteLength);
      const isFinal = end >= zipBytes.byteLength;
      unzip.push(zipBytes.subarray(offset, end), isFinal);
    }
  } catch (err) {
    if (streamErrors.security) throw streamErrors.security;
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: err instanceof Error ? `Corrupted ZIP stream: ${err.message}` : 'Corrupted ZIP stream.',
    });
  }

  if (streamErrors.security) throw streamErrors.security;
  if (streamErrors.fatal) {
    throw new ArchiveSecurityError({
      code: 'INVALID_ARCHIVE',
      status: 400,
      message: `ZIP extraction error: ${streamErrors.fatal.message}`,
    });
  }

  const rawEntries: Array<{ path: string; data: Uint8Array }> = [];
  let actualTotalUncompressed = 0;

  for (const [entryPath, chunks] of collected.entries()) {
    const totalLen = fileLengths.get(entryPath) ?? 0;
    const merged = new Uint8Array(totalLen);
    let writeOffset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }
    rawEntries.push({ path: entryPath, data: merged });
    actualTotalUncompressed += merged.byteLength;
  }

  if (rawEntries.length === 0) {
    throw new ArchiveSecurityError({
      code: 'EMPTY_ARCHIVE',
      status: 400,
      message: 'ZIP archive contains no deployable files after metadata cleanup.',
    });
  }

  const { entries: unwrappedEntries, unwrappedRootPrefix } =
    unwrapSingleTopLevelFolder(rawEntries);

  const files: ExtractedArchiveFile[] = [];
  for (const entry of unwrappedEntries) {
    scanExtractedFileSecurity(entry.path, entry.data);
    files.push({
      path: entry.path,
      data: entry.data,
      sizeBytes: entry.data.byteLength,
      contentType: inferContentType(entry.path),
    });
  }

  const detectedStack = detectProjectStack(files, options?.deployTarget || 'auto');

  return {
    files,
    totalCompressedBytes: zipBytes.byteLength,
    totalUncompressedBytes: actualTotalUncompressed,
    entryCount: files.length,
    unwrappedRootPrefix,
    detectedStack,
  };
}
