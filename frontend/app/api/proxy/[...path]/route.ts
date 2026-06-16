import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const url = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('Authorization');
    if (auth) headers['Authorization'] = auth;
    for (const h of ['x-admin-secret', 'x-shopify-hmac-sha256', 'x-shopify-shop-domain', 'x-shopify-topic', 'x-shopify-api-version']) {
      const v = req.headers.get(h);
      if (v) headers[h] = v;
    }

    const ct = req.headers.get('content-type') ?? '';
    let body: BodyInit | undefined;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (ct.includes('multipart/form-data')) {
        // Forward multipart as-is — do NOT set content-type, let fetch set it with boundary
        body = await req.blob();
        headers['content-type'] = ct;
      } else {
        headers['content-type'] = ct || 'application/json';
        body = await req.text();
      }
    }

    const res = await fetch(url, { method: req.method, headers, body });
    const data = await res.text();

    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: `Proxy error: ${err?.message ?? 'unknown'}` },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
