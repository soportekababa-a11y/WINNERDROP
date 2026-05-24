import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');

  if (!code || !shop || !state) {
    return NextResponse.redirect(new URL('/autoconfirm?error=callback_inválido', request.url));
  }

  try {
    const res = await fetch(
      `${BACKEND}/autoconfirm/shopify/callback?code=${encodeURIComponent(code)}&shop=${encodeURIComponent(shop)}&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    );
    // Backend returns 302 to /autoconfirm?connected=1 or ?error=...
    const location = res.headers.get('location');
    if (location) return NextResponse.redirect(location);
    return NextResponse.redirect(new URL('/autoconfirm?connected=1', request.url));
  } catch {
    return NextResponse.redirect(new URL('/autoconfirm?error=error_oauth', request.url));
  }
}
