import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const title =
      searchParams.get('title') || 'Developer Experience of Vercel. Accessibility of cPanel.';
    const subtitle =
      searchParams.get('subtitle') ||
      'Deploy Next.js, Node.js & WordPress on enterprise NVMe SSD infrastructure with automated GitHub pipelines.';
    const price = searchParams.get('price') || '৳200/mo';
    const badge = searchParams.get('badge') || '99.99% SLA • Instant bKash & Nagad';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#09090b',
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.05) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.05) 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            padding: '60px 80px',
            color: '#ffffff',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Brand & Badge Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '36px',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                }}
              >
                DevHost
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(37, 99, 235, 0.25)',
                  color: '#60a5fa',
                  border: '1px solid rgba(37, 99, 235, 0.5)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  letterSpacing: '1px',
                }}
              >
                CLOUD
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '16px',
                color: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '6px 16px',
                borderRadius: '30px',
                fontWeight: 600,
              }}
            >
              ● {badge}
            </div>
          </div>

          {/* Central Title & Pitch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1000px' }}>
            <div
              style={{
                fontSize: title.length > 50 ? '48px' : '56px',
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-1.5px',
                color: '#ffffff',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: '22px',
                lineHeight: 1.4,
                color: '#a1a1aa',
                fontWeight: 400,
              }}
            >
              {subtitle}
            </div>
          </div>

          {/* Bottom Bar: Price & URL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div
                style={{
                  fontSize: '18px',
                  color: '#71717a',
                  fontWeight: 500,
                }}
              >
                NVMe Gen4 Cloud from
              </div>
              <div
                style={{
                  fontSize: '28px',
                  color: '#38bdf8',
                  fontWeight: 800,
                }}
              >
                {price}
              </div>
            </div>

            <div
              style={{
                fontSize: '18px',
                color: '#e4e4e7',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              devhostcloud.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error: any) {
    return new Response(`Failed to generate OpenGraph image: ${error?.message}`, {
      status: 500,
    });
  }
}
