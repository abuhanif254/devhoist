// Cloudflare Queue Consumer Worker for DEVHOST_BUILD_QUEUE (`devhost-build-queue`)
// Dequeues asynchronous build/deploy jobs from the OpenNext Edge Control Plane
// and dispatches them over HMAC-SHA256 to the target `devhost-agent` compute node.

async function signPayload(secret, timestamp, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  return (
    'sha256=' +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

const buildBrokerWorker = {
  async queue(batch, env) {
    const secret = String(env.DEVHOST_COMPUTE_AGENT_SECRET || '').trim();
    const fallbackAgentUrl = String(env.COMPUTE_AGENT_URL || '').trim().replace(/\/+$/, '');

    for (const message of batch.messages) {
      try {
        const job = message.body || {};
        const targetUrl = String(job.targetAgentEndpoint || fallbackAgentUrl || '').replace(/\/+$/, '');
        if (!targetUrl || !secret) {
          console.error('[build-broker] Missing targetAgentEndpoint or DEVHOST_COMPUTE_AGENT_SECRET');
          message.retry({ delaySeconds: 30 });
          continue;
        }

        const rawBody = JSON.stringify({ ...job, envVars: job.envVars || {} });
        const timestamp = String(Date.now());
        const signature = await signPayload(secret, timestamp, rawBody);

        const res = await fetch(`${targetUrl}/v1/builds/deploy`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'X-DevHost-Timestamp': timestamp,
            'X-DevHost-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: rawBody,
        });

        if (res.ok) {
          message.ack();
        } else {
          console.warn(`[build-broker] Agent HTTP ${res.status} for job ${job.jobId}`);
          message.retry({ delaySeconds: 15 });
        }
      } catch (err) {
        console.error('[build-broker] Dispatch exception:', err);
        message.retry({ delaySeconds: 15 });
      }
    }
  },
};

export default buildBrokerWorker;
