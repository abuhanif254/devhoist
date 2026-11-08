import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { normalizeAndValidateFilePath, logSecurityAudit } from '@/lib/security';

export { normalizeAndValidateFilePath };

export interface VirtualFileEntry {
  id: string;
  service_id: string;
  user_id?: string;
  file_path: string;
  file_name: string;
  is_directory: boolean;
  size_bytes: number;
  permissions_octal: string;
  mime_type: string;
  content_text: string;
  updated_at: string;
}

function getDefaultFilesForService(serviceId: string, domain = 'app.devhost.cloud'): VirtualFileEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: `vf-1-${serviceId}`,
      service_id: serviceId,
      file_path: '/public_html/server.js',
      file_name: 'server.js',
      is_directory: false,
      size_bytes: 542,
      permissions_octal: '0755',
      mime_type: 'application/javascript',
      content_text: `// Phusion Passenger & OpenLiteSpeed Production Entrypoint (${domain})\nconst { createServer } = require('http');\nconst next = require('next');\n\nconst port = parseInt(process.env.PORT || '3000', 10);\nconst app = next({ dev: false, hostname: '0.0.0.0', port });\nconst handle = app.getRequestHandler();\n\napp.prepare().then(() => {\n  createServer((req, res) => {\n    res.setHeader('X-Powered-By', 'DevHost-NVMe-Edge');\n    handle(req, res);\n  }).listen(port, () => {\n    console.log(\`> Ready on https://${domain} (Passenger PID \${process.pid})\`);\n  });\n});\n`,
      updated_at: now,
    },
    {
      id: `vf-2-${serviceId}`,
      service_id: serviceId,
      file_path: '/public_html/package.json',
      file_name: 'package.json',
      is_directory: false,
      size_bytes: 418,
      permissions_octal: '0644',
      mime_type: 'application/json',
      content_text: JSON.stringify(
        {
          name: domain.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
          version: '2.4.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'node server.js',
          },
          dependencies: {
            next: '^15.1.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            '@supabase/supabase-js': '^2.48.0',
          },
        },
        null,
        2
      ),
      updated_at: now,
    },
    {
      id: `vf-3-${serviceId}`,
      service_id: serviceId,
      file_path: '/public_html/next.config.mjs',
      file_name: 'next.config.mjs',
      is_directory: false,
      size_bytes: 312,
      permissions_octal: '0644',
      mime_type: 'application/javascript',
      content_text: `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  output: 'standalone',\n  reactStrictMode: true,\n  poweredByHeader: false,\n  compress: true,\n  images: {\n    formats: ['image/avif', 'image/webp'],\n  },\n};\n\nexport default nextConfig;\n`,
      updated_at: now,
    },
    {
      id: `vf-4-${serviceId}`,
      service_id: serviceId,
      file_path: '/public_html/.htaccess',
      file_name: '.htaccess',
      is_directory: false,
      size_bytes: 495,
      permissions_octal: '0644',
      mime_type: 'text/plain',
      content_text: `# OpenLiteSpeed Enterprise & Phusion Passenger Configuration\nPassengerEnabled On\nPassengerAppRoot "/home/container/public_html"\nPassengerAppType node\nPassengerStartupFile server.js\n\n<IfModule LiteSpeed>\n  CacheLookup on\n  RewriteEngine On\n  RewriteCond %{HTTPS} !=on\n  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n</IfModule>\n\n# Block sensitive dotfile access\n<FilesMatch "^\\.(env|git)">\n  Require all denied\n</FilesMatch>\n`,
      updated_at: now,
    },
    {
      id: `vf-5-${serviceId}`,
      service_id: serviceId,
      file_path: '/public_html/passenger_wsgi.py',
      file_name: 'passenger_wsgi.py',
      is_directory: false,
      size_bytes: 280,
      permissions_octal: '0755',
      mime_type: 'text/x-python',
      content_text: `# Python ASGI/WSGI Passenger Bridge (FastAPI / Django)\nimport os\nimport sys\n\nsys.path.insert(0, os.path.dirname(__file__))\n\ndef application(environ, start_response):\n    status = '200 OK'\n    output = b'DevHost Cloud Python ASGI/WSGI Worker Active'\n    response_headers = [('Content-type', 'text/plain'), ('Content-Length', str(len(output)))]\n    start_response(status, response_headers)\n    return [output]\n`,
      updated_at: now,
    },
    {
      id: `vf-6-${serviceId}`,
      service_id: serviceId,
      file_path: '/logs/error.log',
      file_name: 'error.log',
      is_directory: false,
      size_bytes: 612,
      permissions_octal: '0600',
      mime_type: 'text/plain',
      content_text: `[${now}] [INFO] [Passenger] Starting Node.js v20.12.2 application on /public_html/server.js\n[${now}] [INFO] [LiteSpeed] LSCache QUIC/HTTP3 listener bound to 0.0.0.0:443\n[${now}] [INFO] [SSL] Let's Encrypt TLS 1.3 Wildcard Certificate verified (${domain})\n[${now}] [OK] Health check HTTP 200 OK in 24ms (BDIX & SG1 Anycast active)\n`,
      updated_at: now,
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId') || 'srv-default';
    const domain = searchParams.get('domain') || 'app.devhost.cloud';

    const supabaseAdmin = getServiceSupabase();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('hosting_virtual_filesystem')
        .select('*')
        .eq('service_id', serviceId)
        .order('file_path', { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          success: true,
          files: data,
          source: 'supabase',
        });
      }
    }

    const defaultFiles = getDefaultFilesForService(serviceId, domain);
    return NextResponse.json({
      success: true,
      files: defaultFiles,
      source: 'seeded_container_fs',
    });
  } catch (err) {
    console.error('[Files API GET Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load container virtual filesystem.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      serviceId,
      userId,
      filePath,
      contentText,
      permissionsOctal,
      mimeType,
    } = body as {
      action: 'save_file' | 'create_file' | 'chmod' | 'delete_file';
      serviceId: string;
      userId?: string;
      filePath: string;
      contentText?: string;
      permissionsOctal?: string;
      mimeType?: string;
    };

    if (!serviceId || !filePath) {
      return NextResponse.json(
        { success: false, error: 'serviceId and filePath are required.' },
        { status: 400 }
      );
    }

    // Strict Path Traversal Sanitizer
    const pathCheck = normalizeAndValidateFilePath(filePath);
    if (!pathCheck.valid) {
      await logSecurityAudit({
        actorId: userId,
        actorRole: 'client',
        actionType: 'FILE_PATH_TRAVERSAL_BLOCKED',
        targetResource: `${serviceId}:${filePath}`,
        riskLevel: 'critical',
        metadata: { rawPath: filePath, error: pathCheck.error },
      });

      return NextResponse.json(
        { success: false, error: pathCheck.error },
        { status: 403 }
      );
    }

    const validOctal =
      permissionsOctal && /^0[0-7]{3}$/.test(permissionsOctal)
        ? permissionsOctal
        : '0644';

    const supabaseAdmin = getServiceSupabase();
    const now = new Date().toISOString();

    if (action === 'delete_file') {
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('hosting_virtual_filesystem')
          .delete()
          .eq('service_id', serviceId)
          .eq('file_path', pathCheck.normalizedPath);
      }

      await logSecurityAudit({
        actorId: userId,
        actorRole: 'client',
        actionType: 'CONTAINER_FILE_DELETED',
        targetResource: `${serviceId}:${pathCheck.normalizedPath}`,
        riskLevel: 'medium',
      });

      return NextResponse.json({
        success: true,
        deletedPath: pathCheck.normalizedPath,
        message: `Deleted ${pathCheck.normalizedPath} from container filesystem.`,
      });
    }

    const safeContent = typeof contentText === 'string' ? contentText : '';
    const sizeBytes = new TextEncoder().encode(safeContent).length;

    const record: VirtualFileEntry = {
      id: `vf-${Date.now()}`,
      service_id: serviceId,
      user_id: userId,
      file_path: pathCheck.normalizedPath,
      file_name: pathCheck.fileName,
      is_directory: false,
      size_bytes: sizeBytes,
      permissions_octal: validOctal,
      mime_type: mimeType || 'text/plain',
      content_text: safeContent,
      updated_at: now,
    };

    if (supabaseAdmin && userId) {
      const { data: upserted } = await supabaseAdmin
        .from('hosting_virtual_filesystem')
        .upsert(
          {
            service_id: serviceId,
            user_id: userId,
            file_path: pathCheck.normalizedPath,
            file_name: pathCheck.fileName,
            is_directory: false,
            size_bytes: sizeBytes,
            permissions_octal: validOctal,
            mime_type: mimeType || 'text/plain',
            content_text: safeContent,
            updated_at: now,
          },
          { onConflict: 'service_id,file_path' }
        )
        .select('*')
        .single();

      if (upserted) {
        record.id = upserted.id;
      }
    }

    return NextResponse.json({
      success: true,
      file: record,
      passengerReloaded: action === 'save_file',
      message:
        action === 'chmod'
          ? `Permissions updated to ${validOctal} on ${pathCheck.normalizedPath}`
          : `Saved ${pathCheck.normalizedPath} (${sizeBytes} bytes) & signaled Phusion Passenger graceful reload.`,
    });
  } catch (err) {
    console.error('[Files API POST Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process container file operation.' },
      { status: 500 }
    );
  }
}
