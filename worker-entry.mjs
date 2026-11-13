// ==============================================================================
// DEVHOST CLOUD - CLOUDFLARE WORKER ENTRYPOINT (OPENNEXT FETCH + CRON TRIGGERS)
// Wraps @opennextjs/cloudflare generated `.open-next/worker.js` while exposing a
// durable `scheduled()` handler for daily Cloudflare Cron Triggers (`0 0 * * *`).
// ==============================================================================

export * from './.open-next/worker.js';
import openNextWorker from './.open-next/worker.js';

const workerEntry = {
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    const cronSecret = typeof env?.CRON_SECRET === 'string' ? env.CRON_SECRET.trim() : '';
    if (!cronSecret) {
      console.error(
        '[Cloudflare Cron] Scheduled lifecycle run aborted: CRON_SECRET binding is missing.'
      );
      return;
    }

    const rawBase =
      env?.NEXT_PUBLIC_SITE_URL ||
      env?.SITE_URL ||
      'https://devhostcloud.com';
    const baseUrl = String(rawBase).trim().replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/api/cron/lifecycle`;

    const cronRequest = new Request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
        'x-cloudflare-cron': String(controller?.cron || '0 0 * * *'),
      },
      body: JSON.stringify({
        source: 'cloudflare_cron_trigger',
        cron: controller?.cron || '0 0 * * *',
        scheduledTime: controller?.scheduledTime || Date.now(),
      }),
    });

    const jobPromise = (async () => {
      try {
        const res = await openNextWorker.fetch(cronRequest, env, ctx);
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(
            `[Cloudflare Cron] /api/cron/lifecycle returned ${res.status}: ${errText.slice(0, 400)}`
          );
          return;
        }
        const payload = await res.json().catch(() => null);
        console.log('[Cloudflare Cron] Lifecycle run completed:', JSON.stringify(payload?.summary || {}));
      } catch (err) {
        console.error('[Cloudflare Cron] Unhandled scheduled dispatch error:', err);
      }
    })();

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(jobPromise);
    } else {
      await jobPromise;
    }
  },
};

export default workerEntry;
